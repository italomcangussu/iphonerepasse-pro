import { sanitizeText } from "./crm.ts";
import {
  syncUazLeadAvatar,
  type UazLeadAvatarSyncResult,
} from "./uazLeadAvatar.ts";

type AvatarJobRow = {
  id: string;
  store_id: string;
  lead_id: string;
  channel_id: string;
  conversation_id?: string | null;
  talk_id: string;
  attempts: number;
  force_refresh?: boolean;
};

type EnqueueArgs = {
  supabase: any;
  storeId: string;
  leadId: string;
  channelId: string;
  conversationId?: string | null;
  talkId: string;
  force?: boolean;
};

export type AvatarJobDrainSummary = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  results: Array<{
    jobId: string;
    status: "completed" | "retry" | "failed";
    syncStatus?: string;
  }>;
};

const RETRY_DELAYS_SECONDS = [300, 3_600, 21_600, 86_400] as const;
const MAX_ATTEMPTS = 5;

export const avatarRetryDelaySeconds = (attempts: number): number | null => {
  const normalized = Math.max(1, Math.trunc(Number(attempts) || 1));
  if (normalized >= MAX_ATTEMPTS) return null;
  return RETRY_DELAYS_SECONDS[Math.min(normalized - 1, RETRY_DELAYS_SECONDS.length - 1)];
};

const requireText = (value: unknown, field: string): string => {
  const text = sanitizeText(value);
  if (!text) throw new Error(`avatar_job_${field}_missing`);
  return text;
};

export const enqueueUazAvatarJob = async (args: EnqueueArgs): Promise<string | null> => {
  const { data, error } = await args.supabase.rpc("enqueue_crm_uaz_avatar_job", {
    p_store_id: requireText(args.storeId, "store_id"),
    p_lead_id: requireText(args.leadId, "lead_id"),
    p_channel_id: requireText(args.channelId, "channel_id"),
    p_conversation_id: sanitizeText(args.conversationId),
    p_talk_id: requireText(args.talkId, "talk_id"),
    p_force: args.force === true,
  });
  if (error) throw new Error(error.message || "avatar_job_enqueue_failed");
  return sanitizeText(data);
};

const completeJob = async (args: {
  supabase: any;
  job: AvatarJobRow;
  status: "completed" | "retry" | "failed";
  errorCode: string | null;
  availableAt: string | null;
}) => {
  const { data, error } = await args.supabase.rpc("complete_crm_uaz_avatar_job", {
    p_job_id: args.job.id,
    p_store_id: args.job.store_id,
    p_attempt: args.job.attempts,
    p_status: args.status,
    p_error_code: args.errorCode,
    p_available_at: args.availableAt,
  });
  if (error) throw new Error(error.message || "avatar_job_completion_failed");
  if (data !== true) throw new Error("avatar_job_lease_lost");
};

const loadJobChannel = async (supabase: any, job: AvatarJobRow) => {
  const { data, error } = await supabase
    .from("crm_channels")
    .select("id,store_id,provider,is_active,api_endpoint,uaz_subdomain,uaz_instance_token,api_key")
    .eq("id", job.channel_id)
    .eq("store_id", job.store_id)
    .eq("provider", "uazapi")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message || "avatar_job_channel_lookup_failed");
  if (!data) throw new Error("avatar_job_channel_not_found");
  return data as Record<string, unknown>;
};

const failureCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/(?:avatar|uaz)_[a-z0-9_]+/i);
  return match?.[0]?.toLowerCase() || "avatar_job_exception";
};

export const drainUazAvatarJobs = async (args: {
  supabase: any;
  limit?: number;
  now?: Date;
  syncAvatar?: (
    syncArgs: Parameters<typeof syncUazLeadAvatar>[0],
  ) => Promise<UazLeadAvatarSyncResult>;
}): Promise<AvatarJobDrainSummary> => {
  const limit = Math.min(20, Math.max(1, Math.trunc(args.limit || 3)));
  const { data, error } = await args.supabase.rpc("claim_crm_uaz_avatar_jobs", {
    p_limit: limit,
    p_lease_seconds: 120,
  });
  if (error) throw new Error(error.message || "avatar_job_claim_failed");

  const jobs = (Array.isArray(data) ? data : []) as AvatarJobRow[];
  const summary: AvatarJobDrainSummary = {
    claimed: jobs.length,
    completed: 0,
    retried: 0,
    failed: 0,
    results: [],
  };
  const now = args.now || new Date();
  const syncAvatar = args.syncAvatar || syncUazLeadAvatar;

  for (const job of jobs) {
    try {
      const channel = await loadJobChannel(args.supabase, job);
      const result = await syncAvatar({
        supabase: args.supabase,
        channel,
        storeId: requireText(job.store_id, "store_id"),
        leadId: requireText(job.lead_id, "lead_id"),
        channelId: requireText(job.channel_id, "channel_id"),
        conversationId: sanitizeText(job.conversation_id),
        talkId: requireText(job.talk_id, "talk_id"),
        payloadAvatarUrl: null,
        trigger: "queue",
        force: true,
      });

      if (result.status !== "failed" && result.status !== "expired") {
        await completeJob({
          supabase: args.supabase,
          job,
          status: "completed",
          errorCode: null,
          availableAt: null,
        });
        summary.completed += 1;
        summary.results.push({ jobId: job.id, status: "completed", syncStatus: result.status });
        continue;
      }

      const delaySeconds = avatarRetryDelaySeconds(job.attempts);
      const status = delaySeconds === null ? "failed" : "retry";
      const availableAt = delaySeconds === null
        ? null
        : new Date(now.getTime() + delaySeconds * 1_000).toISOString();
      await completeJob({
        supabase: args.supabase,
        job,
        status,
        errorCode: result.errorCode || "avatar_sync_failed",
        availableAt,
      });
      if (status === "retry") summary.retried += 1;
      else summary.failed += 1;
      summary.results.push({ jobId: job.id, status, syncStatus: result.status });
    } catch (error) {
      const delaySeconds = avatarRetryDelaySeconds(job.attempts);
      const status = delaySeconds === null ? "failed" : "retry";
      const availableAt = delaySeconds === null
        ? null
        : new Date(now.getTime() + delaySeconds * 1_000).toISOString();
      await completeJob({
        supabase: args.supabase,
        job,
        status,
        errorCode: failureCode(error),
        availableAt,
      });
      if (status === "retry") summary.retried += 1;
      else summary.failed += 1;
      summary.results.push({ jobId: job.id, status });
    }
  }

  return summary;
};
