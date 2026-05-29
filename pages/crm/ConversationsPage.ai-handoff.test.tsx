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
});
