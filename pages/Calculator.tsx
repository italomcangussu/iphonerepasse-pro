import React, { useEffect, useMemo, useState } from 'react';
import { Calculator as CalcIcon, Copy, CreditCard, Instagram, MessageCircle, Settings, X } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';

const DEFAULT_RATES_STD = [
  2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63,
  10.26, 10.90, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37
];

const DEFAULT_RATES_PREMIUM = [
  3.99, 5.30, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43,
  12.06, 12.70, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37
];

const INSTAGRAM_DIRECT_MAX_CHARACTERS = 1000;

type CardProfile = 'STD' | 'PREM';
type ShareMode = 'ALL' | 'SELECTED';

interface SimulationResult {
  installments: number;
  installmentValue: number;
  total: number;
}

interface InstagramSimulationTextResult {
  text: string;
  truncated: boolean;
}

const formatCurrency = (currencyValue: number): string => (
  currencyValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
);

const readStoredRates = (key: string, fallback: number[]): number[] => {
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return fallback;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length !== fallback.length) return fallback;

    return parsed.map((value, index) => (
      Number.isFinite(Number(value)) ? Number(value) : fallback[index]
    ));
  } catch {
    return fallback;
  }
};

const Calculator: React.FC = () => {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [profile, setProfile] = useState<CardProfile>('STD');
  const [showConfig, setShowConfig] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>('ALL');
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([]);
  const [ratesStd, setRatesStd] = useState<number[]>(DEFAULT_RATES_STD);
  const [ratesPrem, setRatesPrem] = useState<number[]>(DEFAULT_RATES_PREMIUM);

  useEffect(() => {
    setRatesStd(readStoredRates('calc_rates_std', DEFAULT_RATES_STD));
    setRatesPrem(readStoredRates('calc_rates_prem', DEFAULT_RATES_PREMIUM));
  }, []);

  const currentRates = profile === 'STD' ? ratesStd : ratesPrem;
  const value = Number.parseFloat(amount) || 0;
  const hasValidAmount = value > 0;

  const simulations = useMemo<SimulationResult[]>(() => (
    currentRates.map((rate, idx) => {
      const installments = idx + 1;
      if (value <= 0) {
        return { installments, installmentValue: 0, total: 0 };
      }

      const safeRate = Math.max(0, rate);
      const receiveFactor = 1 - (safeRate / 100);
      if (receiveFactor <= 0) {
        return { installments, installmentValue: 0, total: 0 };
      }

      const total = value / receiveFactor;
      return {
        installments,
        installmentValue: total / installments,
        total
      };
    })
  ), [currentRates, value]);

  const saveRates = () => {
    window.localStorage.setItem('calc_rates_std', JSON.stringify(ratesStd));
    window.localStorage.setItem('calc_rates_prem', JSON.stringify(ratesPrem));
    setShowConfig(false);
    toast.success('Taxas salvas com sucesso!');
  };

  const toggleInstallmentSelection = (installments: number): void => {
    setSelectedInstallments((currentSelection) => {
      if (currentSelection.includes(installments)) {
        return currentSelection.filter((item) => item !== installments);
      }

      return [...currentSelection, installments].sort((a, b) => a - b);
    });
  };

  const toggleAllInstallmentsSelection = (): void => {
    const allInstallments = simulations.map((item) => item.installments);
    setSelectedInstallments((currentSelection) => (
      currentSelection.length === allInstallments.length ? [] : allInstallments
    ));
  };

  const getSimulationItemsForSharing = (): SimulationResult[] => {
    if (shareMode === 'ALL') return simulations;
    return simulations.filter((item) => selectedInstallments.includes(item.installments));
  };

  const buildWhatsAppSimulationText = (items: SimulationResult[]): string => {
    const profileLabel = profile === 'STD' ? 'Visa / Master' : 'Elo / Hiper';
    const generationDate = new Date().toLocaleString('pt-BR');
    const simulationLines = items.flatMap((item, index) => {
      const lines = [
        `*${item.installments}x*`,
        `Parcela: ${formatCurrency(item.installmentValue)}`,
        `Total: ${formatCurrency(item.total)}`
      ];

      if (index < items.length - 1) {
        lines.push('--------');
      }

      return lines;
    });

    const installmentsTitle = shareMode === 'ALL'
      ? '*Parcelas disponiveis*'
      : '*Parcelas selecionadas*';

    return [
      '*Simulacao de Parcelamento*',
      '',
      `Bandeira: *${profileLabel}*`,
      `Valor liquido desejado: *${formatCurrency(value)}*`,
      '',
      installmentsTitle,
      '',
      ...simulationLines,
      '',
      `Gerado em: ${generationDate}`
    ].join('\n');
  };

  const buildInstagramSimulationText = (items: SimulationResult[]): InstagramSimulationTextResult => {
    const profileLabel = profile === 'STD' ? 'Visa / Master' : 'Elo / Hiper';
    const generationDate = new Date().toLocaleString('pt-BR');
    const installmentsTitle = shareMode === 'ALL' ? 'Parcelas:' : 'Parcelas selecionadas:';

    const simulationLines = items.map((item) => (
      `${item.installments}x: ${formatCurrency(item.installmentValue)} (total ${formatCurrency(item.total)})`
    ));

    const headerLines = [
      'Simulacao de parcelamento',
      `${profileLabel} | Valor: ${formatCurrency(value)}`,
      installmentsTitle
    ];

    const withFooter = [
      ...headerLines,
      ...simulationLines,
      `Gerado: ${generationDate}`
    ].join('\n');

    if (withFooter.length <= INSTAGRAM_DIRECT_MAX_CHARACTERS) {
      return { text: withFooter, truncated: false };
    }

    const withoutFooter = [
      ...headerLines,
      ...simulationLines
    ].join('\n');

    if (withoutFooter.length <= INSTAGRAM_DIRECT_MAX_CHARACTERS) {
      return { text: withoutFooter, truncated: true };
    }

    for (let visibleCount = simulationLines.length - 1; visibleCount >= 0; visibleCount -= 1) {
      const hiddenCount = simulationLines.length - visibleCount;
      const candidateLines = [
        ...headerLines,
        ...simulationLines.slice(0, visibleCount)
      ];

      if (hiddenCount > 0) {
        candidateLines.push(`+${hiddenCount} parcela(s) nao exibida(s) por limite do Instagram.`);
      }

      const candidateText = candidateLines.join('\n');
      if (candidateText.length <= INSTAGRAM_DIRECT_MAX_CHARACTERS) {
        return { text: candidateText, truncated: true };
      }
    }

    return {
      text: [
        'Simulacao de parcelamento',
        `${profileLabel} | Valor: ${formatCurrency(value)}`,
        'Resumo reduzido para caber no Direct.'
      ].join('\n'),
      truncated: true
    };
  };

  const copyWithFallback = (text: string): boolean => {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.setAttribute('readonly', 'true');
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const didCopy = document.execCommand('copy');
    document.body.removeChild(tempInput);
    return didCopy;
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.error('Erro ao copiar simulação:', error);
      }
    }

    return copyWithFallback(text);
  };

  const validateShare = (): SimulationResult[] | null => {
    if (!hasValidAmount) {
      toast.info('Informe um valor para gerar a simulação.');
      return null;
    }

    const simulationItems = getSimulationItemsForSharing();
    if (shareMode === 'SELECTED' && simulationItems.length === 0) {
      toast.info('Selecione ao menos uma parcela para enviar.');
      return null;
    }

    return simulationItems;
  };

  const handleCopySimulationText = async (): Promise<void> => {
    const simulationItems = validateShare();
    if (!simulationItems) return;

    const copied = await copyTextToClipboard(buildWhatsAppSimulationText(simulationItems));

    if (copied) {
      toast.success(
        shareMode === 'ALL'
          ? 'Simulação completa copiada para a área de transferência.'
          : 'Parcelas selecionadas copiadas para a área de transferência.'
      );
      return;
    }

    toast.error('Não foi possível copiar a simulação.');
  };

  const handleCopyInstagramText = async (): Promise<void> => {
    const simulationItems = validateShare();
    if (!simulationItems) return;

    const { text: instagramText, truncated } = buildInstagramSimulationText(simulationItems);
    const copied = await copyTextToClipboard(instagramText);

    if (copied) {
      toast.info(
        truncated
          ? 'Texto para Instagram copiado em versão resumida para caber no limite.'
          : 'Texto formatado para Instagram copiado.'
      );
      return;
    }

    toast.error('Não foi possível copiar o texto para Instagram.');
  };

  const handleShareOnWhatsApp = async (): Promise<void> => {
    const simulationItems = validateShare();
    if (!simulationItems) return;

    const simulationText = buildWhatsAppSimulationText(simulationItems);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(simulationText)}`;
    const shareWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!shareWindow) {
      window.location.href = whatsappUrl;
    }

    const copied = await copyTextToClipboard(simulationText);
    toast.info(copied ? 'WhatsApp aberto e simulação copiada.' : 'WhatsApp aberto, mas não foi possível copiar automaticamente.');
  };

  const setRateAt = (kind: CardProfile, index: number, nextValue: string) => {
    const numericValue = Number.parseFloat(nextValue) || 0;
    if (kind === 'STD') {
      setRatesStd((current) => current.map((rate, rateIndex) => (rateIndex === index ? numericValue : rate)));
      return;
    }

    setRatesPrem((current) => current.map((rate, rateIndex) => (rateIndex === index ? numericValue : rate)));
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <CalcIcon className="text-brand-500" /> Calculadora de Taxas
          </h1>
          <p className="text-sm text-gray-500 dark:text-surface-dark-500">Simule o valor final do parcelamento.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-full p-2 text-gray-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-surface-dark-500 dark:hover:bg-brand-900/20 sm:self-auto"
          aria-label="Configurar taxas"
        >
          <Settings size={20} />
        </button>
      </div>

      <div className="rounded-ios-2xl border border-gray-100 bg-white p-4 shadow-ios-sm dark:border-surface-dark-200 dark:bg-surface-dark-100 sm:p-6">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="calculator-amount" className="mb-2 block text-sm font-medium text-gray-700 dark:text-surface-dark-700">
              Valor da Venda (Quero Receber)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">R$</span>
              <input
                id="calculator-amount"
                type="number"
                autoFocus
                inputMode="decimal"
                className="min-h-12 w-full rounded-ios-lg border-2 border-brand-100 bg-white py-3 pl-10 pr-4 text-xl font-bold text-gray-800 outline-none transition-all placeholder-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-surface-dark-300 dark:bg-surface-dark-50 dark:text-white sm:text-2xl"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 block text-sm font-medium text-gray-700 dark:text-surface-dark-700">Bandeira do Cartão</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProfile('STD')}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-ios-lg border-2 px-2 py-3 text-sm font-bold transition-all sm:text-base ${
                  profile === 'STD'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-surface-dark-300 dark:text-surface-dark-500'
                }`}
              >
                <CreditCard size={18} /> Visa / Master
              </button>
              <button
                type="button"
                onClick={() => setProfile('PREM')}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-ios-lg border-2 px-2 py-3 text-sm font-bold transition-all sm:text-base ${
                  profile === 'PREM'
                    ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-surface-dark-300 dark:text-surface-dark-500'
                }`}
              >
                <CreditCard size={18} /> Elo / Hiper
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/25 dark:text-brand-300">
            Simulação instantânea
          </div>
        </div>

        <div className="rounded-ios-2xl border border-gray-200 bg-gray-50/60 p-2.5 dark:border-surface-dark-200 dark:bg-surface-dark-50 sm:p-3">
          <div className="mb-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-1 rounded-ios-lg border border-gray-200 bg-white p-1 dark:border-surface-dark-300 dark:bg-surface-dark-100">
                <button
                  type="button"
                  onClick={() => setShareMode('ALL')}
                  className={`min-h-11 rounded-ios px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
                    shareMode === 'ALL' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-surface-dark-600 dark:hover:bg-surface-dark-200'
                  }`}
                >
                  Todas as parcelas
                </button>
                <button
                  type="button"
                  onClick={() => setShareMode('SELECTED')}
                  className={`min-h-11 rounded-ios px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
                    shareMode === 'SELECTED' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-surface-dark-600 dark:hover:bg-surface-dark-200'
                  }`}
                >
                  Parcelas selecionadas
                </button>
              </div>
              {shareMode === 'SELECTED' && (
                <button
                  type="button"
                  onClick={toggleAllInstallmentsSelection}
                  className="inline-flex min-h-11 items-center justify-center rounded-ios-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-surface-dark-300 dark:bg-surface-dark-100 dark:text-surface-dark-700 sm:text-sm"
                >
                  {selectedInstallments.length === simulations.length ? 'Limpar seleção' : 'Selecionar todas'}
                </button>
              )}
            </div>
            {shareMode === 'SELECTED' && (
              <p className="px-1 text-xs font-medium text-gray-500 dark:text-surface-dark-500">
                {selectedInstallments.length} parcela(s) selecionada(s)
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void handleShareOnWhatsApp()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-ios-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle size={16} />
                Compartilhar
              </button>
              <button
                type="button"
                onClick={() => void handleCopySimulationText()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-ios-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-surface-dark-300 dark:bg-surface-dark-100 dark:text-surface-dark-700"
              >
                <Copy size={16} />
                Copiar texto
              </button>
              <button
                type="button"
                onClick={() => void handleCopyInstagramText()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-ios-lg border border-pink-300 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700 transition-colors hover:bg-pink-100 dark:border-pink-900/50 dark:bg-pink-950/20 dark:text-pink-300"
              >
                <Instagram size={16} />
                Copiar instagram
              </button>
            </div>
          </div>

          <div className="mb-2 px-1 text-[10px] font-bold uppercase text-gray-500 dark:text-surface-dark-500 sm:text-xs">
            {shareMode === 'ALL' ? 'Todas as parcelas' : 'Parcelas selecionáveis para envio'}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-6">
            {simulations.map((item) => {
              const isSelected = selectedInstallments.includes(item.installments);

              return (
                <div
                  key={item.installments}
                  className={`rounded-ios-lg border bg-white p-2.5 shadow-ios-sm transition-colors dark:bg-surface-dark-100 sm:p-3 ${
                    isSelected ? 'border-brand-400 ring-1 ring-brand-200 dark:ring-brand-900/50' : 'border-brand-100 dark:border-surface-dark-300'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="inline-flex items-center justify-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:bg-brand-900/25 dark:text-brand-300 sm:text-xs">
                      {item.installments}x
                    </span>
                    <label className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-surface-dark-500 sm:text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        checked={isSelected}
                        onChange={() => toggleInstallmentSelection(item.installments)}
                      />
                      Selecionar
                    </label>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-400 dark:text-surface-dark-400">Parcela</span>
                    <span className="block text-xs font-black text-gray-800 dark:text-white sm:text-sm">
                      {formatCurrency(item.installmentValue)}
                    </span>
                  </div>
                  <div className="mt-1 border-t border-gray-100 pt-1 dark:border-surface-dark-200">
                    <span className="block text-[10px] font-bold uppercase text-gray-400 dark:text-surface-dark-400">Total</span>
                    <span className="block text-xs font-black text-gray-900 dark:text-white sm:text-sm">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-ios-xl bg-white shadow-ios26-lg dark:bg-surface-dark-100">
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-surface-dark-200 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurar Taxas da Maquininha</h2>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-ios text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-surface-dark-200"
                aria-label="Fechar configuração de taxas"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="mb-4 rounded bg-emerald-50 p-2 text-center font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Visa / Master</h3>
                  <div className="space-y-2">
                    {ratesStd.map((rate, idx) => (
                      <div key={`std-${idx}`} className="flex items-center gap-2">
                        <span className="w-8 text-xs font-bold text-gray-500 dark:text-surface-dark-500">{idx + 1}x</span>
                        <input
                          type="number"
                          step="0.01"
                          className="min-h-10 w-full rounded-ios border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-surface-dark-300 dark:bg-surface-dark-50 dark:text-white"
                          value={rate}
                          onChange={(event) => setRateAt('STD', idx, event.target.value)}
                          aria-label={`Taxa Visa / Master ${idx + 1}x`}
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 rounded bg-orange-50 p-2 text-center font-bold text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">Elo / Hiper</h3>
                  <div className="space-y-2">
                    {ratesPrem.map((rate, idx) => (
                      <div key={`prem-${idx}`} className="flex items-center gap-2">
                        <span className="w-8 text-xs font-bold text-gray-500 dark:text-surface-dark-500">{idx + 1}x</span>
                        <input
                          type="number"
                          step="0.01"
                          className="min-h-10 w-full rounded-ios border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:border-surface-dark-300 dark:bg-surface-dark-50 dark:text-white"
                          value={rate}
                          onChange={(event) => setRateAt('PREM', idx, event.target.value)}
                          aria-label={`Taxa Elo / Hiper ${idx + 1}x`}
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 p-4 dark:border-surface-dark-200 sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-ios-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-surface-dark-600 dark:hover:bg-surface-dark-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveRates}
                className="inline-flex min-h-11 items-center justify-center rounded-ios-lg bg-brand-500 px-6 py-2 font-bold text-white transition-colors hover:bg-brand-600"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;
