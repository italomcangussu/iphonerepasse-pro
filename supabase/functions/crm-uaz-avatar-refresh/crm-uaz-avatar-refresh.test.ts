import { createUazAvatarRefreshHandler } from "./index.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
};

const withServiceRole = async (fn: () => Promise<void>) => {
  const previous = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousUrl = Deno.env.get("SUPABASE_URL");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");
  Deno.env.set("SUPABASE_URL", "https://project-ref.supabase.co");
  try {
    await fn();
  } finally {
    if (previous === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previous);
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);
  }
};

const testJwt = (claims: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.test-signature`;
};

Deno.test("avatar refresh rejects a verified JWT without service-role claims", async () => {
  await withServiceRole(async () => {
    const handler = createUazAvatarRefreshHandler({
      createClient: () => {
        throw new Error("must_not_create_client");
      },
      enqueueJob: () => {
        throw new Error("must_not_enqueue");
      },
      drainJobs: () => {
        throw new Error("must_not_drain");
      },
    });
    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testJwt({ role: "authenticated", ref: "project-ref" })}`,
      },
      body: JSON.stringify({ leadId: "lead-1", force: true }),
    }));
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized." });
  });
});

Deno.test("avatar refresh enqueues and drains the latest individual UAZ conversation", async () => {
  await withServiceRole(async () => {
    const enqueueCalls: Record<string, unknown>[] = [];
    const drainCalls: Record<string, unknown>[] = [];
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: () => Promise.resolve({
        data: {
          id: "conversation-1",
          store_id: "store-1",
          lead_id: "lead-1",
          channel_id: "channel-1",
          talk_id: "5585999999999@s.whatsapp.net",
          crm_channels: {
            id: "channel-1",
            provider: "uazapi",
            is_active: true,
            api_endpoint: "https://iatende.uazapi.com",
            uaz_subdomain: "iatende",
            uaz_instance_token: "provider-secret",
            api_key: null,
          },
        },
        error: null,
      }),
    };
    const handler = createUazAvatarRefreshHandler({
      createClient: () => ({ from: () => query }),
      enqueueJob: (args: Record<string, unknown>) => {
        enqueueCalls.push(args);
        return Promise.resolve("job-1");
      },
      drainJobs: (args: Record<string, unknown>) => {
        drainCalls.push(args);
        return Promise.resolve({
          claimed: 1,
          completed: 1,
          retried: 0,
          failed: 0,
          results: [{ jobId: "job-1", status: "completed", syncStatus: "synced" }],
        });
      },
    });

    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testJwt({ role: "service_role", ref: "project-ref" })}`,
      },
      body: JSON.stringify({ leadId: "lead-1", force: true }),
    }));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      success: true,
      status: "synced",
      queued: true,
      processed: 1,
    });
    assertEquals(enqueueCalls.length, 1);
    assertEquals(enqueueCalls[0].force, true);
    assertEquals(enqueueCalls[0].talkId, "5585999999999@s.whatsapp.net");
    assertEquals(drainCalls.length, 1);
    assertEquals(drainCalls[0].limit, 20);
  });
});
