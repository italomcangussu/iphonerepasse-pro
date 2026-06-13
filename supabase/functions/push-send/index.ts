/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
} from "../_shared/crm.ts";
import { isPushProduct, type PushProduct } from "../_shared/push_topics.ts";

/**
 * push-send — send a Web Push notification to one or more users.
 *
 * Accepts POST with a service-role JWT OR a worker secret header.
 * Always requires `product` ('erp' | 'crmplus') so a send for one PWA can
 * never reach subscriptions of the other. Can additionally target by:
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
  product: PushProduct;
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
  /** Max delivery attempts per subscription (initial + retries) for 5xx/timeouts. Default 3. */
  maxAttempts?: number;
  /** Base delay for exponential backoff between retries, in ms. Default 500. */
  retryBaseDelayMs?: number;
  /** Injectable sleep, so tests can avoid real delays. */
  sleep?: (ms: number) => Promise<void>;
};

// ─── VAPID signing (native Web Crypto — no external dep) ─────────────────────

export function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function uint8ToUrlB64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
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

// ─── Encryption (aes128gcm + ECDH P-256) ────────────────────────────────────
// Implements RFC 8291 (Message Encryption for Web Push) using the RFC 8188
// "aes128gcm" content-coding: a single self-describing record containing
// salt + record size + sender public key (keyid) followed by the AES-GCM
// ciphertext. This is the scheme required by current browsers, including
// Safari/iOS — the older "aesgcm" draft-04 scheme (separate Encryption /
// Crypto-Key headers) is no longer accepted.

const AES128GCM_RECORD_SIZE = 4096;

/** RFC 8291 §3.4 key info: "WebPush: info\0" || ua_public || as_public */
export function buildWebPushInfo(
  receiverKey: Uint8Array,
  senderKey: Uint8Array,
): Uint8Array {
  const label = new TextEncoder().encode("WebPush: info\x00");
  const info = new Uint8Array(
    label.length + receiverKey.length + senderKey.length,
  );
  info.set(label, 0);
  info.set(receiverKey, label.length);
  info.set(senderKey, label.length + receiverKey.length);
  return info;
}

/**
 * Encrypts a push payload per RFC 8291, returning a complete "aes128gcm"
 * (RFC 8188) body: 16-byte salt + 4-byte record size + 1-byte key id length
 * + sender public key (keyid) + AES-128-GCM ciphertext (incl. 16-byte tag).
 */
export async function encryptPayload(
  payloadStr: string,
  p256dhB64: string,
  authB64: string,
): Promise<Uint8Array> {
  const payload = new TextEncoder().encode(payloadStr);
  const receiverPublicKey = urlB64ToUint8Array(p256dhB64);
  const authSecret = urlB64ToUint8Array(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral local (application server) ECDH key pair.
  const senderKp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const senderPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderKp.publicKey),
  );

  // Import receiver (user agent) public key.
  const receiverKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(receiverPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH shared secret between application server and user agent.
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: receiverKey },
      senderKp.privateKey,
      256,
    ),
  );

  // ikm = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_pub || as_pub, 32)
  const ecdhHkdfKey = await crypto.subtle.importKey(
    "raw",
    ecdhSecret,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const ikmInfo = buildWebPushInfo(receiverPublicKey, senderPublicRaw);
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

  // RFC 8188: derive content-encryption key and nonce from ikm + record salt.
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

  const encKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "encrypt",
  ]);

  // RFC 8188 padding: append a single delimiter octet. 0x02 marks the last
  // (only) record, with no further padding.
  const padded = new Uint8Array(payload.length + 1);
  padded.set(payload, 0);
  padded[payload.length] = 0x02;

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      encKey,
      padded,
    ),
  );

  // aes128gcm header: salt(16) || rs(4, BE) || idlen(1) || keyid(idlen)
  const header = new Uint8Array(16 + 4 + 1 + senderPublicRaw.length);
  header.set(salt, 0);
  header[16] = (AES128GCM_RECORD_SIZE >>> 24) & 0xff;
  header[17] = (AES128GCM_RECORD_SIZE >>> 16) & 0xff;
  header[18] = (AES128GCM_RECORD_SIZE >>> 8) & 0xff;
  header[19] = AES128GCM_RECORD_SIZE & 0xff;
  header[20] = senderPublicRaw.length;
  header.set(senderPublicRaw, 21);

  const result = new Uint8Array(header.length + ciphertext.length);
  result.set(header, 0);
  result.set(ciphertext, header.length);
  return result;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/** Push services occasionally hang; never let a single delivery block the function. */
