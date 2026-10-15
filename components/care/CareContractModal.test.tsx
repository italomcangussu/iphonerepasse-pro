import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CareContractModal from './CareContractModal';
import type { CareQuote } from '../../lib/care/careTypes';
import { Condition, type StockItem } from '../../types';

const api = vi.hoisted(() => ({
  fetchQuoteForSaleItem: vi.fn(),
  listCareContractsForSale: vi.fn(),
  createCareContract: vi.fn(),
  issueCareContract: vi.fn(),
}));
vi.mock('../../services/careApi', () => api);

const item = { id: 'si_1', model: 'iPhone 13', capacity: '128GB', color: 'Azul', imei: '111', condition: Condition.USED } as StockItem;

const okQuote: CareQuote = {
  ok: true, pendencias: [], model: 'iPhone 13', condition: 'SEMINOVO', salePrice: 2000, firstAmount: 199,
  bonuses: [{ benefitId: 'b', name: 'Kit capa + película', kind: 'kit', description: null, quantity: 1, deliveryCondition: null, referenceCost: 60 }],
  recurringPercent: 4, recurringPercentSource: 'CONDICAO', subsequentCount: 12, recurringAmount: 80, subsequentTotal: 960,
  totalProgrammed: 1159, totalCharges: 13, deductibleModality: 'PERCENTUAL', deductibleRate: 15, deductibleSource: 'MODELO_CONDICAO',
  deductibleBase: 2000, deductibleAmount: 300, billingIntervalMonths: 1, firstSubsequentDueMonths: 1, servicesDescription: null,
  usageLimits: null, customer: { id: 'c', name: 'Maria', cpf: null, phone: '85999990000' },
};

const renderModal = () =>
  render(
    <MemoryRouter>
      <CareContractModal open onClose={() => {}} sale={{ id: 'sa_1', items: [item], saleNumber: 7 }} />
    </MemoryRouter>,
  );

describe('CareContractModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listCareContractsForSale.mockResolvedValue([]);
  });

  it('mostra a proposta separada (1 inicial + N seguintes, origem e franquia) e envia para assinatura', async () => {
    api.fetchQuoteForSaleItem.mockResolvedValue(okQuote);
    api.createCareContract.mockResolvedValue('ct_1');
    api.issueCareContract.mockResolvedValue({ link: 'https://app/#/care/assinar/tok', sessionId: 's', documentVersion: 1, documentSha256: 'a', sent: true, sendError: null });
    renderModal();

    expect(await screen.findByText('Parcelas seguintes: 12×')).toBeInTheDocument();
    expect(screen.getByText('1 inicial + 12 seguinte(s) = 13 cobrança(s)')).toBeInTheDocument();
    expect(screen.getByText(/regra geral da condição/)).toBeInTheDocument();
    expect(screen.getByText(/regra específica do modelo/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Gerar contrato e enviar para assinatura/ }));
    expect(api.createCareContract).toHaveBeenCalledWith('sa_1', 'si_1');
    expect(api.issueCareContract).toHaveBeenCalledWith('ct_1');
    expect(await screen.findByText('Link de assinatura enviado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar link/ })).toBeInTheDocument();
  });

  it('bloqueia a contratação e lista as pendências quando falta regra', async () => {
    api.fetchQuoteForSaleItem.mockResolvedValue({ ...okQuote, ok: false, pendencias: ['Sem regra Repasse Care+ ativa para iPhone 13 seminovo.'] });
    renderModal();
    expect(await screen.findByText('Não dá para contratar ainda')).toBeInTheDocument();
    expect(screen.getByText(/Sem regra Repasse Care\+ ativa/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar contrato/ })).not.toBeInTheDocument();
  });

  it('com WhatsApp fora do ar, mantém o link para copiar e oferece reenvio', async () => {
    api.fetchQuoteForSaleItem.mockResolvedValue(okQuote);
    api.createCareContract.mockResolvedValue('ct_1');
    api.issueCareContract.mockResolvedValue({ link: 'https://app/#/care/assinar/tok', sessionId: 's', documentVersion: 1, documentSha256: 'a', sent: false, sendError: 'Nenhum canal WhatsApp ativo configurado.' });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /Gerar contrato/ }));
    expect(await screen.findByText('Contrato gerado, mas o WhatsApp não enviou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar/ })).toBeInTheDocument();
  });

  it('aparelho com contrato vivo mostra o status e permite reenviar o link', async () => {
    api.fetchQuoteForSaleItem.mockResolvedValue({ ...okQuote, ok: false, pendencias: ['Este aparelho já tem o contrato nº 3.'] });
    api.listCareContractsForSale.mockResolvedValue([{ id: 'ct_3', contract_number: 3, status: 'aguardando_assinatura', stock_item_id: 'si_1' }]);
    renderModal();
    expect(await screen.findByText('Contrato nº 3')).toBeInTheDocument();
    expect(screen.getByText('Aguardando assinatura')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Reenviar link de assinatura/ })).toBeEnabled());
  });
});
