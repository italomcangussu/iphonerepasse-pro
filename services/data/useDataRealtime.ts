import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type DataRealtimeRegistrar = (channel: RealtimeChannel) => RealtimeChannel;

export const useDataRealtime = (
  isAuthenticated: boolean,
  register: DataRealtimeRegistrar,
  scheduleResync: (reason: string, options?: { force?: boolean }) => void
): void => {
  useEffect(() => {
    if (!isAuthenticated) return;

    let degraded = false;
    const channel = register(supabase.channel('data-realtime'))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          degraded = true;
          console.warn('Supabase realtime degraded for data-realtime channel', { status });
          return;
        }

        if (status === 'SUBSCRIBED') {
          if (degraded) {
            degraded = false;
            scheduleResync('realtime-recovered');
          }
          return;
        }

        console.info('Supabase realtime status for data-realtime channel', { status });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, register, scheduleResync]);
};