const PUSH_FETCH_TIMEOUT_MS = 10_000;

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
  const encryptedBody = await encryptPayload(payloadJson, sub.p256dh, sub.auth);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUSH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        ...vapidHeaders,
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(encryptedBody.byteLength),
      },
      body: toArrayBuffer(encryptedBody),
      signal: controller.signal,
    });

    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Lock-screen-friendly limits — overly long strings get clipped by the OS
// anyway, and an empty title risks an invisible notification (iOS revocation).
const MAX_TITLE_LEN = 240;
const MAX_BODY_LEN = 480;

function clip(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Normalizes the notification payload, enforcing a non-empty title + limits. */
function normalizeNotification(notification: PushPayload): PushPayload {
  const title = clip(notification.title, MAX_TITLE_LEN) || "iPhoneRepasse Pro";
  return { ...notification, title, body: clip(notification.body, MAX_BODY_LEN) };
}

/** Best-effort telemetry to crm_event_log. Never throws into the send flow. */
async function logPushTelemetry(
  supabase: any,
  args: {
    storeId: string;
    product: PushProduct;
    topic?: string;
    eventType: "push_sent" | "push_failed" | "push_deactivated";
    count: number;
  },
): Promise<void> {
  if (!args.count || !args.storeId) return;
  try {
    await supabase.from("crm_event_log").insert({
      store_id: args.storeId,
      event_type: args.eventType,
      payload: {
        product: args.product,
        topic: args.topic ?? null,
        count: args.count,
      },
    });
  } catch (err) {
    console.warn("[push-send] telemetry insert failed", err);
  }
}

/**
 * Delivers with retry + exponential backoff for transient failures (5xx
 * responses, timeouts, network errors). 4xx/2xx responses return immediately
 * — only server-side/transport errors are retried.
 */
async function deliverWithRetry(
  sub: SubRow,
  payloadJson: string,
  vapid: { privateKey: string; publicKey: string; subject: string },
  deps: PushSendDeps,
): Promise<DeliveryResult> {
  const deliver = deps.deliverPush ?? deliverEncryptedPush;
  const maxAttempts = deps.maxAttempts ?? 3;
  const baseDelayMs = deps.retryBaseDelayMs ?? 500;
  const sleep = deps.sleep ?? defaultSleep;

  let lastResult: DeliveryResult | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await deliver(sub, payloadJson, vapid);
      if (res.status < 500) return res;
      lastResult = res;
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  if (lastResult) return lastResult;
  throw lastError;
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
  if (!isPushProduct(body.product)) {
    return jsonResponse({ error: "product must be 'erp' or 'crmplus'" }, 400);
  }

  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ??
    "mailto:admin@iphonerepasse.com.br";

  if (!vapidPrivate || !vapidPublic) {
    return jsonResponse({ error: "VAPID keys not configured" }, 500);
  }

  const supabase = (deps.createServiceClient ?? createServiceClient)();

  // Build subscription query. `product` is always required so a send for one
  // PWA can never reach subscriptions belonging to the other.
  let query = supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("is_active", true)
    .eq("product", body.product);

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

  const notifJson = JSON.stringify(normalizeNotification(body.notification));
  const results = { sent: 0, failed: 0, deactivated: 0 };
  const expiredIds: string[] = [];

  await Promise.all(
    (subs as SubRow[]).map(async (sub) => {
      try {
        const res = await deliverWithRetry(
          sub,
          notifJson,
          {
            privateKey: vapidPrivate,
            publicKey: vapidPublic,
            subject: vapidSubject,
          },
          deps,
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

  // Telemetry (best-effort, store-scoped sends only).
  if (body.store_id) {
    await Promise.all([
      logPushTelemetry(supabase, {
        storeId: body.store_id,
        product: body.product,
        topic: body.topic,
        eventType: "push_sent",
        count: results.sent,
      }),
      logPushTelemetry(supabase, {
        storeId: body.store_id,
        product: body.product,
        topic: body.topic,
        eventType: "push_failed",
        count: results.failed,
      }),
      logPushTelemetry(supabase, {
        storeId: body.store_id,
        product: body.product,
        topic: body.topic,
        eventType: "push_deactivated",
        count: results.deactivated,
      }),
    ]);
  }

  return jsonResponse({ ok: true, ...results });
}

if (Deno.env.get("DENO_TEST") !== "1") {
  Deno.serve((req) => handlePushSend(req));
}
