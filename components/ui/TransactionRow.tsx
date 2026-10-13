import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export type TransactionDirection = 'in' | 'out';

interface TransactionRowProps {
  title: string;
  /** Linha de apoio: data e categoria. */
  detail: string;
  /** Valor já formatado, sem sinal: "R$ 544,00". */
  amount: string;
  direction: TransactionDirection;
  /** Meio ou conta: "Pix", "Cofre". */
  account?: string;
}

const DIRECTIONS: Record<TransactionDirection, { icon: any; tone: string; sign: string; spoken: string }> = {
  in: { icon: ArrowDownLeft, tone: 'text-[var(--ds-color-success)]', sign: '+', spoken: 'Entrada' },
  out: { icon: ArrowUpRight, tone: 'text-[var(--ds-color-error)]', sign: '−', spoken: 'Saída' },
};

/** Linha de lançamento financeiro: sentido por seta, sinal e cor (nunca só cor). */
const TransactionRow: React.FC<TransactionRowProps> = ({ title, detail, amount, direction, account }) => {
  const { icon: Icon, tone, sign, spoken } = DIRECTIONS[direction];

  return (
    <li className="ios-list-row">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-ios-subhead font-semibold">{title}</p>
        <p className="truncate text-ios-caption app-text-muted">{detail}</p>
      </div>
      <div className={`flex shrink-0 items-center gap-2 ${tone}`}>
        <Icon size={18} aria-hidden="true" />
        <div className="text-right">
          <p className="text-ios-subhead font-bold tabular-nums">
            <span className="sr-only">{spoken}: </span>
            {sign} {amount}
          </p>
          {account && <p className="text-ios-caption app-text-muted">{account}</p>}
        </div>
      </div>
    </li>
  );
};

export default TransactionRow;
