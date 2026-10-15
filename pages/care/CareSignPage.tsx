import React from 'react';
import { useParams } from 'react-router-dom';
import Banner from '../../components/ui/Banner';
import { useCareSignature } from './sign/useCareSignature';
import {
  AcceptStep,
  CodeStep,
  ContractSummaryCard,
  ReadStep,
  SignedScreen,
  SignProgress,
  SignShell,
  SignSkeleton,
  UnavailableScreen,
} from './sign/SignParts';

const PROGRESS = { read: 0, accept: 1, code: 2 } as const;

// Página pública (sem login) em que o cliente lê, aceita e assina o contrato Repasse Care+ no celular.
const CareSignPage: React.FC = () => {
  const { token = '' } = useParams();
  const sign = useCareSignature(token);

  if (sign.stage === 'loading') return <SignShell><SignSkeleton /></SignShell>;
  if (sign.stage === 'unavailable' || !sign.view) {
    return <SignShell><UnavailableScreen message={sign.fatalError ?? 'Link inválido.'} /></SignShell>;
  }
  if (sign.stage === 'signed') return <SignShell><SignedScreen view={sign.view} /></SignShell>;

  const { view } = sign;
  return (
    <SignShell>
      <SignProgress current={PROGRESS[sign.stage]} />
      <ContractSummaryCard view={view} />
      {sign.actionError && <Banner kind="error" message={sign.actionError} />}
      {sign.stage !== 'code' && (
        <>
          <ReadStep url={view.document.url} viewed={sign.stage === 'accept'} onOpen={sign.markDocumentViewed} />
          <AcceptStep acceptanceText={view.acceptance.text} enabled={sign.stage === 'accept'} busy={sign.busy} onAccept={sign.acceptAndSendCode} />
        </>
      )}
      {sign.stage === 'code' && (
        <CodeStep
          phoneMasked={sign.codeSentTo}
          ttlMinutes={view.otp.ttlMinutes}
          busy={sign.busy}
          resendAvailableAt={sign.resendAvailableAt}
          onConfirm={sign.confirmCode}
          onResend={sign.resendCode}
        />
      )}
    </SignShell>
  );
};

export default CareSignPage;
