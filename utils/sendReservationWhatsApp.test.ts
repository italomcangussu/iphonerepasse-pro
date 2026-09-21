import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('../services/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) }
  }
}));

import { sendReservationWhatsApp } from './sendReservationWhatsApp';

describe('sendReservationWhatsApp', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('normalizes the phone and forwards the resolved message', async () => {
    await sendReservationWhatsApp({
      phone: '(85) 99999-0000',
      storeId: 'store-1',
      content: 'Olá Maria! Sua reserva foi concluída.',
      customerName: 'Maria Cliente',
      reservationId: 'res-1',
      stockItemId: 'stk-1'
    });

    expect(invokeMock).toHaveBeenCalledWith('send-reservation-whatsapp', {
      body: {
        phone: '5585999990000',
        storeId: 'store-1',
        content: 'Olá Maria! Sua reserva foi concluída.',
        customerName: 'Maria Cliente',
        reservationId: 'res-1',
        stockItemId: 'stk-1'
      }
    });
  });

  it('refuses to call the edge function without a message', async () => {
    await expect(sendReservationWhatsApp({ phone: '85999990000', storeId: 'store-1', content: '  ' }))
      .rejects.toThrow('A mensagem da reserva está vazia.');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('refuses invalid phones', async () => {
    await expect(sendReservationWhatsApp({ phone: '123', storeId: 'store-1', content: 'oi' }))
      .rejects.toThrow('Telefone inválido para envio via WhatsApp.');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('surfaces the edge function error payload', async () => {
    invokeMock.mockResolvedValue({ data: { error: 'Nenhum canal WhatsApp ativo configurado para esta loja.' }, error: null });

    await expect(sendReservationWhatsApp({ phone: '85999990000', storeId: 'store-1', content: 'oi' }))
      .rejects.toThrow('Nenhum canal WhatsApp ativo configurado para esta loja.');
  });
});
