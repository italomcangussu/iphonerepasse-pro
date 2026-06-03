# CRM UAZ Lead Avatar WebP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store UAZAPI lead avatars as optimized WebP files in Supabase Storage
from the inbound webhook, only once per lead.

**Architecture:** Add a guarded avatar sync helper inside
`crm-uaz-webhook-receiver` and call it after `upsert_crm_lead` resolves the
lead. The helper skips missing payload avatars and already-updated leads,
downloads only when needed, converts through WASM ImageMagick, uploads to
`crm-media`, and updates `crm_leads`.

**Tech Stack:** Supabase Edge Functions, Deno, Supabase JS Storage API,
`npm:@imagemagick/magick-wasm@0.0.30`, existing Deno tests.

---

### Task 1: Avatar Sync Tests

**Files:**

- Modify:
  `supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts`
- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`

- [ ] **Step 1: Add failing tests for avatar path helpers**

Add tests that import the future helpers:

```ts
import {
  buildCrmPushNotificationRequest,
  buildLeadAvatarStoragePath,
  sendCrmPushNotification,
  syncLeadAvatarFromPayload,
} from "./index.ts";
```

Test cases:

```ts
Deno.test("lead avatar storage path is deterministic and webp", () => {
  assertEquals(
    buildLeadAvatarStoragePath({ storeId: "sobral", leadId: "lead/1" }),
    "avatars/sobral/lead%2F1.webp",
  );
});

Deno.test("lead avatar sync skips when payload has no avatar URL", async () => {
  const calls: string[] = [];
  const supabase = {
    from: () => {
      calls.push("from");
      throw new Error("should_not_query_lead_without_avatar");
    },
  };

  const result = await syncLeadAvatarFromPayload({
    supabase,
    storeId: "store-1",
    leadId: "lead-1",
    channelId: "channel-1",
    payload: { chat: { name: "Maria" } },
    avatarUrl: null,
    fetchImpl: () => {
      throw new Error("should_not_fetch_without_avatar");
    },
    convertToWebp: async () => new Uint8Array([1]),
  });

  assertEquals(result, {
    synced: false,
    skipped: true,
    reason: "avatar_url_missing",
  });
  assertEquals(calls, []);
});

Deno.test("lead avatar sync skips when lead avatar was already updated", async () => {
  let fetched = false;
  const supabase = createAvatarSupabaseMock({
    leadRow: {
      avatar_url: "https://cdn.example.com/avatar.webp",
      avatar_lead_updated: true,
    },
  });

  const result = await syncLeadAvatarFromPayload({
    supabase,
    storeId: "store-1",
    leadId: "lead-1",
    channelId: "channel-1",
    payload: { avatarUrl: "https://example.com/source.jpg" },
    avatarUrl: "https://example.com/source.jpg",
    fetchImpl: () => {
      fetched = true;
      return Promise.resolve(new Response());
    },
    convertToWebp: async () => new Uint8Array([1]),
  });

  assertEquals(result, {
    synced: false,
    skipped: true,
    reason: "avatar_already_updated",
  });
  assertEquals(fetched, false);
});

Deno.test("lead avatar sync uploads webp and marks lead updated", async () => {
  const uploaded: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const supabase = createAvatarSupabaseMock({
    leadRow: { avatar_url: null, avatar_lead_updated: false },
    uploaded,
    updates,
  });

  const result = await syncLeadAvatarFromPayload({
    supabase,
    storeId: "store-1",
    leadId: "lead/1",
    channelId: "channel-1",
    payload: { avatarUrl: "https://example.com/source.jpg" },
    avatarUrl: "https://example.com/source.jpg",
    fetchImpl: () =>
      Promise.resolve(
        new Response(new Uint8Array([255, 216, 255]), {
          headers: { "Content-Type": "image/jpeg", "Content-Length": "3" },
        }),
      ),
    convertToWebp: async (bytes) => {
      assertEquals(Array.from(bytes), [255, 216, 255]);
      return new Uint8Array([82, 73, 70, 70]);
    },
  });

  assertEquals(result.synced, true);
  assertEquals(uploaded[0].bucket, "crm-media");
  assertEquals(uploaded[0].path, "avatars/store-1/lead%2F1.webp");
  assertEquals(updates[0].patch.avatar_lead_updated, true);
  assertEquals(
    String(updates[0].patch.avatar_url).includes(
      "/crm-media/avatars/store-1/lead%2F1.webp",
    ),
    true,
  );
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
deno test --allow-env --allow-net --allow-read supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

Expected: FAIL because `buildLeadAvatarStoragePath` and
`syncLeadAvatarFromPayload` are not exported.

### Task 2: Avatar Sync Implementation

**Files:**

- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`

- [ ] **Step 1: Add WASM ImageMagick imports**

Add:

```ts
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";
```

- [ ] **Step 2: Add exported helpers**

Add helpers for path creation, bounded image download, WebP conversion, and
best-effort sync:

```ts
export const buildLeadAvatarStoragePath = (
  args: { storeId: string; leadId: string },
): string =>
  `avatars/${encodeURIComponent(args.storeId)}/${
    encodeURIComponent(args.leadId)
  }.webp`;
```

`syncLeadAvatarFromPayload` must:

- return `avatar_url_missing` before querying Supabase when no avatar URL is
  supplied;
- select `avatar_url, avatar_lead_updated` from `crm_leads`;
- skip if `avatar_lead_updated` is true;
- download only image responses up to 5 MB;
- convert to WebP with a 320px max dimension and quality 80;
- upload to `crm-media`;
- update the lead with Storage public URL, `avatar_lead_updated: true`, and
  `updated_at`;
- catch and log errors, returning
  `{ synced: false, skipped: false, reason: "avatar_sync_failed" }`.

- [ ] **Step 3: Wire helper into webhook**

Replace the existing direct `avatar_url` update block with:

```ts
await syncLeadAvatarFromPayload({
  supabase,
  storeId,
  leadId: resolvedLeadId,
  channelId: String(channel.id),
  payload: body,
  avatarUrl: groupInfo.isGroup ? null : extractUazLeadAvatarUrl(body),
});
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
deno test --allow-env --allow-net --allow-read supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

Expected: PASS.

### Task 3: Supabase Preflight and Deployment

**Files:**

- No code file expected unless deployment validation finds a missing migration.

- [ ] **Step 1: Validate local Supabase identity**

Run:

```bash
ROOT="$(git rev-parse --show-toplevel)"
python3 "/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/local_supabase_env.py" --project-root "$ROOT" --format summary
```

Then compare the MCP project URL from `mcp__supabase.get_project_url` with the
local project ref.

- [ ] **Step 2: Deploy only pending Edge Function**

If tests pass and project identity matches, deploy `crm-uaz-webhook-receiver`
using the guarded local environment:

```bash
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$ROOT" -- supabase functions deploy crm-uaz-webhook-receiver
```

- [ ] **Step 3: Check logs/advisors**

Fetch recent Edge Function logs through MCP. If no migration was added, no DB
push is needed. If a migration becomes necessary during implementation, apply it
only after the same identity guard passes.

### Task 4: Final Verification

**Files:**

- Modify: any files touched during implementation.

- [ ] **Step 1: Run focused tests**

```bash
deno test --allow-env --allow-net --allow-read supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

- [ ] **Step 2: Inspect git diff**

```bash
git diff -- supabase/functions/crm-uaz-webhook-receiver/index.ts supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

- [ ] **Step 3: Report deployment result**

Report whether deploy ran, whether migrations were needed, and any remaining
risk.
