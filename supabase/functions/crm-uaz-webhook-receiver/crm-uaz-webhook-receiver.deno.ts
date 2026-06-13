import {
  buildCrmPushNotificationRequest,
  buildLeadAvatarStoragePath,
  sendCrmPushNotification,
  syncLeadAvatarFromPayload,
} from "./index.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
};

const assertStringIncludes = (actual: string, expected: string) => {
  if (!actual.includes(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(actual)} to include ${
        JSON.stringify(expected)
      }`,
    );
  }
};

const withEnv = async (
  values: Record<string, string | null>,
  fn: () => Promise<void> | void,
) => {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) previous.set(key, Deno.env.get(key));

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
    await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
};

type AvatarMockOptions = {
  leadRow: Record<string, unknown> | null;
  uploaded?: Record<string, unknown>[];
  updates?: Record<string, unknown>[];
};

const createAvatarSupabaseMock = (options: AvatarMockOptions) => {
  const uploaded = options.uploaded || [];
  const updates = options.updates || [];

  return {
    from(table: string) {
      if (table === "crm_leads") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: options.leadRow,
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                updates.push({ table, patch, column, value });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error(`unexpected_table:${table}`);
    },
    storage: {
      from(bucket: string) {
        return {
          upload(
            path: string,
            bytes: Uint8Array,
            options: Record<string, unknown>,
          ) {
            uploaded.push({ bucket, path, bytes: Array.from(bytes), options });
            return Promise.resolve({ data: { path }, error: null });
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl:
                  `https://project.supabase.co/storage/v1/object/public/crm-media/${path}`,
              },
            };
          },
        };
      },
    },
  };
};

Deno.test("CRM push payload uses crm_inbox with a CRM Plus conversation deep link", async () => {
  await withEnv({
    CRM_BASE_URL: "https://crm.example.com/",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }, async () => {
    const request = buildCrmPushNotificationRequest({
      topic: "crm_inbox",
      title: "Nova mensagem CRM",
      body: "Cliente: Oi",
      conversationId: "conversation 1",
      leadId: "lead 1",
    });

    assertEquals(request?.payload.product, "crmplus");
    assertEquals(request?.payload.topic, "crm_inbox");
    assertEquals(request?.payload.notification.title, "Nova mensagem CRM");
    assertEquals(request?.payload.notification.body, "Cliente: Oi");
    assertEquals(
      request?.payload.notification.url,
      "https://crm.example.com/conversations/conversation%201",
    );
    assertEquals(request?.payload.notification.icon, "/brand/crm/icon-192.png");
    assertEquals(
      request?.payload.notification.badge,
      "/brand/crm/icon-192.png",
    );
    assertEquals(
      Object.keys(request?.payload.notification ?? {}).sort(),
      ["badge", "body", "icon", "requireInteraction", "tag", "title", "url"],
    );
  });
});

Deno.test("lead avatar storage path is deterministic and webp", () => {
  assertEquals(
    buildLeadAvatarStoragePath({ storeId: "sobral", leadId: "lead/1" }),
    "avatars/sobral/lead%2F1.webp",
  );
});

Deno.test("lead avatar sync skips when payload has no avatar URL", async () => {
  const calls: string[] = [];
  const supabase = {
    from: () => {
      calls.push("from");
      throw new Error("should_not_query_lead_without_avatar");
    },
  };

  const result = await syncLeadAvatarFromPayload({
    supabase,
    storeId: "store-1",
    leadId: "lead-1",
    channelId: "channel-1",
    payload: { chat: { name: "Maria" } },
    avatarUrl: null,
    fetchImpl: () => {
      throw new Error("should_not_fetch_without_avatar");
    },
    convertToWebp: async () => new Uint8Array([1]),
  });

  assertEquals(result, {
    synced: false,
    skipped: true,
    reason: "avatar_url_missing",
  });
  assertEquals(calls, []);
});

Deno.test("lead avatar sync skips when lead avatar was already updated", async () => {
  let fetched = false;
  const supabase = createAvatarSupabaseMock({
    leadRow: {
      avatar_url: "https://cdn.example.com/avatar.webp",
      avatar_lead_updated: true,
    },
  });

  const result = await syncLeadAvatarFromPayload({
    supabase,
    storeId: "store-1",
    leadId: "lead-1",
    channelId: "channel-1",
    payload: { avatarUrl: "https://example.com/source.jpg" },
    avatarUrl: "https://example.com/source.jpg",
    fetchImpl: () => {
      fetched = true;
      return Promise.resolve(new Response());
    },
    convertToWebp: async () => new Uint8Array([1]),
  });

  assertEquals(result, {
    synced: false,
    skipped: true,
    reason: "avatar_already_updated",
  });
  assertEquals(fetched, false);
});

Deno.test("lead avatar sync uploads webp and marks lead updated", async () => {
  const uploaded: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const supabase = createAvatarSupabaseMock({
    leadRow: { avatar_url: null, avatar_lead_updated: false },
    uploaded,
    updates,
  });

  const result = await syncLeadAvatarFromPayload({
    supabase,
    storeId: "store-1",
    leadId: "lead/1",
    channelId: "channel-1",
    payload: { avatarUrl: "https://example.com/source.jpg" },
    avatarUrl: "https://example.com/source.jpg",
    fetchImpl: () =>
      Promise.resolve(
        new Response(new Uint8Array([255, 216, 255]), {
          headers: { "Content-Type": "image/jpeg", "Content-Length": "3" },
        }),
      ),
    convertToWebp: async (bytes: Uint8Array) => {
      assertEquals(Array.from(bytes), [255, 216, 255]);
      return new Uint8Array([82, 73, 70, 70]);
    },
  });

  assertEquals(result.synced, true);
  assertEquals(uploaded[0].bucket, "crm-media");
  assertEquals(uploaded[0].path, "avatars/store-1/lead%2F1.webp");
  assertEquals(
    (uploaded[0].options as Record<string, unknown>).contentType,
    "image/webp",
  );
  const leadPatch = updates[0].patch as Record<string, unknown>;
  assertEquals(leadPatch.avatar_lead_updated, true);
  assertEquals(
    String(leadPatch.avatar_url).includes(
      "/crm-media/avatars/store-1/lead%2F1.webp",
    ),
    true,
  );
});

Deno.test("CRM push payload uses new_lead with a CRM Plus lead fallback link", async () => {
  await withEnv({
    CRM_BASE_URL: null,
    CRM_HOSTNAME: "crm.iphonerepasse.com.br",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }, async () => {
    const request = buildCrmPushNotificationRequest({
      topic: "new_lead",
      title: "Novo lead no CRM",
      body: "Novo lead recebido.",
      conversationId: "",
      leadId: "lead/1",
    });

    assertEquals(request?.payload.product, "crmplus");
    assertEquals(request?.payload.topic, "new_lead");
    assertEquals(request?.payload.notification.requireInteraction, true);
    assertEquals(
      request?.payload.notification.url,
      "https://crm.iphonerepasse.com.br/leads/lead%2F1",
    );
    assertStringIncludes(String(request?.payload.notification.tag), "new_lead");
  });
});

Deno.test("CRM push-send failures do not reject webhook notification delivery", async () => {
  await withEnv({
    CRM_BASE_URL: "https://crm.example.com",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;

    try {
      globalThis.fetch = () =>
        Promise.resolve(new Response("failed", { status: 500 }));
      console.warn = () => undefined;

      await sendCrmPushNotification({
        topic: "crm_inbox",
        title: "Nova mensagem CRM",
        body: "Cliente: Oi",
        conversationId: "conversation-1",
        leadId: "lead-1",
      });
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });
});
