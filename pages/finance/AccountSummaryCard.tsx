import React from 'react';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import { formatSignedBRL } from './financeHelpers';


// Cartão de resumo do extrato da conta ativa. `tone` decide a cor: entradas sempre em
// verde, saídas sempre em vermelho, e o líquido acompanha o próprio sinal.
const AccountSummaryCard: React.FC<{ label: string; value: number; tone: 'in' | 'out' | 'net' | 'neutral' }> = ({
  label,
  value,
  tone
}) => {
  const isNegative = tone === 'out' || (tone === 'net' && value < 0);
  const toneClass =
    tone === 'neutral' || value === 0
      ? 'text-gray-900 dark:text-white'
      : isNegative
        ? 'text-red-600 dark:text-red-400'
        : 'text-green-700 dark:text-green-400';

  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3 md:block md:p-5">
      <p className="text-ios-subhead md:text-ios-footnote text-gray-500 dark:text-surface-dark-500 md:mb-1">{label}</p>
      <p
        className={`text-ios-headline md:text-ios-title-2 font-bold tabular-nums whitespace-nowrap ${toneClass}`}
      >
        {tone === 'net' ? formatSignedBRL(value) : formatCurrencyBRL(value)}
      </p>
    </div>
  );
};

export default AccountSummaryCard;
