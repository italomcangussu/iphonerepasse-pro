import { describe, expect, it } from "vitest";
import {
  applyLeadAvatarUpdate,
  buildRealtimeStoreFilter,
  type ConversationRow,
} from "./conversationUi";

const rows: ConversationRow[] = [{
  id: "conversation-1",
  lead_id: "lead-1",
  channel_id: "channel-1",
  status: "open",
  unread_count: 0,
  message_count: 1,
  last_message_at: null,
  store_id: "store-1",
  crm_leads: {
    id: "lead-1",
    name: "Maria",
    phone: "+5585999999999",
    avatar_url: null,
  },
}];

describe("applyLeadAvatarUpdate", () => {
  it("patches only conversations for the updated lead", () => {
    const next = applyLeadAvatarUpdate(rows, {
      id: "lead-1",
      avatar_url: "https://cdn.example/avatar.webp?v=2",
    });
    expect(next[0].crm_leads?.avatar_url).toBe(
      "https://cdn.example/avatar.webp?v=2",
    );
    expect(next).not.toBe(rows);
  });

  it("preserves the array when the lead is not loaded", () => {
    expect(applyLeadAvatarUpdate(rows, {
      id: "lead-2",
      avatar_url: "https://cdn.example/other.webp?v=2",
    })).toBe(rows);
  });
});

describe("buildRealtimeStoreFilter", () => {
  it("deduplicates and sorts valid tenant ids", () => {
    expect(buildRealtimeStoreFilter(["store-b", "store-a", "store-b", ""])).toBe(
      "store_id=in.(store-a,store-b)",
    );
  });

  it("never emits an unfiltered or injectable subscription", () => {
    expect(buildRealtimeStoreFilter([])).toBeNull();
    expect(buildRealtimeStoreFilter(["store-1),store_id=neq.safe"])).toBeNull();
  });
});
