export interface ReactionSummary {
  emoji: string;
  fromCustomer: boolean;
}

export type ReactionsMap = Map<string, ReactionSummary>;

export interface MessageLike {
  id: string;
  provider_message_id?: string | null;
  reaction_target_provider_message_id?: string | null;
  reaction_emoji?: string | null;
  direction: 'inbound' | 'outbound';
}

/**
 * Builds a map of provider_message_id → ReactionSummary for messages that
 * have a resolved target in the loaded list.
 * Also returns the set of message IDs that should be hidden (reaction rows
 * whose target is visible — they become badges on the target bubble instead).
 */
export function groupReactions(messages: MessageLike[]): {
  reactionsMap: ReactionsMap;
  hiddenIds: Set<string>;
} {
  const reactionsMap: ReactionsMap = new Map();
  const hiddenIds: Set<string> = new Set();

  // Build lookup: provider_message_id → id for quick target resolution
  const providerToId = new Map<string, string>();
  for (const msg of messages) {
    if (msg.provider_message_id) {
      providerToId.set(msg.provider_message_id, msg.id);
    }
  }

  for (const msg of messages) {
    if (!msg.reaction_target_provider_message_id) continue;

    const targetExists = providerToId.has(msg.reaction_target_provider_message_id);
    if (!targetExists) continue; // orphan — keep as legacy bubble

    // emoji === '' means the user removed their reaction — clear badge
    if (!msg.reaction_emoji) {
      reactionsMap.delete(msg.reaction_target_provider_message_id);
    } else {
      reactionsMap.set(msg.reaction_target_provider_message_id, {
        emoji: msg.reaction_emoji,
        fromCustomer: msg.direction === 'inbound',
      });
    }
    hiddenIds.add(msg.id);
  }

  return { reactionsMap, hiddenIds };
}
