/// <reference lib="deno.ns" />
import {
  buildSaleNotificationBody,
  buildSalePushRequest,
  handleSalesNotify,
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
    throw new Error(`Expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
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

const postReq = (body: unknown) =>
  new Request("https://x/functions/v1/sales-notify", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// deno-lint-ignore no-explicit-any
const fakeClient = () => ({}) as any;
const allowAuth = async () => ({ userId: "u1", role: "admin" as const });

Deno.test("buildSaleNotificationBody formats seller, amount and customer", () => {
  assertEquals(
    buildSaleNotificationBody({ seller_name: "João", total: 1200, customer_name: "Maria" }),
    "João • R$ 1.200,00 — Maria",
  );
});

Deno.test("buildSaleNotificationBody falls back to a generic body without amount", () => {
  assertEquals(
    buildSaleNotificationBody({ customer_name: "Maria" }),
    "Venda para Maria",
  );
  assertEquals(buildSaleNotificationBody({}), "Venda para cliente");
});

Deno.test("buildSalePushRequest returns null without Supabase env", async () => {
  await withEnv({ SUPABASE_URL: null, SUPABASE_SERVICE_ROLE_KEY: null }, () => {
    assertEquals(buildSalePushRequest({ sale_id: "s1", total: 100 }), null);
  });
});

Deno.test("buildSalePushRequest tags product=erp topic=sale and the sale deep link", async () => {
  await withEnv(
    { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" },
    () => {
      const request = buildSalePushRequest({ sale_id: "s1", total: 100, customer_name: "Ana" });
      if (!request) throw new Error("expected a request");
      assertEquals(request.endpoint, "https://proj.supabase.co/functions/v1/push-send");
      const payload = JSON.parse(String(request.init.body));
      assertEquals(payload.product, "erp");
      assertEquals(payload.topic, "sale");
      assertEquals(payload.notification.url, "/#/finance");
      assertStringIncludes(payload.notification.tag, "erp-sale-s1");
      // No store scoping — both stores are operated with shared access.
      assertEquals("store_id" in payload, false);
    },
  );
});

Deno.test("handleSalesNotify rejects unauthenticated callers with 403", async () => {
  const response = await handleSalesNotify(postReq({ sale_id: "s1" }), {
    createServiceClient: fakeClient,
    authenticate: async () => {
      throw new Error("nope");
    },
  });
  assertEquals(response.status, 403);
});

Deno.test("handleSalesNotify relays to push-send and reports sent", async () => {
  await withEnv(
    { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" },
    async () => {
      let calledUrl = "";
      let calledAuth = "";
      const response = await handleSalesNotify(postReq({ sale_id: "s1", total: 50 }), {
        createServiceClient: fakeClient,
        authenticate: allowAuth,
        fetchImpl: async (url, init) => {
          calledUrl = String(url);
          calledAuth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
          return new Response(JSON.stringify({ ok: true, sent: 1 }), { status: 200 });
        },
      });
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { ok: true, sent: true });
      assertEquals(calledUrl, "https://proj.supabase.co/functions/v1/push-send");
      assertEquals(calledAuth, "Bearer svc");
    },
  );
});

Deno.test("handleSalesNotify never fails the sale when push-send errors", async () => {
  await withEnv(
    { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" },
    async () => {
      const response = await handleSalesNotify(postReq({ sale_id: "s1", total: 50 }), {
        createServiceClient: fakeClient,
        authenticate: allowAuth,
        fetchImpl: async () => new Response("boom", { status: 500 }),
      });
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { ok: true, sent: false });
    },
  );
});
