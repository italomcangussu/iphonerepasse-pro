/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
} from "../_shared/crm.ts";

/**
 * push-send — send a Web Push notification to one or more users.
 *
 * Accepts POST with a service-role JWT OR a worker secret header.
 * Can target by:
 *   - user_ids   string[]   — specific users
 *   - store_id   string     — all active subscribers in a store
 *   - topic      string     — all subscribers that include this topic
 *
 * VAPID secrets are read from environment:
 *   VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT
 *
 * Subscriptions that return HTTP 404/410 are marked is_active=false (expired).
 * Transient errors (5xx) are logged but not deactivated.
 */

type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
};

type SendBody = {
  user_ids?: string[];
  store_id?: string;
  topic?: string;
  notification: PushPayload;
};

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type DeliveryResult = { status: number };

type PushSendDeps = {
  createServiceClient?: () => any;
  deliverPush?: (sub: SubRow, payloadJson: string, vapid: {
    privateKey: string;
    publicKey: string;
    subject: string;
  }) => Promise<DeliveryResult>;
  now?: () => string;
};

// ─── VAPID signing (native Web Crypto — no external dep) ─────────────────────

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ToUrlB64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function buildVapidHeaders(
  endpoint: string,
  privateKeyB64: string,
  publicKeyB64: string,
  subject: string,
): Promise<Record<string, string>> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = uint8ToUrlB64(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const claims = uint8ToUrlB64(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: expiry, sub: subject }),
    ),
  );
  const sigInput = `${header}.${claims}`;

  const rawKey = urlB64ToUint8Array(privateKeyB64);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    // PKCS#8 wrapper around raw EC key — build it manually.
    buildPkcs8(rawKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(sigInput),
  );

  const token = `${sigInput}.${uint8ToUrlB64(new Uint8Array(sig))}`;
  return {
    Authorization: `vapid t=${token},k=${publicKeyB64}`,
    "Content-Type": "application/octet-stream",
    TTL: "86400",
  };
}

/** Wrap a raw 32-byte EC private scalar in a minimal PKCS#8 structure. */
function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // OID for id-ecPublicKey + P-256 namedCurve, then private key as ECPrivateKey DER.
  const oid = Uint8Array.from([
    0x30,
    0x41,
    0x02,
    0x01,
    0x00,
    0x30,
    0x13,
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01,
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07,
    0x04,
    0x27,
    0x30,
    0x25,
    0x02,
    0x01,
    0x01,
    0x04,
    0x20,
  ]);
  const buf = new Uint8Array(oid.length + rawKey.length);
  buf.set(oid);
  buf.set(rawKey, oid.length);
  return buf.buffer;
}

// ─── Encryption (AES-GCM + ECDH P-256) ──────────────────────────────────────
// Implements RFC 8291 (Web Push Message Encryption).

async function encryptPayload(
  payloadStr: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payload = new TextEncoder().encode(payloadStr);
  const receiverPublicKey = urlB64ToUint8Array(p256dhB64);
  const authSecret = urlB64ToUint8Array(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate local (sender) ECDH key pair.
  const senderKp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const senderPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderKp.publicKey),
  );

  // Import receiver public key.
  const receiverKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(receiverPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH.
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: receiverKey },
      senderKp.privateKey,
      256,
    ),
  );

  // HKDF for PRK.
  const hkdfKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);

  const authInfo = new TextEncoder().encode("Content-Encoding: auth\x00");
  const prk = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(authSecret),
        info: authInfo,
      },
      hkdfKey,
      256,
    ),
  );

  // Derive cek and nonce.
  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, [
    "deriveBits",
  ]);
  const keyInfo = buildInfo("aesgcm", receiverPublicKey, senderPublicRaw);
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(keyInfo),
      },
      prkKey,
      128,
    ),
  );
  const nonceInfo = buildInfo("nonce", receiverPublicKey, senderPublicRaw);
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(nonceInfo),
      },
      prkKey,
      96,
    ),
  );

  const encKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "encrypt",
  ]);

  // Pad payload to 3054 bytes (typical max before splitting needed).
  const padded = new Uint8Array(payload.length + 2);
  padded[0] = 0;
  padded[1] = 0; // 0-padding
  padded.set(payload, 2);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    encKey,
    padded,
  );

  return {
    body: new Uint8Array(encrypted),
    salt,
    localPublicKey: senderPublicRaw,
  };
}

