import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  'pages/crm/ConversationsPage.tsx',
  'components/crm/ConversationsListPanel.tsx',
  'components/crm/ConversationListItem.tsx',
  'components/crm/ConversationMessagesPanel.tsx',
  'components/crm/conversationUi.ts',
].map((path) => readFileSync(path, 'utf8')).join('\n');

describe('ConversationsPage AI handoff UI contract', () => {
  it('contains transfer-pending priority, assume, transfer, and composer guard states', () => {
    expect(source).toContain('transferencia_pendente');
    expect(source).toContain('Transferência pendente');
    expect(source).toContain('Assumir atendimento da IA');
    expect(source).toContain('Transferir para IA');
    expect(source).toContain('A IA está respondendo');
    expect(source).toContain('crm-conversation-handoff');
  });

  it('exposes transfer-to-AI from the mobile lead options menu as well as the desktop header', () => {
    const transferLabels = source.match(/Transferir para IA/g) || [];
    const configureLabels = source.match(/Configurar webhook IA/g) || [];

    expect(transferLabels.length).toBeGreaterThanOrEqual(2);
    expect(configureLabels.length).toBeGreaterThanOrEqual(2);
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

  it('does not create a nested vertical scroller inside the message groups', () => {
    // `overflow-x-hidden` computes the other axis to `auto` in browsers, which
    // makes the message group own an invisible vertical scroll and leaves the
    // latest bubble hidden behind the composer.
    expect(source).toContain('space-y-4 overflow-x-clip');
    expect(source).toContain('gap-1.5 overflow-x-clip');
    expect(source).not.toContain('space-y-4 overflow-x-hidden');
    expect(source).not.toContain('gap-1.5 overflow-x-hidden');
  });
});
