/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("DENO_TEST", "1");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
Deno.env.set("PUSH_WORKER_SECRET", "worker-secret");
Deno.env.set("VAPID_PRIVATE_KEY", "private-key");
Deno.env.set("VAPID_PUBLIC_KEY", "public-key");

const {
  handlePushSend,
  encryptPayload,
  buildWebPushInfo,
  buildDeclarativePushEnvelope,
  uint8ToUrlB64,
  toArrayBuffer,
} = await import("./index.ts");

type Sub = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function request(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/push-send", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeSupabaseRecorder(subs: Sub[]) {
  const selects: Array<
    {
      filters: Array<[string, unknown]>;
      contains: Array<[string, unknown]>;
      inFilters: Array<[string, unknown]>;
    }
  > = [];
  const updates: Array<
    {
      payload: unknown;
      filters: Array<[string, unknown]>;
      inFilters: Array<[string, unknown]>;
    }
  > = [];

  return {
    selects,
    updates,
    client: {
      from(_table: string) {
        return {
          select(_columns: string) {
            const call = {
              filters: [] as Array<[string, unknown]>,
              contains: [] as Array<[string, unknown]>,
              inFilters: [] as Array<[string, unknown]>,
            };
            selects.push(call);
            const query = {
              eq(column: string, value: unknown) {
                call.filters.push([column, value]);
                return query;
              },
              in(column: string, value: unknown) {
                call.inFilters.push([column, value]);
                return query;
              },
              contains(column: string, value: unknown) {
                call.contains.push([column, value]);
                return query;
              },
              then(resolve: (value: { data: Sub[]; error: null }) => void) {
                resolve({ data: subs, error: null });
              },
            };
            return query;
          },
          update(payload: unknown) {
            const call = {
              payload,
              filters: [] as Array<[string, unknown]>,
              inFilters: [] as Array<[string, unknown]>,
            };
            updates.push(call);
            const query = {
              eq(column: string, value: unknown) {
                call.filters.push([column, value]);
                return Promise.resolve({ error: null });
              },
              in(column: string, value: unknown) {
                call.inFilters.push([column, value]);
                return Promise.resolve({ error: null });
              },
            };
            return query;
          },
        };
      },
    },
  };
}

const sub = {
  id: "sub-1",
  user_id: "user-1",
  endpoint: "https://push.example/1",
  p256dh: "p256dh",
  auth: "auth",
};

Deno.test("builds a declarative ERP push envelope with an absolute navigate URL", () => {
  const previous = Deno.env.get("APP_BASE_URL");
  Deno.env.set("APP_BASE_URL", "https://app.iphonerepasse.com.br");
  try {
    const envelope = buildDeclarativePushEnvelope("erp", {
      title: "Nova venda",
      body: "Venda concluída",
      url: "/#/finance",
    });

    assertEquals(envelope.web_push, 8030);
    assertEquals(envelope.notification, {
      title: "Nova venda",
      body: "Venda concluída",
      navigate: "https://app.iphonerepasse.com.br/#/finance",
      lang: "pt-BR",
      dir: "ltr",
      silent: false,
    });
  } finally {
    if (previous === undefined) Deno.env.delete("APP_BASE_URL");
    else Deno.env.set("APP_BASE_URL", previous);
  }
});

Deno.test("preserves an absolute CRM Plus navigate URL and a real badge count", () => {
  const envelope = buildDeclarativePushEnvelope("crmplus", {
    title: "Nova mensagem",
    url: "https://crm.iphonerepasse.com.br/conversations/abc",
    badgeCount: 4,
  });

  assertEquals(
    envelope.notification.navigate,
    "https://crm.iphonerepasse.com.br/conversations/abc",
  );
  assertEquals(envelope.notification.app_badge, "4");
  assertEquals(envelope.notification.silent, false);
});

Deno.test("push-send rejects requests without service role or worker secret", async () => {
  const response = await handlePushSend(
    request({ notification: { title: "Nova mensagem CRM" } }),
    {
      createServiceClient: () => {
        throw new Error("service client should not be created");
      },
    },
  );

  assertEquals(response.status, 403);
});

Deno.test("push-send rejects empty service-role environment values", async () => {
  const previous = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");
  try {
    const response = await handlePushSend(
      request(
        { notification: { title: "Nova mensagem CRM" } },
        { Authorization: "Bearer anything" },
      ),
      {
        createServiceClient: () => {
          throw new Error("service client should not be created");
        },
      },
    );

    assertEquals(response.status, 403);
  } finally {
    if (previous === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previous);
  }
});

