import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, PlayCircle, UploadCloud } from 'lucide-react';
import { Combobox } from '../components/ui/Combobox';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import { Condition, DeviceType, PaymentMethod, Sale, StockItem, StockStatus, WarrantyType } from '../types';
import { matchCustomerByPriority, normalizeDigits, normalizeName } from '../utils/debts';
import { newId } from '../utils/id';

type ParsedSaleRow = {
  lineNumber: number;
  raw: string;
  day: number;
  costTotal: number;
  saleValue: number;
  model: string;
  lsFlag: string;
  imei: string;
  paymentRaw: string;
  customerName: string;
  cpf: string;
  phone: string;
  sellerName: string;
  city: string;
  storeId?: string;
  sellerId?: string;
  isValid: boolean;
  issues: string[];
};

const parseMoney = (input: string) => {
  const cleaned = (input || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
};

const parseDay = (input: string) => {
  const day = Number((input || '').replace(/[^\d]/g, ''));
  return Number.isFinite(day) ? day : 0;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

const parsePaymentMethods = (raw: string, total: number): PaymentMethod[] => {
  const normalized = normalizeText(raw);
  const tokens = normalized.split(/[+/]/g).map((token) => token.trim()).filter(Boolean);
  const methods = Array.from(
    new Set(
      tokens
        .map((token) => {
          if (token.includes('PIX')) return 'Pix';
          if (token.includes('CARTAO') || token.includes('CARTÃO')) return 'Cartão';
          if (token.includes('DINHEIRO')) return 'Dinheiro';
          return null;
        })
        .filter((method): method is 'Pix' | 'Cartão' | 'Dinheiro' => !!method)
    )
  );

  if (methods.length === 0) {
    return [{ type: 'Dinheiro', amount: total }];
  }

  const baseAmount = Number((total / methods.length).toFixed(2));
  const paymentMethods = methods.map((method) => ({ type: method, amount: baseAmount } as PaymentMethod));
  const distributed = paymentMethods.reduce((acc, item) => acc + item.amount, 0);
  const diff = Number((total - distributed).toFixed(2));

  if (diff !== 0 && paymentMethods.length > 0) {
    paymentMethods[paymentMethods.length - 1].amount = Number((paymentMethods[paymentMethods.length - 1].amount + diff).toFixed(2));
  }

  return paymentMethods;
};

const inferConditionFromLs = (value: string): Condition => {
  const normalized = normalizeText(value);
  return normalized === 'S' ? Condition.USED : Condition.NEW;
};

const inferDeviceType = (model: string): DeviceType => {
  const normalized = normalizeText(model);
  if (normalized.includes('IPAD')) return DeviceType.IPAD;
  if (normalized.includes('MACBOOK') || normalized.includes('MAC')) return DeviceType.MACBOOK;
  if (normalized.includes('WATCH')) return DeviceType.WATCH;
  return DeviceType.IPHONE;
};

const inferCapacity = (model: string) => {
  const normalized = normalizeText(model);
  const match = normalized.match(/(\d+)\s?(GB|TB)/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : '';
};

const buildSaleDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.toISOString();
};

const getWarrantyDate = (saleIso: string, condition: Condition) => {
  const date = new Date(saleIso);
  if (condition === Condition.USED) {
    date.setMonth(date.getMonth() + 3);
    return date.toISOString();
  }
  // Regra atual do app: também usa +90 dias no fluxo padrão.
  date.setMonth(date.getMonth() + 3);
  return date.toISOString();
};

const FebruarySales: React.FC = () => {
  const { stores, sellers, customers, stock, addCustomer, addStockItem, addSale } = useData();
  const toast = useToast();

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(2);
  const [rawInput, setRawInput] = useState('');
  const [rows, setRows] = useState<ParsedSaleRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [defaultStoreId, setDefaultStoreId] = useState('');

  const parseRows = () => {
    const lines = rawInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed: ParsedSaleRow[] = lines.map((line, index) => {
      const cols = (line.includes('\t') ? line.split('\t') : line.split(';')).map((col) => col.trim());
      const issues: string[] = [];

      if (cols.length < 13) {
        issues.push('Linha com menos colunas que o esperado (13).');
      }

      const day = parseDay(cols[0] || '');
      const costTotal = parseMoney(cols[1] || '');
      const saleValue = parseMoney(cols[2] || '');
      const model = cols[4] || '';
      const lsFlag = cols[5] || '';
      const imei = normalizeDigits(cols[6] || '');
      const paymentRaw = cols[7] || '';
      const customerName = cols[8] || '';
      const cpf = normalizeDigits(cols[9] || '');
      const phone = normalizeDigits(cols[10] || '');
      const sellerName = cols[11] || '';
      const city = cols[12] || '';

      if (!day || day < 1 || day > 31) issues.push('Dia inválido.');
      if (!saleValue || saleValue <= 0) issues.push('Valor de venda inválido.');
      if (!model) issues.push('Modelo ausente.');
      if (!customerName) issues.push('Cliente ausente.');
      if (!sellerName) issues.push('Vendedor ausente.');

      const cityNorm = normalizeText(city);
      let store = stores.find((st) => normalizeText(st.name) === cityNorm);
      if (!store && defaultStoreId) {
        store = stores.find((st) => st.id === defaultStoreId);
      }
      if (!store) issues.push('Loja não encontrada pela cidade/default.');

      const sellerNorm = normalizeText(sellerName);
      const seller = sellers.find((s) => normalizeText(s.name) === sellerNorm && (!store || s.storeId === store.id));
      if (!seller) issues.push('Vendedor não encontrado para a loja da linha.');

      return {
        lineNumber: index + 1,
        raw: line,
        day,
        costTotal,
        saleValue,
        model,
        lsFlag,
        imei,
        paymentRaw,
        customerName,
        cpf,
        phone,
        sellerName,
        city,
        storeId: store?.id,
        sellerId: seller?.id,
        isValid: issues.length === 0,
        issues
      };
    });

    setRows(parsed);

    const invalidCount = parsed.filter((row) => !row.isValid).length;
    if (invalidCount > 0) {
      toast.error(`${invalidCount} linha(s) com inconsistências. Revise antes de importar.`);
    } else {
      toast.success(`${parsed.length} linha(s) pronta(s) para importação.`);
    }
  };

  const importRows = async () => {
    const validRows = rows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para importar.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    const failed: { line: number; reason: string }[] = [];
    const customerCache = [...customers];
    const stockCache = [...stock];

    for (const row of validRows) {
      try {
        let customer = matchCustomerByPriority(customerCache, {
          name: row.customerName,
          cpf: row.cpf,
          phone: row.phone
        });

        if (!customer) {
          const customerId = newId('cust');
          await addCustomer({
            id: customerId,
            name: normalizeName(row.customerName),
            cpf: row.cpf || '',
            phone: row.phone || '',
            email: '',
            birthDate: '',
            purchases: 0,
            totalSpent: 0
          });
          customer = {
            id: customerId,
            name: normalizeName(row.customerName),
            cpf: row.cpf || '',
            phone: row.phone || '',
            email: '',
            birthDate: '',
            purchases: 0,
            totalSpent: 0
          };
          customerCache.push(customer);
        }

        let saleStockItem = stockCache.find((item) => row.imei && item.imei === row.imei);
        if (!saleStockItem) {
          const condition = inferConditionFromLs(row.lsFlag);
          const stockItem: StockItem = {
            id: newId('stk'),
            type: inferDeviceType(row.model),
            model: row.model,
            color: '',
            hasBox: false,
            capacity: inferCapacity(row.model),
            imei: row.imei || newId('imei'),
            condition,
            status: StockStatus.AVAILABLE,
            batteryHealth: condition === Condition.USED ? 100 : undefined,
            storeId: row.storeId!,
            purchasePrice: row.costTotal,
            sellPrice: row.saleValue,
            maxDiscount: 0,
            warrantyType: WarrantyType.STORE,
            warrantyEnd: undefined,
            origin: 'import_fevereiro',
            notes: `Importado em lote ${selectedMonth}/${selectedYear}`,
            observations: `Importado em lote ${selectedMonth}/${selectedYear}`,
            costs: [],
            photos: [],
            entryDate: buildSaleDate(selectedYear, selectedMonth, row.day)
          };
          await addStockItem(stockItem);
          saleStockItem = stockItem;
          stockCache.push(stockItem);
        }

        const saleDate = buildSaleDate(selectedYear, selectedMonth, row.day);
        const condition = inferConditionFromLs(row.lsFlag);
        const paymentMethods = parsePaymentMethods(row.paymentRaw, row.saleValue);

        const sale: Sale = {
          id: newId('sale'),
          customerId: customer.id,
          sellerId: row.sellerId!,
          items: [saleStockItem],
          tradeIn: undefined,
          tradeInValue: 0,
          discount: 0,
          total: row.saleValue,
          paymentMethods,
          date: saleDate,
          warrantyExpiresAt: getWarrantyDate(saleDate, condition)
        };

        await addSale(sale);
        successCount += 1;
      } catch (error: any) {
        failed.push({ line: row.lineNumber, reason: error?.message || 'Erro desconhecido' });
      }
    }

    setIsImporting(false);

    if (failed.length > 0) {
      toast.error(`Importação parcial: ${successCount} sucesso(s), ${failed.length} falha(s).`);
      return;
    }

    toast.success(`${successCount} venda(s) importada(s) com sucesso.`);
  };

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.isValid).length;
    const invalid = rows.length - valid;
    return { total: rows.length, valid, invalid };
  }, [rows]);

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Painel de Vendas de Fevereiro</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">
            Associe loja e vendedor, cadastre cliente automaticamente e importe vendas em lote.
          </p>
        </div>
      </div>

      <div className="ios-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="ios-label">Ano</label>
            <input
              type="number"
              className="ios-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value) || 2026)}
            />
          </div>
          <div>
            <label className="ios-label">Mês</label>
            <input
              type="number"
              className="ios-input"
              min={1}
              max={12}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Math.max(1, Math.min(12, Number(e.target.value) || 2)))}
            />
          </div>
          <div className="md:col-span-2">
            <Combobox
              label="Loja padrão (fallback)"
              placeholder="Selecionar loja..."
              value={defaultStoreId}
              onChange={setDefaultStoreId}
              options={stores.map((store) => ({
                id: store.id,
                label: store.name,
                subLabel: store.city || undefined
              }))}
            />
          </div>
        </div>

        <div className="rounded-ios-lg border border-dashed border-gray-300 dark:border-surface-dark-300 p-4 bg-gray-50 dark:bg-surface-dark-200">
          <div className="flex items-center gap-2 mb-2 text-gray-700 dark:text-surface-dark-700">
            <FileSpreadsheet size={18} />
            <p className="font-semibold">Cole as linhas da planilha (TSV)</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ordem esperada: DATA, CUSTO TOTAL, VENDA, LUCRO, MODELO, L/S, IMEI, PAGAMENTO, CLIENTE, CPF, TELEFONE, VENDEDOR, CIDADE.
          </p>
          <textarea
            className="ios-input min-h-[220px] font-mono text-xs"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Cole aqui as linhas copiadas da planilha..."
          />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={parseRows} className="ios-button-secondary flex items-center gap-2">
              <UploadCloud size={16} />
              Processar Linhas
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="ios-card p-4">
              <p className="text-ios-caption text-gray-500">Linhas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption text-gray-500">Válidas</p>
              <p className="text-2xl font-bold text-green-600">{summary.valid}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption text-gray-500">Com erro</p>
              <p className="text-2xl font-bold text-red-600">{summary.invalid}</p>
            </div>
          </div>

          <div className="ios-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Linha</th>
                    <th className="text-left px-4 py-3 font-semibold">Dia</th>
                    <th className="text-left px-4 py-3 font-semibold">Modelo</th>
                    <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold">Loja</th>
                    <th className="text-left px-4 py-3 font-semibold">Vendedor</th>
                    <th className="text-right px-4 py-3 font-semibold">Venda</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                  {rows.map((row) => (
                    <tr key={`${row.lineNumber}-${row.imei}-${row.model}`}>
                      <td className="px-4 py-3 text-sm">{row.lineNumber}</td>
                      <td className="px-4 py-3 text-sm">{row.day}</td>
                      <td className="px-4 py-3 text-sm font-medium">{row.model}</td>
                      <td className="px-4 py-3 text-sm">{row.customerName}</td>
                      <td className="px-4 py-3 text-sm">{stores.find((st) => st.id === row.storeId)?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm">{sellers.find((s) => s.id === row.sellerId)?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right">{row.saleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={14} />
                            Pronta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600" title={row.issues.join(' | ')}>
                            <AlertCircle size={14} />
                            {row.issues[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ios-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-sm text-gray-600 dark:text-surface-dark-600">
              Garantia automática: linhas com <strong>Seminovo (S)</strong> recebem <strong>90 dias</strong> a partir da data de venda, conforme regra atual do app.
            </div>
            <button
              type="button"
              onClick={importRows}
              disabled={isImporting || summary.valid === 0}
              className="ios-button-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PlayCircle size={16} />
              {isImporting ? 'Importando...' : `Importar ${summary.valid} venda(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FebruarySales;
