import { useCallback, useEffect, useState } from 'react';
import { CareRequestError, invokeCareFunction } from '../../../services/careApi';
import { captureGeo, type GeoEvidenceInput } from '../../../lib/care/captureGeo';
import type { CareSignView } from '../../../lib/care/careSignTypes';

export type SignStage = 'loading' | 'unavailable' | 'read' | 'accept' | 'code' | 'signed';

export interface CareSignature {
  stage: SignStage;
  view: CareSignView | null;
  fatalError: string | null;
  actionError: string | null;
  busy: boolean;
  codeSentTo: string | null;
  resendAvailableAt: string | null;
  markDocumentViewed: () => void;
  acceptAndSendCode: (shareLocation: boolean) => Promise<void>;
  resendCode: () => Promise<void>;
  confirmCode: (code: string) => Promise<void>;
}

const stageFor = (view: CareSignView): SignStage => {
  if (view.session.status === 'assinada') return 'signed';
  if (view.session.status === 'aceita') return 'code';
  return view.session.viewed ? 'accept' : 'read';
};

// Códigos que encerram a sessão: o cliente precisa de um novo link da loja.
const TERMINAL_CODES = new Set(['invalido', 'revogado', 'expirado', 'bloqueado', 'limite_envios']);

type SignCall = <T>(action: string, extra?: Record<string, unknown>) => Promise<T>;

// Para onde o código foi enviado e quando pode ser reenviado (sobrevive a recarregar a página).
function useOtpDelivery(call: SignCall) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const restore = useCallback((view: CareSignView) => {
    setResendAvailableAt(view.session.resendAvailableAt);
    if (view.session.otpPending) setSentTo(view.otp.phoneMasked);
  }, []);
  const send = useCallback(async () => {
    const result = await call<{ phoneMasked: string; resendAvailableAt: string }>('send_otp');
    setSentTo(result.phoneMasked);
    setResendAvailableAt(result.resendAvailableAt);
  }, [call]);
  return { sentTo, resendAvailableAt, restore, send };
}

// Executa uma ação do assinante com "ocupado" e erro; erros terminais (link inválido/bloqueado) encerram a sessão.
function useGuardedAction(onTerminal: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const guarded = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível concluir agora.';
      if (e instanceof CareRequestError && e.code && TERMINAL_CODES.has(e.code)) onTerminal(message);
      else setActionError(message);
    } finally {
      setBusy(false);
    }
  }, [onTerminal]);
  return { busy, actionError, guarded };
}

export function useCareSignature(token: string): CareSignature {
  const [view, setView] = useState<CareSignView | null>(null);
  const [stage, setStage] = useState<SignStage>('loading');
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoEvidenceInput>({ permission: 'nao_compartilhada' });

  const call = useCallback<SignCall>(
    (action, extra = {}) => invokeCareFunction('care-sign-public', { token, action, ...extra }),
    [token],
  );
  const otp = useOtpDelivery(call);

  const endSession = useCallback((message: string) => {
    setFatalError(message);
    setStage('unavailable');
  }, []);
  const { busy, actionError, guarded } = useGuardedAction(endSession);

  const load = useCallback(async () => {
    try {
      const next = await call<CareSignView>('open');
      setView(next);
      setStage(stageFor(next));
      otp.restore(next);
    } catch (e) {
      endSession(e instanceof Error ? e.message : 'Não foi possível abrir o contrato.');
    }
  }, [call, endSession, otp.restore]);

  useEffect(() => {
    void load();
  }, [load]);


  // O PDF abre por um link real (<a target=_blank>), que o Safari do iPhone não bloqueia; aqui só registramos a visualização.
  const markDocumentViewed = useCallback(() => {
    void guarded(async () => {
      await call('viewed');
      setStage((current) => (current === 'read' ? 'accept' : current));
    });
  }, [call, guarded]);

  const acceptAndSendCode = useCallback((shareLocation: boolean) => guarded(async () => {
    const evidence: GeoEvidenceInput = shareLocation ? await captureGeo() : { permission: 'nao_compartilhada' };
    setGeo(evidence);
    await call('accept', { accepted: true, geo: evidence });
    setStage('code');
    await otp.send();
  }), [call, guarded, otp.send]);

  const resendCode = useCallback(() => guarded(otp.send), [guarded, otp.send]);

  const confirmCode = useCallback((code: string) => guarded(async () => {
    await call('verify_otp', { code, geo });
    await load();
  }), [call, geo, guarded, load]);

  return { stage, view, fatalError, actionError, busy, codeSentTo: otp.sentTo, resendAvailableAt: otp.resendAvailableAt, markDocumentViewed, acceptAndSendCode, resendCode, confirmCode };
}