Deno.test("push-send requires a notification title", async () => {
  const response = await handlePushSend(
    request({ notification: {} }, { "x-worker-secret": "worker-secret" }),
  );

  assertEquals(response.status, 400);
});

Deno.test("push-send accepts service-role authorization", async () => {
  const db = makeSupabaseRecorder([]);

  const response = await handlePushSend(
    request(
      { product: "erp", notification: { title: "Nova mensagem CRM" } },
      { Authorization: "Bearer service-role-key" },
    ),
    { createServiceClient: () => db.client },
  );

  assertEquals(response.status, 200);
});

Deno.test("push-send accepts service secret in apikey header", async () => {
  const db = makeSupabaseRecorder([]);

  const response = await handlePushSend(
    request(
      { product: "erp", notification: { title: "Nova mensagem CRM" } },
      { apikey: "service-role-key" },
    ),
    { createServiceClient: () => db.client },
  );

  assertEquals(response.status, 200);
});

Deno.test("push-send accepts service-role JWT for this project", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  Deno.env.set("SUPABASE_URL", "https://project-ref.supabase.co");
  const db = makeSupabaseRecorder([]);
  const payload = btoa(JSON.stringify({
    role: "service_role",
    ref: "project-ref",
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  try {
    const response = await handlePushSend(
      request(
        { product: "erp", notification: { title: "Nova mensagem CRM" } },
        { Authorization: `Bearer header.${payload}.signature` },
      ),
      { createServiceClient: () => db.client },
    );

    assertEquals(response.status, 200);
  } finally {
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);
  }
});

Deno.test("push-send rejects an invalid product", async () => {
  const db = makeSupabaseRecorder([]);

  const response = await handlePushSend(
    request({
      product: "other",
      notification: { title: "Nova mensagem CRM" },
    }, { "x-worker-secret": "worker-secret" }),
    { createServiceClient: () => db.client },
  );

  assertEquals(response.status, 400);
  assertEquals(db.selects.length, 0);
});

Deno.test("push-send filters active subscriptions by topic, store, and user", async () => {
  const db = makeSupabaseRecorder([]);

  const response = await handlePushSend(
    request({
      product: "crmplus",
      user_ids: ["user-1"],
      store_id: "store-1",
      topic: "crm_inbox",
      notification: { title: "Nova mensagem CRM" },
    }, { "x-worker-secret": "worker-secret" }),
    { createServiceClient: () => db.client },
  );

  assertEquals(response.status, 200);
  assertEquals(db.selects[0].filters, [["is_active", true], [
    "product",
    "crmplus",
  ]]);
  assertEquals(db.selects[0].inFilters, [["user_id", ["user-1"]]]);
  assertEquals(db.selects[0].contains, [["topics", ["crm_inbox"]]]);
});

Deno.test("push-send filters by store when user_ids are absent", async () => {
  const db = makeSupabaseRecorder([]);

  const response = await handlePushSend(
    request({
      product: "erp",
      store_id: "store-1",
      notification: { title: "Nova mensagem CRM" },
    }, { "x-worker-secret": "worker-secret" }),
    { createServiceClient: () => db.client },
  );

  assertEquals(response.status, 200);
  assertEquals(db.selects[0].filters, [["is_active", true], [
    "product",
    "erp",
  ], [
    "store_id",
    "store-1",
  ]]);
});

for (const status of [404, 410]) {
  Deno.test(`push-send deactivates expired subscriptions on ${status}`, async () => {
    const db = makeSupabaseRecorder([sub]);
    const deliveries: string[] = [];

    const response = await handlePushSend(
      request({
        product: "crmplus",
        topic: "crm_inbox",
        notification: { title: "Nova mensagem CRM" },
      }, { "x-worker-secret": "worker-secret" }),
      {
        createServiceClient: () => db.client,
        deliverPush: (subscription) => {
          deliveries.push(subscription.id);
          return Promise.resolve({ status });
        },
        now: () => "2026-05-15T12:00:00.000Z",
      },
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      ok: true,
      sent: 0,
      failed: 0,
      deactivated: 1,
    });
    assertEquals(deliveries, ["sub-1"]);
    assertEquals(db.updates[0].payload, {
      is_active: false,
      last_error_at: "2026-05-15T12:00:00.000Z",
      last_error_message: "Endpoint gone (404/410)",
    });
    assertEquals(db.updates[0].inFilters, [["id", ["sub-1"]]]);
  });
}

