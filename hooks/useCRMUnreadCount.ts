import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

async function fetchTotalUnread(): Promise<number> {
  const { data } = await supabase.from('crm_conversations').select('unread_count');
  if (!data) return 0;
  return data.reduce((acc, c) => acc + Number(c.unread_count || 0), 0);
}

export function useCRMUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    void fetchTotalUnread().then((count) => {
      if (mountedRef.current) setUnreadCount(count);
    });

    const channel = supabase
      .channel('crm-unread-badge')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_conversations' }, () => {
        void fetchTotalUnread().then((count) => {
          if (mountedRef.current) setUnreadCount(count);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_conversations' }, (payload) => {
        const count = Number((payload.new as { unread_count?: number }).unread_count || 0);
        setUnreadCount((prev) => prev + count);
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return unreadCount;
}
