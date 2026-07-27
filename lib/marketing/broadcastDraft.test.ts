import { describe, expect, it } from 'vitest';
import { buildBroadcastDraft } from './broadcastDraft';

describe('buildBroadcastDraft', () => {
  it('usa o contrato da tabela e restringe o rascunho a clientes CRM quando solicitado', () => {
    const draft = buildBroadcastDraft({
      storeId: 'store-1',
      name: '  Win-back de julho  ',
      messageTemplate: 'Olá! Temos uma oportunidade para você.',
      audience: 'customers',
    });

    expect(draft).toEqual({
      store_id: 'store-1',
      name: 'Win-back de julho',
      message_template: 'Olá! Temos uma oportunidade para você.',
      recipient_filters: { is_customer: true },
      status: 'draft',
    });
    expect(draft).not.toHaveProperty('message_text');
  });

  it('não grava filtros quando o público é toda a base CRM', () => {
    expect(
      buildBroadcastDraft({
        storeId: 'store-1',
        name: 'Novidades',
        messageTemplate: 'Novidades disponíveis hoje.',
        audience: 'all',
      }).recipient_filters
    ).toEqual({});
  });

  it('recusa placeholders que o worker de broadcast não sabe interpolar', () => {
    expect(() =>
      buildBroadcastDraft({
        storeId: 'store-1',
        name: 'Novidades',
        messageTemplate: 'Olá {nome}, temos novidades.',
        audience: 'all',
      })
    ).toThrow('Variáveis como {nome} ainda não são suportadas em broadcasts.');
  });
});
