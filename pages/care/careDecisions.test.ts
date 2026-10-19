import { describe, expect, it } from 'vitest';
import { signatureActions } from './contract/SignatureSection';
import { conditionRuleProblem } from './rules/ConditionRulesSection';
import { footerActions } from '../../components/care/CareContractModal';
import type { CareDocument } from '../../lib/care/careTypes';

const doc = (patch: Partial<CareDocument>): CareDocument => ({
  id: 'd', version: 1, sha256: 'a', size_bytes: 1, status: 'emitido', issued_at: '', signed_at: null, signed_pdf_sha256: null, evidence_sha256: null, ...patch,
});

describe('decisões da interface do Repasse Care+', () => {
  it('vendedor não acessa dossiê nem integridade; reenvio só antes de assinar', () => {
    expect(signatureActions({ status: 'aguardando_assinatura' }, doc({}), false)).toEqual(['original', 'resend']);
    expect(signatureActions({ status: 'ativo' }, doc({ status: 'assinado', signed_pdf_sha256: 'b', evidence_sha256: 'c' }), false)).toEqual(['original', 'signed']);
    expect(signatureActions({ status: 'ativo' }, doc({ status: 'assinado', signed_pdf_sha256: 'b', evidence_sha256: 'c' }), true)).toEqual(['original', 'signed', 'evidence', 'verify']);
    expect(signatureActions({ status: 'assinado_aguardando_primeiro_pagamento' }, doc({ status: 'assinado' }), true)).toEqual(['original', 'verify', 'regenerate']);
    expect(signatureActions({ status: 'rascunho' }, null, false)).toEqual(['resend']);
  });

  it('regra geral não salva franquia sem valor nem percentual acima de 100', () => {
    expect(conditionRuleProblem('4', '', '')).toBeNull();
    expect(conditionRuleProblem('', 'VALOR_FIXO', '')).toBe('Informe o valor da franquia.');
    expect(conditionRuleProblem('101', '', '')).toBe('Percentuais vão até 100%.');
    expect(conditionRuleProblem('4', 'PERCENTUAL', '150')).toBe('Percentuais vão até 100%.');
    expect(conditionRuleProblem('4', 'VALOR_FIXO', '150')).toBeNull();
  });

  it('rodapé do modal tem uma ação primária por estado', () => {
    const issued = { link: 'l', sessionId: 's', documentVersion: 1, documentSha256: 'a', sent: true, sendError: null };
    expect(footerActions({ issued, liveContract: null, quote: null })).toEqual(['copy', 'close']);
    expect(footerActions({ issued: { ...issued, sent: false }, liveContract: null, quote: null })).toEqual(['copy', 'retry-send']);
    expect(footerActions({ issued: null, liveContract: { status: 'ativo' } as never, quote: null })).toEqual(['close']);
    expect(footerActions({ issued: null, liveContract: { status: 'aguardando_assinatura' } as never, quote: null })).toEqual(['resend']);
    expect(footerActions({ issued: null, liveContract: null, quote: { ok: true } as never })).toEqual(['create']);
  });
});

describe('suspensão', () => {
  it('reativação só depois de quitar as parcelas vencidas', async () => {
    const { hasOverdueInstallments } = await import('./contract/SuspensionSection');
    const inst = (status: 'programada' | 'paga', due: string | null) => ({ status, due_date: due }) as never;
    expect(hasOverdueInstallments([inst('programada', '2026-10-01')], '2026-10-19')).toBe(true);
    expect(hasOverdueInstallments([inst('paga', '2026-10-01'), inst('programada', '2026-11-01')], '2026-10-19')).toBe(false);
    expect(hasOverdueInstallments([inst('programada', null)], '2026-10-19')).toBe(false);
  });
});
