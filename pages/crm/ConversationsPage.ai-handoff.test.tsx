import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('pages/crm/ConversationsPage.tsx', 'utf8');

describe('ConversationsPage AI handoff UI contract', () => {
  it('contains transfer-pending priority, assume, transfer, and composer guard states', () => {
    expect(source).toContain('transferencia_pendente');
    expect(source).toContain('Transferência pendente');
    expect(source).toContain('Assumir atendimento da IA');
    expect(source).toContain('Transferir para IA');
    expect(source).toContain('A IA está respondendo');
    expect(source).toContain('crm-conversation-handoff');
  });

  it('locks the composer while a transfer is pending until the agent assumes', () => {
    // Transfer-pending must also lock the composer, not only AI-handling.
    expect(source).toContain('selectedComposerLocked');
    expect(source).toContain('selectedIsAIHandling || selectedTransferPending');
    // Send paths must bail out while a transfer is pending.
    expect(source).toContain('Clique em "Assumir" para começar a responder este atendimento.');
    // The textarea is gated on the combined lock, not just AI-handling.
    expect(source).toContain('disabled={selectedComposerLocked}');
    // Assuming flips the lead out of the pending state.
    expect(source).toContain('em_atendimento_humano');
  });
});
