import {
  avatarRetryDelaySeconds,
  drainUazAvatarJobs,
  enqueueUazAvatarJob,
} from "./uazAvatarJobs.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const baseJob = {
  id: "job-1",
  store_id: "store-1",
  lead_id: "lead-1",
  channel_id: "channel-1",
  conversation_id: "conversation-1",
  talk_id: "5585999999999@s.whatsapp.net",
  attempts: 1,
  force_refresh: false,
};

const createSupabaseMock = (options: {
  claimed?: Record<string, unknown>[];
  rpcCalls?: Array<{ name: string; args: Record<string, unknown> }>;
}) => ({
  rpc(name: string, args: Record<string, unknown>) {
    options.rpcCalls?.push({ name, args });
    if (name === "enqueue_crm_uaz_avatar_job") {
      return Promise.resolve({ data: "job-1", error: null });
    }
    if (name === "claim_crm_uaz_avatar_jobs") {
      return Promise.resolve({ data: options.claimed || [], error: null });
    }
    if (name === "complete_crm_uaz_avatar_job") {
      return Promise.resolve({ data: true, error: null });
    }
    throw new Error(`unexpected_rpc:${name}`);
  },
  from(table: string) {
    if (table !== "crm_channels") throw new Error(`unexpected_table:${table}`);
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () => Promise.resolve({
        data: {
          id: "channel-1",
          store_id: "store-1",
          provider: "uazapi",
          is_active: true,
          api_endpoint: "https://iatende.uazapi.com",
          uaz_subdomain: "iatende",
          uaz_instance_token: "secret",
          api_key: null,
        },
        error: null,
      }),
    };
    return query;
  },
});

Deno.test("avatar enqueue sends tenant-scoped context to the coalescing RPC", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const jobId = await enqueueUazAvatarJob({
    supabase: createSupabaseMock({ rpcCalls }),
    storeId: "store-1",
    leadId: "lead-1",
    channelId: "channel-1",
    conversationId: "conversation-1",
    talkId: "5585999999999@s.whatsapp.net",
    force: false,
  });

  assertEquals(jobId, "job-1");
  assertEquals(rpcCalls[0], {
    name: "enqueue_crm_uaz_avatar_job",
    args: {
      p_store_id: "store-1",
      p_lead_id: "lead-1",
      p_channel_id: "channel-1",
      p_conversation_id: "conversation-1",
      p_talk_id: "5585999999999@s.whatsapp.net",
      p_force: false,
    },
  });
});

Deno.test("avatar drain completes successful jobs after a bounded claim", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const syncCalls: Record<string, unknown>[] = [];
  const summary = await drainUazAvatarJobs({
    supabase: createSupabaseMock({ claimed: [baseJob], rpcCalls }),
    limit: 2,
    now: new Date("2026-07-07T12:00:00.000Z"),
    syncAvatar: (args: Record<string, unknown>) => {
      syncCalls.push(args);
      return Promise.resolve({
        status: "unchanged",
        synced: false,
        skipped: false,
        retriedAfterExpiry: false,
      });
    },
  });

  assertEquals(summary, {
    claimed: 1,
    completed: 1,
    retried: 0,
    failed: 0,
    results: [{ jobId: "job-1", status: "completed", syncStatus: "unchanged" }],
  });
  assertEquals(syncCalls[0].storeId, "store-1");
  assertEquals(syncCalls[0].trigger, "queue");
  assertEquals(rpcCalls.at(-1), {
    name: "complete_crm_uaz_avatar_job",
    args: {
      p_job_id: "job-1",
      p_store_id: "store-1",
      p_attempt: 1,
      p_status: "completed",
      p_error_code: null,
      p_available_at: null,
    },
  });
});

Deno.test("avatar failures use bounded retry delays and become terminal after five attempts", async () => {
  assertEquals([1, 2, 3, 4, 5].map(avatarRetryDelaySeconds), [300, 3600, 21600, 86400, null]);

  const retryCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const retrySummary = await drainUazAvatarJobs({
    supabase: createSupabaseMock({ claimed: [{ ...baseJob, attempts: 2 }], rpcCalls: retryCalls }),
    now: new Date("2026-07-07T12:00:00.000Z"),
    syncAvatar: () => Promise.resolve({
      status: "failed",
      synced: false,
      skipped: false,
      retriedAfterExpiry: false,
      errorCode: "avatar_download_timeout",
    }),
  });
  assertEquals(retrySummary.retried, 1);
  assertEquals(retryCalls.at(-1)?.args.p_status, "retry");
  assertEquals(retryCalls.at(-1)?.args.p_available_at, "2026-07-07T13:00:00.000Z");

  const failedCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const failedSummary = await drainUazAvatarJobs({
    supabase: createSupabaseMock({ claimed: [{ ...baseJob, attempts: 5 }], rpcCalls: failedCalls }),
    now: new Date("2026-07-07T12:00:00.000Z"),
    syncAvatar: () => Promise.reject(new Error("network_down")),
  });
  assertEquals(failedSummary.failed, 1);
  assertEquals(failedCalls.at(-1)?.args.p_status, "failed");
  assertEquals(failedCalls.at(-1)?.args.p_error_code, "avatar_job_exception");
});