Deno.test("encryptPayload produces a valid RFC 8291 aes128gcm record decryptable by the receiver", async () => {
  // Simulate the browser-side ECDH key pair + auth secret from a real
  // PushSubscription (p256dh / auth keys).
  const receiverKp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const receiverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", receiverKp.publicKey),
  );
  const authSecret = crypto.getRandomValues(new Uint8Array(16));

  const p256dh = uint8ToUrlB64(receiverPublicRaw);
  const auth = uint8ToUrlB64(authSecret);
  const plaintext = JSON.stringify({ title: "Nova mensagem", body: "Olá!" });

  const record = await encryptPayload(plaintext, p256dh, auth);

  // ── Parse the aes128gcm header (RFC 8188 §2.1) ──
  const salt = record.slice(0, 16);
  const recordSize = (record[16] << 24) | (record[17] << 16) |
    (record[18] << 8) | record[19];
  const idLen = record[20];
  const senderPublicRaw = record.slice(21, 21 + idLen);
  const ciphertext = record.slice(21 + idLen);

  assertEquals(recordSize, 4096);
  assertEquals(idLen, 65); // uncompressed P-256 point

  // ── Re-derive ikm/cek/nonce as the user agent would (RFC 8291 §3.3-3.4) ──
  const senderKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(senderPublicRaw),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: senderKey },
      receiverKp.privateKey,
      256,
    ),
  );

  const ecdhHkdfKey = await crypto.subtle.importKey(
    "raw",
    ecdhSecret,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const ikmInfo = buildWebPushInfo(receiverPublicRaw, senderPublicRaw);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(authSecret),
        info: toArrayBuffer(ikmInfo),
      },
      ecdhHkdfKey,
      256,
    ),
  );

  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\x00");
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(cekInfo),
      },
      ikmKey,
      128,
    ),
  );
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\x00");
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(nonceInfo),
      },
      ikmKey,
      96,
    ),
  );

  const decKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "decrypt",
  ]);
  const decrypted = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      decKey,
      toArrayBuffer(ciphertext),
    ),
  );

  // Last byte is the RFC 8188 padding delimiter (0x02 = last record, no padding).
  assertEquals(decrypted[decrypted.length - 1], 0x02);
  const decoded = new TextDecoder().decode(decrypted.slice(0, -1));
  assertEquals(decoded, plaintext);
});

Deno.test("push-send logs transient delivery errors without deactivating subscriptions", async () => {
  const db = makeSupabaseRecorder([sub]);
  let attempts = 0;

  const response = await handlePushSend(
    request({
      product: "erp",
      notification: { title: "Nova mensagem CRM" },
    }, {
      "x-worker-secret": "worker-secret",
    }),
    {
      createServiceClient: () => db.client,
      deliverPush: () => {
        attempts++;
        return Promise.resolve({ status: 503 });
      },
      now: () => "2026-05-15T12:00:00.000Z",
      sleep: () => Promise.resolve(),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    sent: 0,
    failed: 1,
    deactivated: 0,
  });
  assertEquals(attempts, 3);
  assertEquals(db.updates[0].payload, {
    last_error_at: "2026-05-15T12:00:00.000Z",
    last_error_message: "HTTP 503",
  });
  assertEquals(db.updates[0].filters, [["id", "sub-1"]]);
});

Deno.test("push-send retries transient failures and succeeds once the push service recovers", async () => {
  const db = makeSupabaseRecorder([sub]);
  let attempts = 0;

  const response = await handlePushSend(
    request({
      product: "erp",
      notification: { title: "Nova mensagem CRM" },
    }, {
      "x-worker-secret": "worker-secret",
    }),
    {
      createServiceClient: () => db.client,
      deliverPush: () => {
        attempts++;
        return Promise.resolve({ status: attempts < 3 ? 503 : 201 });
      },
      now: () => "2026-05-15T12:00:00.000Z",
      sleep: () => Promise.resolve(),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    sent: 1,
    failed: 0,
    deactivated: 0,
  });
  assertEquals(attempts, 3);
  assertEquals(db.updates.length, 0);
});

Deno.test("push-send retries timeouts/network errors as transient failures", async () => {
  const db = makeSupabaseRecorder([sub]);
  let attempts = 0;

  const response = await handlePushSend(
    request({
      product: "erp",
      notification: { title: "Nova mensagem CRM" },
    }, {
      "x-worker-secret": "worker-secret",
    }),
    {
      createServiceClient: () => db.client,
      deliverPush: () => {
        attempts++;
        if (attempts < 2) return Promise.reject(new Error("network error"));
        return Promise.resolve({ status: 201 });
      },
      now: () => "2026-05-15T12:00:00.000Z",
      sleep: () => Promise.resolve(),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    sent: 1,
    failed: 0,
    deactivated: 0,
  });
  assertEquals(attempts, 2);
});

