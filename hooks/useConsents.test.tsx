import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsents } from './useConsents';
import { PRIVACY_POLICY_VERSION } from '../constants';
import { supabase } from '../services/supabase';

const eqMock = vi.fn();
const selectMock = vi.fn();
const upsertMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useConsents', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eqMock.mockResolvedValue({ data: [], error: null });
    selectMock.mockReturnValue({ eq: eqMock });
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
    });
    vi.mocked(supabase.from).mockImplementation(fromMock);
  });

  it('hides the banner after accepting privacy and terms consents', async () => {
    const { result } = renderHook(() => useConsents('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsBanner).toBe(true);

    await act(async () => {
      await result.current.grantConsents(['privacy_accepted', 'terms_accepted']);
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          consent_key: 'privacy_accepted',
          granted: true,
          policy_version: PRIVACY_POLICY_VERSION,
        }),
        expect.objectContaining({
          consent_key: 'terms_accepted',
          granted: true,
          policy_version: PRIVACY_POLICY_VERSION,
        }),
      ]),
      { onConflict: 'user_id,consent_key,policy_version' }
    );
    expect(result.current.needsBanner).toBe(false);
  });

  it('throws Supabase errors when accepting consents fails', async () => {
    const error = new Error('RLS rejected insert');
    upsertMock.mockResolvedValue({ error });

    const { result } = renderHook(() => useConsents('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.grantConsents(['privacy_accepted', 'terms_accepted']);
      })
    ).rejects.toThrow('RLS rejected insert');

    expect(result.current.needsBanner).toBe(true);
  });
});
