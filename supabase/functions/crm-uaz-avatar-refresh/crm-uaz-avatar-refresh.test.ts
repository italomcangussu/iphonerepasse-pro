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
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");
  try {
    await fn();
  } finally {
    if (previous === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previous);
  }
};

Deno.test("avatar refresh rejects an incorrect service-role bearer", async () => {
  await withServiceRole(async () => {
    const handler = createUazAvatarRefreshHandler({
      createClient: () => {
        throw new Error("must_not_create_client");
      },
      syncAvatar: () => {
        throw new Error("must_not_sync");
      },
    });
    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
      body: JSON.stringify({ leadId: "lead-1", force: true }),
    }));
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized." });
  });
});

Deno.test("avatar refresh resolves the latest individual UAZ conversation and sanitizes output", async () => {
  await withServiceRole(async () => {
    const syncCalls: Record<string, unknown>[] = [];
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
      syncAvatar: (args: Record<string, unknown>) => {
        syncCalls.push(args);
        return Promise.resolve({
          status: "synced",
          synced: true,
          skipped: false,
          retriedAfterExpiry: true,
          avatarUrl: "https://private.example/avatar.webp",
        });
      },
    });

    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer service-role-secret" },
      body: JSON.stringify({ leadId: "lead-1", force: true }),
    }));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      success: true,
      status: "synced",
      retriedAfterExpiry: true,
    });
    assertEquals(syncCalls.length, 1);
    assertEquals(syncCalls[0].trigger, "backfill");
    assertEquals(syncCalls[0].force, true);
    assertEquals(syncCalls[0].talkId, "5585999999999@s.whatsapp.net");
  });
});
