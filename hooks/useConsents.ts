import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { PRIVACY_POLICY_VERSION } from '../constants';

export type ConsentKey = 'privacy_accepted' | 'terms_accepted' | 'push';

interface ConsentRecord {
  consent_key: ConsentKey;
  granted: boolean;
  policy_version: string;
  granted_at: string;
  revoked_at: string | null;
}

interface UseConsentsReturn {
  loading: boolean;
  consents: ConsentRecord[];
  needsBanner: boolean;
  hasConsent: (key: ConsentKey) => boolean;
  grantConsents: (keys: ConsentKey[]) => Promise<void>;
  revokeConsent: (key: ConsentKey) => Promise<void>;
}

export function useConsents(userId: string | undefined): UseConsentsReturn {
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);

  const fetchConsents = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_consents')
      .select('consent_key, granted, policy_version, granted_at, revoked_at')
      .eq('user_id', userId);
    setConsents((data as ConsentRecord[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchConsents(); }, [fetchConsents]);

  const hasConsent = useCallback(
    (key: ConsentKey) =>
      consents.some(
        (c) =>
          c.consent_key === key &&
          c.granted &&
          c.revoked_at === null &&
          c.policy_version === PRIVACY_POLICY_VERSION
      ),
    [consents]
  );

  const needsBanner =
    !loading &&
    !!userId &&
    (!hasConsent('privacy_accepted') || !hasConsent('terms_accepted'));

  const grantConsents = useCallback(
    async (keys: ConsentKey[]) => {
      if (!userId) return;
      const now = new Date().toISOString();
      const rows = keys.map((key) => ({
        user_id: userId,
        consent_key: key,
        granted: true,
        policy_version: PRIVACY_POLICY_VERSION,
        granted_at: now,
        revoked_at: null,
        user_agent: navigator.userAgent.slice(0, 255),
      }));
      await supabase.from('user_consents').upsert(rows, {
        onConflict: 'user_id,consent_key,policy_version',
      });
      await fetchConsents();
    },
    [userId, fetchConsents]
  );

  const revokeConsent = useCallback(
    async (key: ConsentKey) => {
      if (!userId) return;
      await supabase
        .from('user_consents')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('consent_key', key)
        .eq('policy_version', PRIVACY_POLICY_VERSION);
      await fetchConsents();
    },
    [userId, fetchConsents]
  );

  return { loading, consents, needsBanner, hasConsent, grantConsents, revokeConsent };
}