function buildInfo(
  type: string,
  receiverKey: Uint8Array,
  senderKey: Uint8Array,
): Uint8Array {
  const label = new TextEncoder().encode(`Content-Encoding: ${type}\x00`);
  const info = new Uint8Array(
    label.length + 1 + 2 + receiverKey.length + 2 + senderKey.length,
  );
  let offset = 0;
  info.set(label, offset);
  offset += label.length;
  info[offset++] = 0x41; // "P-256\0"
  info[offset++] = Math.floor(receiverKey.length / 256);
  info[offset++] = receiverKey.length % 256;
  info.set(receiverKey, offset);
  offset += receiverKey.length;
  info[offset++] = Math.floor(senderKey.length / 256);
  info[offset++] = senderKey.length % 256;
  info.set(senderKey, offset);
  return info;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function deliverEncryptedPush(
  sub: SubRow,
  payloadJson: string,
  vapid: { privateKey: string; publicKey: string; subject: string },
): Promise<DeliveryResult> {
  const vapidHeaders = await buildVapidHeaders(
    sub.endpoint,
    vapid.privateKey,
    vapid.publicKey,
    vapid.subject,
  );
  const { body: encBody, salt, localPublicKey } = await encryptPayload(
    payloadJson,
    sub.p256dh,
    sub.auth,
  );

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      ...vapidHeaders,
      "Encryption": `salt=${uint8ToUrlB64(salt)}`,
      "Crypto-Key": `dh=${uint8ToUrlB64(localPublicKey)};${
        vapidHeaders["Authorization"].replace("vapid t=", "p256ecdsa=").split(
          ",k=",
        )[0]
      }`,
      "Content-Encoding": "aesgcm",
      "Content-Length": String(encBody.byteLength),
    },
    body: toArrayBuffer(encBody),
  });

  return { status: res.status };
}

export async function handlePushSend(
  req: Request,
  deps: PushSendDeps = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Authenticate via service-role key OR worker secret.
  const workerSecret = Deno.env.get("PUSH_WORKER_SECRET");
  const reqSecret = req.headers.get("x-worker-secret");
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isWorker = Boolean(workerSecret) && reqSecret === workerSecret;
  const isServiceRole = Boolean(serviceRoleKey) &&
    authHeader === `Bearer ${serviceRoleKey}`;

  if (!isWorker && !isServiceRole) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const body = await parseJsonBody<SendBody>(req);
  if (!body?.notification?.title) {
    return jsonResponse({ error: "notification.title required" }, 400);
  }

  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ??
    "mailto:admin@iphonerepasse.com.br";

  if (!vapidPrivate || !vapidPublic) {
    return jsonResponse({ error: "VAPID keys not configured" }, 500);
  }

  const supabase = (deps.createServiceClient ?? createServiceClient)();

  // Build subscription query.
  let query = supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("is_active", true);

  if (body.user_ids?.length) {
    query = query.in("user_id", body.user_ids);
  } else if (body.store_id) {
    query = query.eq("store_id", body.store_id);
  }
  if (body.topic) {
    query = query.contains("topics", [body.topic]);
  }

  const { data: subs, error: fetchErr } = await query;
  if (fetchErr) return jsonResponse({ error: fetchErr.message }, 500);
  if (!subs?.length) return jsonResponse({ ok: true, sent: 0 });

  const notifJson = JSON.stringify(body.notification);
  const results = { sent: 0, failed: 0, deactivated: 0 };
  const expiredIds: string[] = [];

  await Promise.all(
    (subs as SubRow[]).map(async (sub) => {
      try {
        const res = await (deps.deliverPush ?? deliverEncryptedPush)(
          sub,
          notifJson,
          {
            privateKey: vapidPrivate,
            publicKey: vapidPublic,
            subject: vapidSubject,
          },
        );

        if (res.status === 201 || res.status === 200 || res.status === 202) {
          results.sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription expired or gone.
          expiredIds.push(sub.id);
          results.deactivated++;
        } else {
          console.warn(`[push-send] ${sub.endpoint} → HTTP ${res.status}`);
          await supabase.from("push_subscriptions").update({
            last_error_at: (deps.now ?? (() => new Date().toISOString()))(),
            last_error_message: `HTTP ${res.status}`,
          }).eq("id", sub.id);
          results.failed++;
        }
      } catch (err) {
        console.error(`[push-send] delivery error for ${sub.id}:`, err);
        results.failed++;
      }
    }),
  );

  // Bulk-deactivate expired subs.
  if (expiredIds.length) {
    await supabase.from("push_subscriptions")
      .update({
        is_active: false,
        last_error_at: (deps.now ?? (() => new Date().toISOString()))(),
        last_error_message: "Endpoint gone (404/410)",
      })
      .in("id", expiredIds);
  }

  return jsonResponse({ ok: true, ...results });
}

if (Deno.env.get("DENO_TEST") !== "1") {
  Deno.serve((req) => handlePushSend(req));
}
