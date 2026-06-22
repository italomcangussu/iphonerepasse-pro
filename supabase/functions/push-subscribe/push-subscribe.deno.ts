/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("DENO_TEST", "1");
Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

const { handlePushSubscribe } = await import("./index.ts");

function request(method: string, body?: Record<string, unknown>, jwt?: string) {
  return new Request("http://localhost/push-subscribe", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeSupabaseRecorder() {
  const calls: Array<
    {
      operation: string;
      table?: string;
      payload?: unknown;
      filters?: Array<[string, unknown]>;
    }
  > = [];

  const builder = (operation: string, payload?: unknown) => {
    const call = {
      operation,
      payload,
      filters: [] as Array<[string, unknown]>,
    };
    calls.push(call);
    const query = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return query;
      },
      then(resolve: (value: { error: null }) => void) {
        resolve({ error: null });
      },
    };
    return query;
  };

  return {
    calls,
    client: {
      from(table: string) {
        return {
          update(payload: unknown) {
            const query = builder("update", payload);
            calls[calls.length - 1].table = table;
            return query;
          },
          upsert(payload: unknown, options: unknown) {
            calls.push({
              operation: "upsert",
              table,
              payload: { payload, options },
              filters: [],
            });
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };
}

Deno.test("push-subscribe rejects missing bearer authorization", async () => {
  const response = await handlePushSubscribe(request("POST", {}), {
    createServiceClient: () => {
      throw new Error("service client should not be created");
    },
  });

  assertEquals(response.status, 401);
});

Deno.test("push-subscribe rejects incomplete subscription bodies", async () => {
  const response = await handlePushSubscribe(
    request("POST", { endpoint: "https://push.example/1" }, "valid-user-jwt"),
    {
      getUser: () => Promise.resolve({ id: "user-1" }),
    },
  );

  assertEquals(response.status, 400);
});

Deno.test("push-subscribe upserts a complete subscription for the authenticated user", async () => {
  const db = makeSupabaseRecorder();

  const response = await handlePushSubscribe(
    request("POST", {
      endpoint: "https://push.example/1",
      p256dh: "p256dh",
      auth: "auth",
      topics: ["crm_inbox"],
      store_id: "store-1",
      platform: "ios",
      user_agent: "Safari",
      product: "crmplus",
    }, "valid-user-jwt"),
    {
      createServiceClient: () => db.client,
      getUser: () => Promise.resolve({ id: "user-1" }),
      now: () => "2026-05-15T12:00:00.000Z",
    },
  );

  assertEquals(response.status, 200);
  assertEquals(db.calls[0].operation, "upsert");
  assertEquals(db.calls[0].table, "push_subscriptions");
  assertEquals(db.calls[0].payload, {
    payload: {
      user_id: "user-1",
      store_id: "store-1",
      endpoint: "https://push.example/1",
      p256dh: "p256dh",
      auth: "auth",
      user_agent: "Safari",
      platform: "ios",
      product: "crmplus",
      topics: ["crm_inbox"],
      is_active: true,
      last_seen_at: "2026-05-15T12:00:00.000Z",
    },
    options: { onConflict: "endpoint" },
  });
});

Deno.test("push-subscribe defaults product to erp and enables only sale notifications", async () => {
  const db = makeSupabaseRecorder();

  const response = await handlePushSubscribe(
    request("POST", {
      endpoint: "https://push.example/1",
      p256dh: "p256dh",
      auth: "auth",
    }, "valid-user-jwt"),
    {
      createServiceClient: () => db.client,
      getUser: () => Promise.resolve({ id: "user-1" }),
      now: () => "2026-05-15T12:00:00.000Z",
    },
  );

  assertEquals(response.status, 200);
  const payload = db.calls[0].payload as { payload: Record<string, unknown> };
  assertEquals(payload.payload.product, "erp");
  assertEquals(payload.payload.topics, ["sale"]);
});

Deno.test("push-subscribe rejects topics that don't belong to the product's catalog", async () => {
  const db = makeSupabaseRecorder();

  const response = await handlePushSubscribe(
    request("POST", {
      endpoint: "https://push.example/1",
      p256dh: "p256dh",
      auth: "auth",
      product: "erp",
      topics: ["crm_inbox", "sale"],
    }, "valid-user-jwt"),
    {
      createServiceClient: () => db.client,
      getUser: () => Promise.resolve({ id: "user-1" }),
      now: () => "2026-05-15T12:00:00.000Z",
    },
  );

  assertEquals(response.status, 400);
  assertEquals(db.calls.length, 0);
});

Deno.test("push-subscribe deactivates the authenticated user's endpoint on delete", async () => {
  const db = makeSupabaseRecorder();

  const response = await handlePushSubscribe(
    request("DELETE", { endpoint: "https://push.example/1" }, "valid-user-jwt"),
    {
      createServiceClient: () => db.client,
      getUser: () => Promise.resolve({ id: "user-1" }),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(db.calls[0].operation, "update");
  assertEquals(db.calls[0].payload, {
    is_active: false,
    last_error_message: "User unsubscribed",
  });
  assertEquals(db.calls[0].filters, [["user_id", "user-1"], [
    "endpoint",
    "https://push.example/1",
  ]]);
});
