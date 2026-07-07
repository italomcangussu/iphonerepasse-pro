import {
  buildLeadAvatarStoragePath,
  syncUazLeadAvatar,
} from "./uazLeadAvatar.ts";

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
  removals?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  updateError?: string;
};

const resolvedMutation = (
  patch: Record<string, unknown>,
  sink?: Record<string, unknown>[],
  errorMessage?: string,
) => {
  const filters: Array<{ column: string; value: unknown }> = [];
  const query = {
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return query;
    },
    then(resolve: (value: { error: { message: string } | null }) => void) {
      sink?.push({ patch, filters: [...filters] });
      resolve({ error: errorMessage ? { message: errorMessage } : null });
    },
  };
  return query;
};

const createSupabaseMock = (options: MockOptions) => ({
  from(table: string) {
    if (table === "crm_leads") {
      return {
        select() {
          const query = {
            eq() {
              return query;
            },
            maybeSingle: () =>
              Promise.resolve({ data: options.leadRow, error: null }),
          };
          return query;
        },
        update(patch: Record<string, unknown>) {
          return resolvedMutation(patch, options.updates, options.updateError);
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
        remove(paths: string[]) {
          options.removals?.push({ bucket, paths });
          return Promise.resolve({ data: paths, error: null });
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

Deno.test("lead avatar storage path avoids URL-encoded phone identifiers", () => {
  const path = buildLeadAvatarStoragePath({
    storeId: "st-cae5b9ed-d4e6-405f-9151-1c80542992ec",
    leadId: "+558899249356-st-cae5b9ed-d4e6-405f-9151-1c80542992ec",
  });

  assert(path.startsWith("avatars/st-cae5b9ed-d4e6-405f-9151-1c80542992ec/"), "expected store-scoped avatar path");
  assert(path.endsWith(".webp"), "expected webp extension");
  assert(!path.includes("%"), "storage key must not contain URL-encoded bytes");
  assert(!path.includes("+"), "storage key must not contain raw phone prefix");
  assert(!path.includes("558899249356"), "storage key must not expose the phone-like lead id");
});

Deno.test("avatar sync ignores webhook URL and resolves the source through UAZ chat details", async () => {
  const updates: Record<string, unknown>[] = [];
  const fetchedUrls: string[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: null,
        avatar_last_checked_at: null,
        avatar_refreshed_at: null,
      },
      updates,
    }),
    payloadAvatarUrl: "http://127.0.0.1/internal-metadata",
    fetchImpl: (input) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url.endsWith("/chat/details")) {
        return Promise.resolve(
          new Response(JSON.stringify({
            imagePreview: "https://pps.whatsapp.net/fresh.jpg",
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(new Uint8Array([255, 216, 255]), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
    },
  });

  assertEquals(result.status, "synced");
  assert(!fetchedUrls.some((url) => url.includes("127.0.0.1")), "must not fetch webhook-provided URL");
  assert(fetchedUrls.some((url) => url.endsWith("/chat/details")), "must resolve avatar through UAZ");
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
        avatar_storage_path: "avatars/store-1/lead-old.webp",
        avatar_missing_count: 0,
        avatar_missing_since: null,
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
    avatar_missing_count: 1,
    avatar_missing_since: "2026-06-28T12:00:00.000Z",
    updated_at: "2026-06-28T12:00:00.000Z",
  });
  assertEquals((events.at(-1)?.payload as Record<string, unknown>).status, "missing");
});

Deno.test("second confirmed missing image clears the lead avatar and stored object", async () => {
  const updates: Record<string, unknown>[] = [];
  const removals: Record<string, unknown>[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: "https://project.supabase.co/old.webp?v=1",
        avatar_storage_path: "avatars/store-1/lead-old.webp",
        avatar_content_hash: "old-hash",
        avatar_missing_count: 1,
        avatar_missing_since: "2026-06-27T12:00:00.000Z",
        avatar_last_checked_at: "2026-06-27T12:00:00.000Z",
        avatar_refreshed_at: "2026-06-20T12:00:00.000Z",
      },
      updates,
      removals,
    }),
    payloadAvatarUrl: null,
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify({ image: "", imagePreview: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })),
  });

  assertEquals(result.status, "removed");
  assertEquals((updates[0].patch as Record<string, unknown>).avatar_url, null);
  assertEquals((updates[0].patch as Record<string, unknown>).avatar_storage_path, null);
  assertEquals(removals, [{ bucket: "crm-media", paths: ["avatars/store-1/lead-old.webp"] }]);
});

