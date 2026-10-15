import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareSignPage from './CareSignPage';
import type { CareSignView } from '../../lib/care/careSignTypes';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../services/careApi', () => {
  class CareRequestError extends Error {
    constructor(message: string, public code: string | null = null) {
      super(message);
    }
  }
  return { invokeCareFunction: invoke, CareRequestError };
});

const view = (status: CareSignView['session']['status'], viewed = false): CareSignView => ({
  session: { status, viewed, linkExpiresAt: '2026-10-18T00:00:00Z', signedAt: status === 'assinada' ? '2026-10-15T13:00:00Z' : null, otpPending: false, resendAvailableAt: null },
  otp: { length: 6, ttlMinutes: 5, phoneMasked: '*******0000' },
  acceptance: { version: 'ACEITE-2026.10-v1', text: 'Li e concordo com o contrato Repasse Care+ nº 9 (documento versão 1, cláusulas RC-2026.10-v1) e quero assinar eletronicamente.' },
  document: { version: 1, sha256: 'a'.repeat(64), url: 'https://files/contrato.pdf', signedUrl: status === 'assinada' ? 'https://files/assinado.pdf' : null },
  contract: {
    number: 9, status: 'aguardando_assinatura', contractor: 'iPhone Repasse',
    customer: { name: 'Maria Silva', cpfMasked: '***.456.***-01', phoneMasked: '*******0000' },
    device: { model: 'iPhone 13', capacity: '128GB', color: 'Azul', imeiMasked: '••••5678', condition: 'SEMINOVO' },
    values: { salePrice: 2000, firstAmount: 199, recurringPercent: 4, subsequentCount: 12, recurringAmount: 80, totalProgrammed: 1159, billingIntervalMonths: 1, firstSubsequentDueMonths: 1, deductibleModality: 'PERCENTUAL', deductibleRate: 15, deductibleAmount: 300, termMonths: 13 },
    bonuses: [{ name: 'Kit capa + película', quantity: 1, description: null }],
    servicesDescription: null, usageLimits: null,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/care/assinar/tok']}>
      <Routes><Route path="/care/assinar/:token" element={<CareSignPage />} /></Routes>
    </MemoryRouter>,
  );

describe('CareSignPage', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('exige ler, aceitar sem pré-marcação e digitar o código de 6 dígitos para assinar', async () => {
    let signed = false;
    invoke.mockImplementation(async (_fn: string, body: { action: string }) => {
      if (body.action === 'open') return signed ? view('assinada') : view('aberta');
      if (body.action === 'send_otp') return { phoneMasked: '*******0000', resendAvailableAt: new Date(Date.now() + 60000).toISOString() };
      if (body.action === 'verify_otp') { signed = true; return { signed: true }; }
      return {};
    });
    renderPage();

    expect(await screen.findByText('Assistência técnica continuada')).toBeInTheDocument();
    expect(screen.getByText(/Não é seguro/)).toBeInTheDocument();
    const accept = screen.getByRole('button', { name: /Aceitar e receber o código/ });
    expect(accept).toBeDisabled();

    await userEvent.click(screen.getByRole('link', { name: /Abrir contrato completo/ }));
    expect(invoke).toHaveBeenCalledWith('care-sign-public', { token: 'tok', action: 'viewed' });
    const agree = await screen.findByRole('checkbox', { name: /Li e concordo com o contrato/ });
    expect(agree).not.toBeChecked();
    expect(accept).toBeDisabled();

    await userEvent.click(agree);
    await userEvent.click(accept);
    expect(invoke).toHaveBeenCalledWith('care-sign-public', { token: 'tok', action: 'accept', accepted: true, geo: { permission: 'nao_compartilhada' } });

    const input = await screen.findByLabelText('Código de assinatura');
    await userEvent.type(input, '12a3456');
    expect(input).toHaveValue('123456');
    await userEvent.click(screen.getByRole('button', { name: /Assinar contrato/ }));
    expect(invoke).toHaveBeenCalledWith('care-sign-public', { token: 'tok', action: 'verify_otp', code: '123456', geo: { permission: 'nao_compartilhada' } });
    expect(await screen.findByText('Contrato assinado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Baixar contrato assinado/ })).toHaveAttribute('href', 'https://files/assinado.pdf');
  });

  it('mostra erro de código incorreto sem sair da etapa', async () => {
    const { CareRequestError } = await import('../../services/careApi');
    invoke.mockImplementation(async (_fn: string, body: { action: string }) => {
      if (body.action === 'open') return { ...view('aceita', true), session: { ...view('aceita', true).session, otpPending: true } };
      if (body.action === 'verify_otp') throw new CareRequestError('Código incorreto. Você tem mais 4 tentativa(s).', 'otp_invalido');
      return {};
    });
    renderPage();
    await userEvent.type(await screen.findByLabelText('Código de assinatura'), '000000');
    await userEvent.click(screen.getByRole('button', { name: /Assinar contrato/ }));
    expect(await screen.findByText('Código incorreto. Você tem mais 4 tentativa(s).')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de assinatura')).toBeInTheDocument();
  });

  it('link substituído mostra orientação em vez do contrato', async () => {
    const { CareRequestError } = await import('../../services/careApi');
    invoke.mockRejectedValue(new CareRequestError('Este link foi substituído por um mais recente.', 'revogado'));
    renderPage();
    expect(await screen.findByText('Não é possível assinar por este link')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Assistência técnica continuada')).not.toBeInTheDocument());
  });
});
