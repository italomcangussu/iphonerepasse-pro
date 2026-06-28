import { syncUazLeadAvatar } from "./uazLeadAvatar.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

type MockOptions = {
  leadRow: Record<string, unknown>;
  updates?: Record<string, unknown>[];
  uploads?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
};

const createSupabaseMock = (options: MockOptions) => ({
  from(table: string) {
    if (table === "crm_leads") {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({ data: options.leadRow, error: null }),
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              options.updates?.push({ patch, column, value });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    }

    if (table === "crm_event_log") {
      return {
        insert(row: Record<string, unknown>) {
          options.events?.push(row);
          return Promise.resolve({ error: null });
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
          uploadOptions: Record<string, unknown>,
        ) {
          options.uploads?.push({
            bucket,
            path,
            bytes: Array.from(bytes),
            options: uploadOptions,
          });
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
});

const baseArgs = {
  storeId: "store-1",
  leadId: "lead-1",
  channelId: "channel-1",
  conversationId: "conversation-1",
  talkId: "5585999999999@s.whatsapp.net",
  channel: {
    api_endpoint: "https://iatende.uazapi.com",
    uaz_subdomain: "iatende",
    uaz_instance_token: "instance-token",
  },
  trigger: "inbound_webhook" as const,
  now: new Date("2026-06-28T12:00:00.000Z"),
  convertToWebp: async () => new Uint8Array([82, 73, 70, 70]),
};

Deno.test("avatar sync skips a recent check unless force is enabled", async () => {
  let fetchCalls = 0;
  const leadRow = {
    avatar_url: "https://project.supabase.co/avatar.webp?v=1",
    avatar_last_checked_at: "2026-06-28T11:00:00.000Z",
    avatar_refreshed_at: "2026-06-28T11:00:00.000Z",
  };

  const skipped = await syncUazLeadAvatar({
    ...baseArgs,
    supabase: createSupabaseMock({ leadRow }),
    payloadAvatarUrl: null,
    fetchImpl: () => {
      fetchCalls += 1;
      return Promise.resolve(new Response());
    },
  });

  assertEquals(skipped.status, "skipped_cooldown");
  assertEquals(fetchCalls, 0);
});

Deno.test("direct webhook avatar populates an empty lead during cooldown", async () => {
  const updates: Record<string, unknown>[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: null,
        avatar_last_checked_at: "2026-06-28T11:00:00.000Z",
        avatar_refreshed_at: null,
      },
      updates,
    }),
    payloadAvatarUrl: "https://pps.whatsapp.net/direct.jpg",
    fetchImpl: () =>
      Promise.resolve(
        new Response(new Uint8Array([255, 216, 255]), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
  });

  assertEquals(result.status, "synced");
  const patch = updates[0].patch as Record<string, unknown>;
  assertEquals(patch.avatar_last_checked_at, "2026-06-28T12:00:00.000Z");
  assertEquals(patch.avatar_refreshed_at, "2026-06-28T12:00:00.000Z");
  assert(
    String(patch.avatar_url).endsWith(".webp?v=1782648000000"),
    "expected cache-busted public avatar URL",
  );
});

Deno.test("missing provider image records the check without erasing a stored avatar", async () => {
  const updates: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: "https://project.supabase.co/old.webp?v=1",
        avatar_last_checked_at: null,
        avatar_refreshed_at: "2026-06-20T12:00:00.000Z",
      },
      updates,
      events,
    }),
    payloadAvatarUrl: null,
    fetchImpl: (_input, init) => {
      assertEquals(init?.method, "POST");
      return Promise.resolve(
        new Response(JSON.stringify({ image: "", imagePreview: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  });

  assertEquals(result.status, "missing");
  const patch = updates[0].patch as Record<string, unknown>;
  assertEquals(patch, {
    avatar_last_checked_at: "2026-06-28T12:00:00.000Z",
    updated_at: "2026-06-28T12:00:00.000Z",
  });
  assertEquals((events.at(-1)?.payload as Record<string, unknown>).status, "missing");
});

Deno.test("expired preview URL retries once with full chat details", async () => {
  const updates: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const detailBodies: Record<string, unknown>[] = [];

  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    trigger: "backfill",
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: null,
        avatar_last_checked_at: null,
        avatar_refreshed_at: null,
      },
      updates,
      events,
    }),
    payloadAvatarUrl: null,
    fetchImpl: (input, init) => {
      const url = String(input);
      if (url.endsWith("/chat/details")) {
        const body = JSON.parse(String(init?.body || "{}"));
        detailBodies.push(body);
        const image = body.preview
          ? "https://pps.whatsapp.net/expired.jpg"
          : "https://pps.whatsapp.net/fresh.jpg";
        return Promise.resolve(
          new Response(JSON.stringify({ imagePreview: image, image }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("expired.jpg")) {
        return Promise.resolve(new Response("expired", { status: 403 }));
      }
      if (url.includes("fresh.jpg")) {
        return Promise.resolve(
          new Response(new Uint8Array([255, 216, 255]), {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          }),
        );
      }
      throw new Error(`unexpected_fetch:${url}`);
    },
  });

  assertEquals(result.status, "synced");
  assertEquals(result.retriedAfterExpiry, true);
  assertEquals(detailBodies, [
    { number: "5585999999999", preview: true },
    { number: "5585999999999", preview: false },
  ]);
  assertEquals(
    events.map((event) =>
      (event.payload as Record<string, unknown>).status
    ),
    ["expired", "synced"],
  );
});
