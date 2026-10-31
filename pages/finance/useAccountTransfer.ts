import { useState } from 'react';
import { useDisclosure } from '../../hooks/useDisclosure';
import { useToast } from '../../components/ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import type { FinancialAccount } from '../../types';
import { ACCOUNT_BANK, ACCOUNT_SAFE } from '../../utils/financialAccounts';
import { parseDecimalBRL } from '../../utils/inputMasks';
import { formatSignedBRL } from './financeHelpers';
import type { TransferFormData } from './TransferModal';

interface AccountTransferDeps {
  bankBalance: number;
  safeBalance: number;
  transferBetweenAccounts: (from: FinancialAccount, to: FinancialAccount, amount: number) => Promise<unknown>;
}

// Estado e ações do modal de transferência entre Conta Bancária e Cofre.
export const useAccountTransfer = ({ bankBalance, safeBalance, transferBetweenAccounts }: AccountTransferDeps) => {
  const toast = useToast();
  const run = useAsyncHandler();
  const { isOpen, open: openTransferModal, close: closeTransferModal } = useDisclosure();
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferData, setTransferData] = useState<TransferFormData>({
    from: ACCOUNT_BANK,
    to: ACCOUNT_SAFE,
    amount: ''
  });

  const handleTransfer = async () => {
    const amount = parseDecimalBRL(transferData.amount);
    if (amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (transferData.from === transferData.to) {
      toast.error('Selecione contas diferentes para transferir.');
      return;
    }
    const originBalance = transferData.from === ACCOUNT_BANK ? bankBalance : safeBalance;
    if (amount > originBalance + 0.001) {
      toast.error(
        `Saldo insuficiente em ${transferData.from}: disponível ${formatSignedBRL(originBalance)}.`
      );
      return;
    }

    await run(async () => {
      // RPC atômico: as duas pernas nascem juntas no banco (antes eram dois
      // inserts do cliente e uma falha no segundo deixava meia transferência).
      await transferBetweenAccounts(transferData.from, transferData.to, amount);

      closeTransferModal();
      setTransferData({ from: ACCOUNT_BANK, to: ACCOUNT_SAFE, amount: '' });
      toast.success('Transferencia realizada.');
    }, { errorMsg: 'Nao foi possivel realizar a transferencia.', setLoading: setIsTransferring });
  };


  // Abre já com a conta da aba como origem e a outra como destino.
  const openFrom = (origin: FinancialAccount) => {
    setTransferData({ from: origin, to: origin === ACCOUNT_BANK ? ACCOUNT_SAFE : ACCOUNT_BANK, amount: '' });
    openTransferModal();
  };

  return {
    isOpen,
    isTransferring,
    transferData,
    setTransferData,
    openFrom,
    close: closeTransferModal,
    submit: () => void handleTransfer()
  };
};
