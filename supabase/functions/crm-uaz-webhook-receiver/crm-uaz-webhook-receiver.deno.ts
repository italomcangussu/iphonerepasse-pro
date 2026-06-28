import {
  buildCrmPushNotificationRequest,
  buildLeadAvatarStoragePath,
  sendCrmPushNotification,
} from "./index.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
};

const assertStringIncludes = (actual: string, expected: string) => {
  if (!actual.includes(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`,
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
    assertEquals(request?.payload.notification.badge, "/brand/crm/icon-192.png");
    assertEquals(
      Object.keys(request?.payload.notification ?? {}).sort(),
      ["badge", "body", "icon", "requireInteraction", "tag", "title", "url"],
    );
  });
});

Deno.test("lead avatar storage path is deterministic and webp", () => {
  assertEquals(
    buildLeadAvatarStoragePath({ storeId: "sobral", leadId: "lead/1" }),
    "avatars/sobral/lead-9ddcd97ac77aea83.webp",
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
      globalThis.fetch = () => Promise.resolve(new Response("failed", { status: 500 }));
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
