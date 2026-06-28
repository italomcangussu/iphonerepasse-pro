import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationDrafts } from './useConversationDrafts';

describe('useConversationDrafts', () => {
  it('keeps a separate draft for each conversation', () => {
    const { result, rerender } = renderHook(
      ({ conversationId }) => useConversationDrafts(conversationId),
      { initialProps: { conversationId: 'maria' as string | null } },
    );

    act(() => result.current.setDraft('Rascunho da Maria'));
    rerender({ conversationId: 'joao' });
    act(() => result.current.setDraft('Rascunho do João'));
    rerender({ conversationId: 'maria' });

    expect(result.current.draft).toBe('Rascunho da Maria');
  });

  it('restores sent text after failure without overwriting newer input', () => {
    const { result } = renderHook(() => useConversationDrafts('maria'));

    act(() => result.current.restoreAfterFailure('Mensagem importante'));
    expect(result.current.draft).toBe('Mensagem importante');
    act(() => result.current.setDraft('Texto mais novo'));
    act(() => result.current.restoreAfterFailure('Mensagem antiga'));

    expect(result.current.draft).toBe('Texto mais novo');
  });
});
