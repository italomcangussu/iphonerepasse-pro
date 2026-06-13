/// <reference lib="deno.ns" />
import {
  buildCrmNotificationUrl,
  buildCrmPushNotificationRequest,
  compactNotificationText,
} from "./crm_push.ts";

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

Deno.test("compactNotificationText falls back and truncates long text", () => {
  assertEquals(compactNotificationText(null, "fallback"), "fallback");
  const long = "x".repeat(200);
  const result = compactNotificationText(long, "fallback");
  assertEquals(result.length, 120);
  assertStringIncludes(result, "...");
});

Deno.test("buildCrmNotificationUrl prefers the conversation deep link on the CRM host", async () => {
  await withEnv({ CRM_BASE_URL: "https://crm.example.com/" }, () => {
    assertEquals(
      buildCrmNotificationUrl("conv 1", "lead 1"),
      "https://crm.example.com/conversations/conv%201",
    );
    assertEquals(
      buildCrmNotificationUrl("", "lead/1"),
      "https://crm.example.com/leads/lead%2F1",
    );
  });
});

Deno.test("buildCrmPushNotificationRequest returns null without Supabase env", async () => {
  await withEnv({ SUPABASE_URL: null, SUPABASE_SERVICE_ROLE_KEY: null }, () => {
    const request = buildCrmPushNotificationRequest({
      topic: "crm_inbox",
      title: "x",
      body: "y",
      conversationId: "c1",
      leadId: "l1",
    });
    assertEquals(request, null);
  });
});

Deno.test("buildCrmPushNotificationRequest tags product=crmplus and scopes by store", async () => {
  await withEnv({
    CRM_BASE_URL: "https://crm.example.com",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }, () => {
    const request = buildCrmPushNotificationRequest({
      topic: "crm_inbox",
      title: "Nova mensagem CRM",
      body: "Cliente: Oi",
      conversationId: "conv-1",
      leadId: "lead-1",
      storeId: "store-1",
    });

    assertEquals(request?.payload.product, "crmplus");
    assertEquals(request?.payload.topic, "crm_inbox");
    assertEquals(request?.payload.store_id, "store-1");
    assertEquals(
      request?.payload.notification.url,
      "https://crm.example.com/conversations/conv-1",
    );
    assertEquals(request?.endpoint, "https://project.supabase.co/functions/v1/push-send");
  });
});

Deno.test("buildCrmPushNotificationRequest marks transfer_pending as requireInteraction", async () => {
  await withEnv({
    CRM_BASE_URL: "https://crm.example.com",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }, () => {
    const request = buildCrmPushNotificationRequest({
      topic: "transfer_pending",
      title: "Atendimento aguardando humano",
      body: "A IA transferiu uma conversa.",
      conversationId: "conv-9",
      leadId: "lead-9",
      storeId: "store-9",
    });

    assertEquals(request?.payload.topic, "transfer_pending");
    assertEquals(request?.payload.notification.requireInteraction, true);
    assertStringIncludes(
      String(request?.payload.notification.tag),
      "transfer_pending",
    );
    assertEquals(
      request?.payload.notification.url,
      "https://crm.example.com/conversations/conv-9",
    );
  });
});

Deno.test("buildCrmPushNotificationRequest lets crm_inbox stay non-blocking", async () => {
  await withEnv({
    CRM_BASE_URL: "https://crm.example.com",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }, () => {
    const request = buildCrmPushNotificationRequest({
      topic: "crm_inbox",
      title: "Nova mensagem CRM",
      body: "Oi",
      conversationId: "c",
      leadId: "l",
    });
    assertEquals(request?.payload.notification.requireInteraction, false);
  });
});