Deno.test("lead update failure is retried instead of reporting a completed missing check", async () => {
  const removals: Record<string, unknown>[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: "https://project.supabase.co/old.webp?v=1",
        avatar_storage_path: "avatars/store-1/lead-old.webp",
        avatar_missing_count: 1,
        avatar_last_checked_at: "2026-06-27T12:00:00.000Z",
      },
      updateError: "database unavailable",
      removals,
    }),
    payloadAvatarUrl: null,
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify({ image: "", imagePreview: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })),
  });

  assertEquals(result.status, "failed");
  assertEquals(result.errorCode, "avatar_lead_update_failed");
  assertEquals(removals, []);
});

Deno.test("identical normalized avatar updates check state without uploading", async () => {
  const normalized = new Uint8Array([82, 73, 70, 70]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", normalized)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const updates: Record<string, unknown>[] = [];
  const uploads: Record<string, unknown>[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({
      leadRow: {
        avatar_url: "https://project.supabase.co/current.webp?v=1",
        avatar_storage_path: "avatars/store-1/lead-current.webp",
        avatar_content_hash: hash,
        avatar_missing_count: 0,
        avatar_last_checked_at: null,
        avatar_refreshed_at: "2026-06-20T12:00:00.000Z",
      },
      updates,
      uploads,
    }),
    payloadAvatarUrl: null,
    fetchImpl: (input) => String(input).endsWith("/chat/details")
      ? Promise.resolve(new Response(JSON.stringify({ imagePreview: "https://pps.whatsapp.net/current.jpg" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      : Promise.resolve(new Response(new Uint8Array([255, 216, 255]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })),
  });

  assertEquals(result.status, "unchanged");
  assertEquals(uploads.length, 0);
  const patch = updates[0].patch as Record<string, unknown>;
  assertEquals(patch.avatar_url, undefined);
  assertEquals(patch.avatar_last_checked_at, "2026-06-28T12:00:00.000Z");
  assertEquals(patch.avatar_missing_count, 0);
});

Deno.test("avatar lead mutations are scoped by lead and store", async () => {
  const updates: Record<string, unknown>[] = [];
  await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({
      leadRow: { avatar_url: null, avatar_last_checked_at: null, avatar_missing_count: 0 },
      updates,
    }),
    payloadAvatarUrl: null,
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify({ image: "", imagePreview: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })),
  });

  const filters = updates[0].filters as Array<{ column: string; value: unknown }>;
  assert(filters.some((filter) => filter.column === "id" && filter.value === "lead-1"), "lead filter missing");
  assert(filters.some((filter) => filter.column === "store_id" && filter.value === "store-1"), "store filter missing");
});

Deno.test("unsafe avatar host returned by UAZ is rejected before download", async () => {
  const fetchedUrls: string[] = [];
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({ leadRow: { avatar_url: null, avatar_last_checked_at: null } }),
    payloadAvatarUrl: null,
    fetchImpl: (input) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url.endsWith("/chat/details")) {
        return Promise.resolve(new Response(JSON.stringify({ imagePreview: "https://127.0.0.1/private" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }
      return Promise.resolve(new Response(new Uint8Array([255, 216, 255]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }));
    },
  });

  assertEquals(result.status, "failed");
  assertEquals(result.errorCode, "avatar_unsafe_host");
  assertEquals(fetchedUrls, ["https://iatende.uazapi.com/chat/details"]);
});

Deno.test("chat details lookup has an abort timeout", async () => {
  const result = await syncUazLeadAvatar({
    ...baseArgs,
    force: true,
    supabase: createSupabaseMock({ leadRow: { avatar_url: null, avatar_last_checked_at: null } }),
    payloadAvatarUrl: null,
    providerTimeoutMs: 1,
    fetchImpl: (_input, init) => {
      if (!init?.signal) throw new Error("missing_abort_signal");
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    },
  } as Parameters<typeof syncUazLeadAvatar>[0]);

  assertEquals(result.status, "failed");
  assertEquals(result.errorCode, "uaz_chat_details_timeout");
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