Deno.test("push-send records the final delivery exception on the subscription", async () => {
  const db = makeSupabaseRecorder([sub]);
  let attempts = 0;

  const response = await handlePushSend(
    request({
      product: "erp",
      notification: { title: "Diagnóstico Web Push" },
    }, {
      "x-worker-secret": "worker-secret",
    }),
    {
      createServiceClient: () => db.client,
      deliverPush: () => {
        attempts++;
        return Promise.reject(new Error("apple endpoint unreachable"));
      },
      now: () => "2026-06-22T18:45:00.000Z",
      sleep: () => Promise.resolve(),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    sent: 0,
    failed: 1,
    deactivated: 0,
  });
  assertEquals(attempts, 3);
  assertEquals(db.updates[0].payload, {
    last_error_at: "2026-06-22T18:45:00.000Z",
    last_error_message: "Delivery error: apple endpoint unreachable",
  });
  assertEquals(db.updates[0].filters, [["id", "sub-1"]]);
});

Deno.test("push-send labels VAPID signing failures before delivery", async () => {
  const db = makeSupabaseRecorder([sub]);

  const response = await handlePushSend(
    request({
      product: "erp",
      notification: { title: "Diagnóstico Web Push" },
    }, {
      "x-worker-secret": "worker-secret",
    }),
    {
      createServiceClient: () => db.client,
      now: () => "2026-06-22T18:50:00.000Z",
      sleep: () => Promise.resolve(),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    sent: 0,
    failed: 1,
    deactivated: 0,
  });
  const payload = db.updates[0].payload as {
    last_error_at: string;
    last_error_message: string;
  };
  assertEquals(payload.last_error_at, "2026-06-22T18:50:00.000Z");
  assertEquals(
    payload.last_error_message.startsWith("Delivery error: vapid_headers:"),
    true,
  );
  assertEquals(payload.last_error_message.includes("decoded_bytes="), true);
});

Deno.test("push-send accepts a PKCS8-encoded VAPID private key secret", async () => {
  const previousPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  );
  Deno.env.set("VAPID_PRIVATE_KEY", uint8ToUrlB64(pkcs8));

  try {
    const db = makeSupabaseRecorder([sub]);

    const response = await handlePushSend(
      request({
        product: "erp",
        notification: { title: "Diagnóstico Web Push" },
      }, {
        "x-worker-secret": "worker-secret",
      }),
      {
        createServiceClient: () => db.client,
        now: () => "2026-06-22T18:55:00.000Z",
        sleep: () => Promise.resolve(),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      ok: true,
      sent: 0,
      failed: 1,
      deactivated: 0,
    });
    const payload = db.updates[0].payload as {
      last_error_at: string;
      last_error_message: string;
    };
    assertEquals(payload.last_error_at, "2026-06-22T18:55:00.000Z");
    assertEquals(
      payload.last_error_message.startsWith(
        "Delivery error: payload_encryption:",
      ),
      true,
    );
  } finally {
    if (previousPrivate === undefined) Deno.env.delete("VAPID_PRIVATE_KEY");
    else Deno.env.set("VAPID_PRIVATE_KEY", previousPrivate);
  }
});

Deno.test("push-send accepts a raw VAPID private scalar with its public key", async () => {
  const previousPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const previousPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  Deno.env.set("VAPID_PRIVATE_KEY", String(privateJwk.d));
  Deno.env.set("VAPID_PUBLIC_KEY", uint8ToUrlB64(publicRaw));

  try {
    const db = makeSupabaseRecorder([sub]);

    const response = await handlePushSend(
      request({
        product: "erp",
        notification: { title: "Diagnóstico Web Push" },
      }, {
        "x-worker-secret": "worker-secret",
      }),
      {
        createServiceClient: () => db.client,
        now: () => "2026-06-22T19:00:00.000Z",
        sleep: () => Promise.resolve(),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      ok: true,
      sent: 0,
      failed: 1,
      deactivated: 0,
    });
    const payload = db.updates[0].payload as {
      last_error_at: string;
      last_error_message: string;
    };
    assertEquals(payload.last_error_at, "2026-06-22T19:00:00.000Z");
    assertEquals(
      payload.last_error_message.startsWith(
        "Delivery error: payload_encryption:",
      ),
      true,
    );
  } finally {
    if (previousPrivate === undefined) Deno.env.delete("VAPID_PRIVATE_KEY");
    else Deno.env.set("VAPID_PRIVATE_KEY", previousPrivate);
    if (previousPublic === undefined) Deno.env.delete("VAPID_PUBLIC_KEY");
    else Deno.env.set("VAPID_PUBLIC_KEY", previousPublic);
  }
});
