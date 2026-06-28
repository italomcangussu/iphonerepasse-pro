import { useCallback, useEffect, useRef, useState } from 'react';

export function useConversationDrafts(conversationId: string | null) {
  const [draft, setDraftState] = useState('');
  const draftsRef = useRef(new Map<string, string>());
  const activeConversationRef = useRef<string | null>(null);
  const draftRef = useRef('');

  const setDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraftState(value);
  }, []);

  const clearDraft = useCallback(() => setDraft(''), [setDraft]);

  const restoreAfterFailure = useCallback((sentText: string) => {
    if (!draftRef.current.trim()) setDraft(sentText);
  }, [setDraft]);

  useEffect(() => {
    const previousId = activeConversationRef.current;
    if (previousId && previousId !== conversationId) {
      draftsRef.current.set(previousId, draftRef.current);
    }

    const nextDraft = conversationId ? draftsRef.current.get(conversationId) || '' : '';
    activeConversationRef.current = conversationId;
    setDraft(nextDraft);
  }, [conversationId, setDraft]);

  return { draft, setDraft, clearDraft, restoreAfterFailure };
}
