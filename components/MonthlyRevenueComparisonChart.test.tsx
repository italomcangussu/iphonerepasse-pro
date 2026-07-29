import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonthlyRevenueComparisonChart from './MonthlyRevenueComparisonChart';
import { Sale, Seller, StockItem, StoreLocation } from '../types';

vi.mock('../hooks/useChartTheme', () => ({
  useChartTheme: () => ({
    isDark: false,
    theme: 'light',
    gridColor: '#e5e7eb',
    axisColor: '#6b7280',
    tooltipContentStyle: {},
  }),
}));

/**
 * O componente compara o mês em curso (parcial) com meses fechados, então o
 * "hoje" precisa ser fixo — senão os totais esperados mudam a cada dia.
 */
const NOW = new Date('2026-07-29T12:00:00.000Z');

/** Uma linha de `items` = um aparelho vendido. */
const makeSale = (id: string, date: string, total: number, units = 1): Sale => ({
  id,
  customerId: 'cust-1',
  sellerId: 'sell-1',
  items: Array.from({ length: units }, (_, i) => ({ id: `${id}-item-${i}` } as StockItem)),
  tradeInValue: 0,
  discount: 0,
  total,
  paymentMethods: [],
  date,
  warrantyExpiresAt: null,
});

const mockSales: Sale[] = [
  makeSale('sale-1', '2026-07-05T14:00:00.000Z', 5000, 2),
  makeSale('sale-2', '2026-07-15T14:00:00.000Z', 7000, 1),
  makeSale('sale-3', '2026-06-10T14:00:00.000Z', 3000, 4),
];

