import {
  buildCrmPushNotificationRequest,
  buildLeadAvatarStoragePath,
  isAdminAudioMessage,
  sendCrmPushNotification,
} from "./index.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
};

const assert = (condition: unknown) => {
  if (!condition) throw new Error("Expected condition to be truthy");
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

Deno.test("UAZ webhook enqueues avatar work and never awaits provider image sync", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(!source.includes("await syncUazLeadAvatar("));
  assert(source.includes("await enqueueUazAvatarJob("));
  assert(source.includes("EdgeRuntime.waitUntil(drainUazAvatarJobs("));
});

Deno.test("UAZ webhook never persists raw provider media URLs when storage persistence fails", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(source, "safeStoredMediaUrl");
  assertStringIncludes(source, "resolvedMedia = {");
  assertStringIncludes(source, "mediaUrl: null");
  assertStringIncludes(source, "media_storage_pending");
  assert(!source.includes("media_url: resolvedMedia.mediaUrl"));
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

Deno.test("isAdminAudioMessage recognizes voice notes and audio mimetypes", () => {
  assert(isAdminAudioMessage("ptt"));
  assert(isAdminAudioMessage("audio"));
  assert(isAdminAudioMessage("myaudio"));
  assert(isAdminAudioMessage("audioMessage"));
  assert(isAdminAudioMessage("audio_message"));
  assert(isAdminAudioMessage("audio/ogg; codecs=opus"));
  assert(isAdminAudioMessage("AUDIO/MP4"));
  assert(!isAdminAudioMessage("image"));
  assert(!isAdminAudioMessage("image/jpeg"));
  assert(!isAdminAudioMessage("document"));
  assert(!isAdminAudioMessage(""));
  assert(!isAdminAudioMessage(null));
});

Deno.test("UAZ webhook transcribes admin voice notes before dispatching to the finance agent", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  // Groq Whisper turbo transcription is wired into the admin-console branch.
  assertStringIncludes(source, 'from "../_shared/crm_ai_payload.ts"');
  assertStringIncludes(source, "transcribeAdminAudio");
  assertStringIncludes(source, "transcribeAudioForAi(");
  // The resolved transcript (not the raw empty content) reaches the agent.
  assertStringIncludes(source, "isAdminAudioMessage(resolvedMedia.mediaType)");
  assertStringIncludes(source, "messageContent: adminMessageContent");
  // The transcript is persisted so history/inbox reflect the spoken message.
  assertStringIncludes(source, "crm_admin_agent_audio_transcribed");
  assert(!source.includes("messageContent: messageContent || \"\","));
});

Deno.test("UAZ webhook blocks group chats before any lead/message/dispatch", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  // The group guard exists and returns an ignored response.
  assertStringIncludes(source, "group_message_ignored");
  assertStringIncludes(source, "crm_uaz_group_ignored");
  // It must fire before the lead is upserted and before the admin agent is
  // dispatched — otherwise a group would still create noise / trigger a reply.
  const guardIdx = source.indexOf("group_message_ignored");
  assert(guardIdx > 0);
  assert(guardIdx < source.indexOf("upsert_crm_lead"));
  assert(guardIdx < source.lastIndexOf("dispatchAdminAgentInbound("));
  assert(guardIdx < source.lastIndexOf("dispatchAiInboundIfEligible("));
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
