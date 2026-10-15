import { useCallback, useEffect, useState } from 'react';
import type { CareContract, CareIssueResult, CareQuote } from '../../lib/care/careTypes';
import {
  createCareContract,
  fetchQuoteForSaleItem,
  issueCareContract,
  listCareContractsForSale,
} from '../../services/careApi';

export type CareFlowStep = 'idle' | 'loading' | 'ready' | 'load-error' | 'submitting' | 'issued';

const LIVE_STATUSES = new Set(['rascunho', 'aguardando_assinatura', 'assinado_aguardando_primeiro_pagamento', 'ativo', 'suspenso']);

export interface CareContractFlow {
  step: CareFlowStep;
  quote: CareQuote | null;
  liveContract: CareContract | null;
  issued: CareIssueResult | null;
  loadError: string | null;
  submitError: string | null;
  reload: () => void;
  submit: () => Promise<void>;
  resend: () => Promise<void>;
}

interface SaleItemCareState {
  step: 'idle' | 'loading' | 'ready' | 'load-error';
  quote: CareQuote | null;
  liveContract: CareContract | null;
  loadError: string | null;
}

const INITIAL: SaleItemCareState = { step: 'idle', quote: null, liveContract: null, loadError: null };

// Carrega proposta + contrato vivo do aparelho; recarrega quando reloadKey muda.
function useSaleItemCareState(saleId: string, stockItemId: string | null, reloadKey: number): SaleItemCareState {
  const [state, setState] = useState<SaleItemCareState>(INITIAL);
  useEffect(() => {
    if (!stockItemId) return;
    let cancelled = false;
    setState((prev) => ({ ...prev, step: 'loading', loadError: null }));
    Promise.all([fetchQuoteForSaleItem(saleId, stockItemId), listCareContractsForSale(saleId)])
      .then(([quote, contracts]) => {
        const liveContract = contracts.find((c) => c.stock_item_id === stockItemId && LIVE_STATUSES.has(c.status)) ?? null;
        if (!cancelled) setState({ step: 'ready', quote, liveContract, loadError: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ ...INITIAL, step: 'load-error', loadError: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [saleId, stockItemId, reloadKey]);
  return state;
}

// Estado do fluxo "contratar Repasse Care+" para um aparelho de uma venda.
export function useCareContractFlow(saleId: string, stockItemId: string | null): CareContractFlow {
  const [reloadKey, setReloadKey] = useState(0);
  const loaded = useSaleItemCareState(saleId, stockItemId, reloadKey);
  const [issued, setIssued] = useState<CareIssueResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);

  useEffect(() => {
    setIssued(null);
    setSubmitError(null);
    setCreatedContractId(null);
  }, [stockItemId]);

  const runSubmitting = useCallback(async (contractId: () => Promise<string | null>) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const id = await contractId();
      if (!id) return;
      setCreatedContractId(id);
      setIssued(await issueCareContract(id));
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Não foi possível gerar o contrato.');
      // O contrato pode ter sido criado antes da falha no envio: recarrega para oferecer o reenvio.
      setReloadKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const submit = useCallback(
    () => runSubmitting(async () => (stockItemId ? await createCareContract(saleId, stockItemId) : null)),
    [runSubmitting, saleId, stockItemId],
  );
  const resend = useCallback(
    () => runSubmitting(async () => createdContractId ?? loaded.liveContract?.id ?? null),
    [createdContractId, loaded.liveContract, runSubmitting],
  );

  const step: CareFlowStep = submitting ? 'submitting' : issued ? 'issued' : loaded.step;
  return { ...loaded, step, issued, submitError, reload: () => setReloadKey((k) => k + 1), submit, resend };
}
