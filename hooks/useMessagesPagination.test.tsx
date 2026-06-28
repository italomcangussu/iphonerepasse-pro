import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMessagesPagination } from './useMessagesPagination';

const { limitMock } = vi.hoisted(() => ({ limitMock: vi.fn() }));

vi.mock('../services/supabase', () => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: limitMock,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);

  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    supabase: {
      from: vi.fn(() => query),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

describe('useMessagesPagination', () => {
  it('exposes and clears a recoverable initial-load error', async () => {
    limitMock
      .mockResolvedValueOnce({ data: null, error: new Error('offline') })
      .mockResolvedValueOnce({ data: [], error: null });

    const scrollRef = { current: null };
    const { result } = renderHook(() => useMessagesPagination('conversation-1', scrollRef));

    await waitFor(() => {
      expect(result.current.loadError).toBe('Não foi possível carregar as mensagens.');
    });

    await act(async () => {
      await result.current.retryInitial();
    });

    expect(result.current.loadError).toBeNull();
  });
});
