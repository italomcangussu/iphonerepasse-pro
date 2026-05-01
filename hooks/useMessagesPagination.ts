import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

const PAGE_SIZE = 50;

export interface PaginatedMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: string;
  content: string | null;
  created_at: string;
  sent_at?: string | null;
  status: string;
  media_url?: string | null;
  media_type?: string | null;
  provider_message_id?: string | null;
  error_message?: string | null;
  reply_to_provider_message_id?: string | null;
  reply_preview_text?: string | null;
  reaction_target_provider_message_id?: string | null;
  reaction_emoji?: string | null;
  webhook_payload?: Record<string, unknown> | null;
}

interface UseMessagesPaginationResult {
  messages: PaginatedMessage[];
  loadingInitial: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  newMessageCount: number;
  clearNewMessageCount: () => void;
  loadMore: () => Promise<void>;
  reload: (silent?: boolean) => Promise<void>;
}

const MESSAGE_FIELDS = `
  id, conversation_id, direction, sender_type, content,
  created_at, sent_at, status, media_url, media_type,
  provider_message_id, error_message,
  reply_to_provider_message_id, reply_preview_text,
  reaction_target_provider_message_id, reaction_emoji,
  webhook_payload
`.trim();

export function useMessagesPagination(
  conversationId: string | null,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
): UseMessagesPaginationResult {
  const [messages, setMessages] = useState<PaginatedMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const oldestCreatedAtRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);

  const loadInitial = useCallback(async (convId: string) => {
    setLoadingInitial(true);
    setMessages([]);
    setHasMore(false);
    setNewMessageCount(0);
    oldestCreatedAtRef.current = null;
    latestMessageIdRef.current = null;

    try {
      const { data, error } = await supabase
        .from('crm_messages')
        .select(MESSAGE_FIELDS)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      const rows = ((data || []) as unknown as PaginatedMessage[]).reverse();
      setMessages(rows);
      setHasMore((data?.length ?? 0) >= PAGE_SIZE);
      if (rows.length > 0) {
        oldestCreatedAtRef.current = rows[0].created_at;
        latestMessageIdRef.current = rows[rows.length - 1].id;
      }
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || !oldestCreatedAtRef.current || loadingOlder) return;

    setLoadingOlder(true);
    const container = scrollContainerRef.current;
    const scrollHeightBefore = container?.scrollHeight ?? 0;
    const scrollTopBefore = container?.scrollTop ?? 0;

    try {
      const { data, error } = await supabase
        .from('crm_messages')
        .select(MESSAGE_FIELDS)
        .eq('conversation_id', convId)
        .lt('created_at', oldestCreatedAtRef.current)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      const older = ((data || []) as unknown as PaginatedMessage[]).reverse();
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        oldestCreatedAtRef.current = older[0].created_at;
        setHasMore(older.length >= PAGE_SIZE);

        // Preserve scroll position after prepend
        requestAnimationFrame(() => {
          if (!container) return;
          const scrollHeightAfter = container.scrollHeight;
          container.scrollTop = scrollTopBefore + (scrollHeightAfter - scrollHeightBefore);
        });
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, scrollContainerRef]);

  const reload = useCallback(async (silent = false) => {
    const convId = conversationIdRef.current;
    if (!convId) return;

    try {
      const { data, error } = await supabase
        .from('crm_messages')
        .select(MESSAGE_FIELDS)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      const fresh = ((data || []) as unknown as PaginatedMessage[]).reverse();

      setMessages((prev) => {
        const prevLastId = prev[prev.length - 1]?.id;
        const freshLastId = fresh[fresh.length - 1]?.id;

        if (prevLastId === freshLastId) return prev; // nothing new

        // Count truly new messages (IDs not in prev)
        const prevIds = new Set(prev.map((m) => m.id));
        const newCount = fresh.filter((m) => !prevIds.has(m.id)).length;
        if (!silent && newCount > 0) {
          setNewMessageCount((c) => c + newCount);
        }

        if (fresh.length > 0) {
          latestMessageIdRef.current = fresh[fresh.length - 1].id;
        }
        return fresh;
      });
    } catch {
      // silent reload — swallow errors
    }
  }, []);

  const clearNewMessageCount = useCallback(() => setNewMessageCount(0), []);

  useEffect(() => {
    conversationIdRef.current = conversationId;
    if (conversationId) {
      void loadInitial(conversationId);
    } else {
      setMessages([]);
      setLoadingInitial(false);
      setHasMore(false);
      setNewMessageCount(0);
      oldestCreatedAtRef.current = null;
      latestMessageIdRef.current = null;
    }
  }, [conversationId, loadInitial]);

  return { messages, loadingInitial, loadingOlder, hasMore, newMessageCount, clearNewMessageCount, loadMore, reload };
}
