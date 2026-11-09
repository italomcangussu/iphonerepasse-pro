import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RESERVATION_MESSAGE_TEMPLATE,
  RESERVATION_MESSAGE_VARIABLES,
  buildReservationMessageToken,
  renderReservationMessage,
} from './reservationMessage';

const fullContext = {
  customerName: 'Maria Cliente',
  model: 'iPhone 16',
  capacity: '256 GB',
  color: 'Branco',
  sellPrice: 6700,
  depositAmount: 500,
  depositPaymentMethod: 'Pix',
  tradeIn: { description: 'iPhone 11 64GB', value: 1200 },
  expiresAt: '2026-09-30T00:00:00+00:00',
  storeName: 'Loja Centro',
  sellerName: 'João Vendedor',
};

describe('renderReservationMessage', () => {
  it('resolves every reservation variable of the default template', () => {
    const message = renderReservationMessage(DEFAULT_RESERVATION_MESSAGE_TEMPLATE, fullContext);

    expect(message).toContain('Olá Maria Cliente!');
    expect(message).toContain('iPhone 16 256 GB Branco');
    expect(message).toContain('Entrada recebida: R$ 500,00 (Pix)');
    expect(message).toContain('Seu iPhone 11 64GB na troca: R$ 1.200,00');
    expect(message).toContain('Valor restante: R$ 5.000,00');
    expect(message).toContain('até 30/09/2026');
    expect(message).not.toMatch(/\{\{|\}\}/);
  });

  it('drops the lines whose variables have no value in this reservation', () => {
    const message = renderReservationMessage(DEFAULT_RESERVATION_MESSAGE_TEMPLATE, {
      ...fullContext,
      depositAmount: null,
      depositPaymentMethod: null,
      tradeIn: null,
      expiresAt: null,
    });

    expect(message).toContain('Olá Maria Cliente!');
    expect(message).not.toContain('Entrada recebida');
    expect(message).not.toContain('Separamos o aparelho');
    // Sem sinal, o restante é o preço cheio e a linha continua valendo.
    expect(message).toContain('Valor restante: R$ 6.700,00');
  });

  it('lists each deposit with its method and subtracts deposits and trade-in from the price', () => {
    const message = renderReservationMessage(DEFAULT_RESERVATION_MESSAGE_TEMPLATE, {
      ...fullContext,
      depositParts: [
        { amount: 500, method: 'Pix' },
        { amount: 300, method: 'Dinheiro' },
      ],
    });

    expect(message).toContain('Entrada recebida: R$ 500,00 (Pix) + R$ 300,00 (Dinheiro)');
    expect(message).toContain('Valor restante: R$ 4.700,00');
    expect(renderReservationMessage('{{sinal}} ({{forma_sinal}})', {
      depositParts: [{ amount: 500, method: 'Pix' }, { amount: 300, method: 'Dinheiro' }],
    })).toBe('R$ 800,00 (Pix + Dinheiro)');
  });

  it('keeps custom text and resolves only the known tokens', () => {
    const message = renderReservationMessage(
      'Oi {{cliente}}, seu {{modelo}} {{cor}} está reservado. {{desconhecido}}',
      fullContext
    );

    expect(message).toBe('Oi Maria Cliente, seu iPhone 16 Branco está reservado.');
  });

  it('exposes every variable as a button-insertable token', () => {
    RESERVATION_MESSAGE_VARIABLES.forEach((variable) => {
      const message = renderReservationMessage(
        `x ${buildReservationMessageToken(variable.token)}`,
        fullContext
      );
      expect(message.startsWith('x ')).toBe(true);
      expect(message).not.toMatch(/\{\{|\}\}/);
      expect(message.length).toBeGreaterThan(2);
    });
  });

  it('never leaks tokens when the reservation has no data at all', () => {
    const message = renderReservationMessage(DEFAULT_RESERVATION_MESSAGE_TEMPLATE, {});

    expect(message).not.toMatch(/\{\{|\}\}/);
    expect(message).toBe('Qualquer dúvida, é só chamar por aqui. 😉');
  });
});