describe('MonthlyRevenueComparisonChart', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title and mode controls', () => {
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    expect(screen.getByText('Comparativo de Faturamento Mensal')).toBeInTheDocument();
    expect(screen.getByText('Acumulado')).toBeInTheDocument();
    expect(screen.getByText('Diário')).toBeInTheDocument();
  });

  it('renders nerd statistics section with winner calculation', () => {
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    expect(screen.getByText('Estatísticas Nerds de Comparação')).toBeInTheDocument();
    expect(screen.getByText(/é o Campeão/i)).toBeInTheDocument();
  });

  it('defaults the metric to aparelhos vendidos', () => {
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    expect(screen.getByRole('button', { name: /aparelhos/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /faturamento/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Compare os aparelhos vendidos entre meses/i)).toBeInTheDocument();
  });

  it('switches the whole comparison between aparelhos and faturamento', async () => {
    const user = userEvent.setup();
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    // Padrão (aparelhos): junho vence com 4 contra 3 de julho.
    expect(screen.getByText(/Junho 2026 é o Campeão em Aparelhos Vendidos/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1 aparelho \(33%\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /faturamento/i }));

    // Em R$ o pódio inverte: julho fez 12.000 contra 3.000 de junho.
    expect(screen.getByText(/Julho 2026 é o Campeão de Faturamento/i)).toBeInTheDocument();
    expect(screen.getByText(/\+R\$\s?9\.000 \(300%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Compare o faturamento entre meses/i)).toBeInTheDocument();
  });

  it('allows toggling mode between Acumulado and Diário', async () => {
    const user = userEvent.setup();
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    const dailyBtn = screen.getByRole('button', { name: /diário/i });
    expect(dailyBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(dailyBtn);

    expect(dailyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(dailyBtn).toHaveClass('shadow-sm');
    expect(screen.getByRole('button', { name: /acumulado/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('allows selecting presets like Mês vs Anterior', async () => {
    const user = userEvent.setup();
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    const presetBtn = screen.getByRole('button', { name: /mês vs anterior/i });
    await user.click(presetBtn);

    expect(screen.getByText('Estatísticas Nerds de Comparação')).toBeInTheDocument();
  });

  it('compares partial current month against closed months over the same day range', () => {
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    // Julho está em curso no dia 29, junho está fechado (30 dias): o recorte
    // comum é 1–29, e isso precisa estar dito na tela.
    expect(screen.getByText(/apenas os dias 1 a 29 de cada mês/i)).toBeInTheDocument();
    expect(screen.getByText(/é o Campeão/i)).toBeInTheDocument();
  });

  it('marks the in-progress month and shows a projection for it', () => {
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    expect(screen.getByText('Em curso')).toBeInTheDocument();
    // Média diária 12.000/29 ≈ 413,79 → projeção para 31 dias ≈ 12.828
    expect(screen.getByText(/Projeção p\/ fim do mês/i)).toBeInTheDocument();
  });

  it('reports units as the headline number and revenue as context', () => {
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    // Julho: 2 + 1 aparelhos; junho: 4 aparelhos.
    expect(screen.getByText('3 aparelhos')).toBeInTheDocument();
    expect(screen.getByText('4 aparelhos')).toBeInTheDocument();
    // O faturamento continua visível como linha secundária do mesmo card.
    expect(screen.getByText('R$ 12.000')).toBeInTheDocument();
    expect(screen.getByText('R$ 3.000')).toBeInTheDocument();
  });

  it('picks the peak day by the selected metric', async () => {
    const user = userEvent.setup();
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    // Em aparelhos o pico de julho é o dia 5 (2 un.), não o dia 15 (1 un.),
    // que é o dia de maior faturamento.
    expect(screen.getByText(/Dia 5 · 2 aparelhos/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /faturamento/i }));

    expect(screen.getByText(/Dia 15 · R\$\s?7\.000/)).toBeInTheDocument();
  });

  it('shows "Sem vendas" instead of a fake day 1 peak when a month had none', () => {
    render(<MonthlyRevenueComparisonChart sales={[makeSale('s', '2026-07-05T14:00:00.000Z', 5000)]} />);

    // Junho não teve vendas → o pico não pode aparecer como "Dia 1 (R$ 0)".
    expect(screen.getByText('Sem vendas')).toBeInTheDocument();
  });

  it('renders a designed empty state when no selected month has revenue', () => {
    render(<MonthlyRevenueComparisonChart sales={[]} />);

    expect(screen.getByText('Nenhuma venda nos meses selecionados')).toBeInTheDocument();
    expect(screen.queryByText('Estatísticas Nerds de Comparação')).not.toBeInTheDocument();
    // Os controles continuam disponíveis para o usuário sair do estado vazio.
    expect(screen.getByRole('button', { name: /adicionar mês/i })).toBeInTheDocument();
  });

  it('exposes the month picker as an accessible listbox and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    const trigger = screen.getByRole('button', { name: /adicionar mês/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(listbox).getByText('2 de 6 selecionados')).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: /Julho 2026/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  describe('filtros de loja e funcionário', () => {
    const stores: StoreLocation[] = [
      { id: 'store-a', name: 'Loja Centro', city: 'Fortaleza' },
      { id: 'store-b', name: 'Loja Norte', city: 'Sobral' },
    ];
    const sellers: Seller[] = [
      { id: 'sell-a', name: 'Ana', email: 'a@x.com', authUserId: 'u1', storeId: 'store-a', totalSales: 0 },
      { id: 'sell-b', name: 'Bruno', email: 'b@x.com', authUserId: 'u2', storeId: 'store-b', totalSales: 0 },
    ];
    const scopedSales: Sale[] = [
      { ...makeSale('a1', '2026-07-05T14:00:00.000Z', 5000, 2), storeId: 'store-a', sellerId: 'sell-a' },
      { ...makeSale('b1', '2026-07-06T14:00:00.000Z', 9000, 3), storeId: 'store-b', sellerId: 'sell-b' },
    ];

    const renderScoped = () =>
      render(<MonthlyRevenueComparisonChart sales={scopedSales} sellers={sellers} stores={stores} />);

    it('narrows the revenue to the selected store', async () => {
      const user = userEvent.setup();
      renderScoped();

      // Sem filtro: as duas vendas somam R$ 14.000 / 5 aparelhos.
      expect(screen.getByText('R$ 14.000')).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Loja'), 'store-a');

      expect(screen.getByText('R$ 5.000')).toBeInTheDocument();
      expect(screen.queryByText('R$ 14.000')).not.toBeInTheDocument();
      expect(screen.getByText('2 aparelhos')).toBeInTheDocument();
    });

    it('narrows the seller list to the selected store and resets a stale seller', async () => {
      const user = userEvent.setup();
      renderScoped();

      const sellerSelect = screen.getByLabelText('Funcionário');
      await user.selectOptions(sellerSelect, 'sell-b');
      expect(sellerSelect).toHaveValue('sell-b');

      // Bruno é da Loja Norte: ao escolher a Loja Centro ele sai da lista e a
      // seleção volta para "todos" em vez de filtrar um vazio silencioso.
      await user.selectOptions(screen.getByLabelText('Loja'), 'store-a');

      expect(sellerSelect).toHaveValue('all');
      expect(within(sellerSelect).queryByRole('option', { name: 'Bruno' })).not.toBeInTheDocument();
      expect(within(sellerSelect).getByRole('option', { name: 'Ana' })).toBeInTheDocument();
    });

    it('clears filters and explains an empty result caused by them', async () => {
      const user = userEvent.setup();
      renderScoped();

      // Loja Centro + Bruno (Loja Norte) é impossível pela lista, então filtramos
      // por uma loja sem vendas no período comparado.
      await user.selectOptions(screen.getByLabelText('Loja'), 'store-b');
      await user.selectOptions(screen.getByLabelText('Funcionário'), 'sell-b');
      expect(screen.getByText('R$ 9.000')).toBeInTheDocument();

      await user.click(screen.getAllByRole('button', { name: /limpar filtros/i })[0]);

      expect(screen.getByText('R$ 14.000')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /limpar filtros/i })).not.toBeInTheDocument();
    });

    it('shows a filter-aware empty state', async () => {
      const user = userEvent.setup();
      render(
        <MonthlyRevenueComparisonChart
          sales={[{ ...makeSale('a1', '2026-07-05T14:00:00.000Z', 5000), storeId: 'store-a', sellerId: 'sell-a' }]}
          sellers={sellers}
          stores={stores}
        />
      );

      await user.selectOptions(screen.getByLabelText('Loja'), 'store-b');

      expect(screen.getByText('Nenhuma venda para este filtro')).toBeInTheDocument();
    });

    it('hides the store filter when there is only one store', () => {
      render(<MonthlyRevenueComparisonChart sales={scopedSales} sellers={sellers} stores={[stores[0]]} />);

      expect(screen.queryByLabelText('Loja')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Funcionário')).toBeInTheDocument();
    });
  });

  it('keeps at least one month selected', async () => {
    const user = userEvent.setup();
    render(<MonthlyRevenueComparisonChart sales={mockSales} />);

    await user.click(screen.getByRole('button', { name: /Remover Junho 2026 da comparação/i }));

    // Sobrou só julho: o botão de remover some e a opção fica desabilitada.
    expect(screen.queryByRole('button', { name: /Remover Julho 2026 da comparação/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /adicionar mês/i }));
    expect(screen.getByRole('option', { name: /Julho 2026/ })).toBeDisabled();
  });
});
