import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export type ConsentKey = 'analytics' | 'marketing' | 'push';

export type ConsentsState = Record<ConsentKey, boolean>;

const DEFAULT_CONSENTS: ConsentsState = {
  analytics: false,
  marketing: false,
  push: false,
};

export const useConsents = (userId: string | undefined) => {
  const [consents, setConsents] = useState<ConsentsState>(DEFAULT_CONSENTS);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConsents = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('user_consents')
        .select('consent_key, granted')
        .eq('user_id', userId);
      if (data) {
        const next = { ...DEFAULT_CONSENTS };
        for (const row of data) {
          const key = row.consent_key as ConsentKey;
          if (key in next) next[key] = Boolean(row.granted);
        }
        setConsents(next);
      }
    } catch {
      // silently fail — consents are a best-effort feature
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchConsents();
  }, [fetchConsents]);

  const hasConsent = useCallback((key: ConsentKey) => consents[key], [consents]);

  const grantConsents = useCallback(
    async (keys: ConsentKey[]) => {
      if (!userId) return;
      const rows = keys.map((consent_key) => ({
        user_id: userId,
        consent_key,
        granted: true,
        granted_at: new Date().toISOString(),
      }));
      await supabase.from('user_consents').upsert(rows, { onConflict: 'user_id,consent_key' });
      setConsents((prev) => {
        const next = { ...prev };
        for (const k of keys) next[k] = true;
        return next;
      });
    },
    [userId]
  );

  const revokeConsent = useCallback(
    async (key: ConsentKey) => {
      if (!userId) return;
      await supabase
        .from('user_consents')
        .update({ granted: false, revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('consent_key', key);
      setConsents((prev) => ({ ...prev, [key]: false }));
    },
    [userId]
  );

  // needsBanner = true when the user has never seen the consent banner
  const needsBanner = !userId || (!consents.analytics && !consents.marketing);

  return { needsBanner, hasConsent, grantConsents, revokeConsent, consents, isLoading };
};
