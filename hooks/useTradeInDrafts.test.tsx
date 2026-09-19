import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTradeInDrafts } from './useTradeInDrafts';
import type { TradeInAdjustmentRule, TradeInValueRule } from '../utils/simulator';

const valueRules: TradeInValueRule[] = [
  { id: 'v1', model: 'iPhone 15 Pro Max', capacity: '256GB', baseValue: 4100, isActive: true },
  { id: 'v2', model: 'iPhone 15 Pro Max', capacity: '512GB', baseValue: 4500, isActive: true },
  { id: 'v3', model: 'iPhone 13', capacity: '128GB', baseValue: 1700, isActive: true },
  { id: 'v4', model: 'iPhone 16', capacity: '128GB', baseValue: 3000, isActive: true },
  { id: 'v5', model: 'iPhone 12', capacity: '64GB', baseValue: 1000, isActive: false },
];

const adjustmentRules: TradeInAdjustmentRule[] = [
  { id: 'adj-1', label: 'Marcas de uso', model: 'iPhone 15 Pro Max', amountDelta: -500, isActive: true },
];

const renderDrafts = (maxDrafts?: number) => renderHook(() => useTradeInDrafts({
  valueRules,
  adjustmentRules,
  ...(maxDrafts ? { maxDrafts } : {}),
}));

describe('useTradeInDrafts', () => {
  it('começa com um aparelho vazio, que não entra na cotação', () => {
    const { result } = renderDrafts();

    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].isEmpty).toBe(true);
    expect(result.current.tradeInInputs).toEqual([]);
    expect(result.current.receivedTotal).toBe(0);
  });

  it('lista os modelos ativos por família, do mais novo para o mais antigo', () => {
    const { result } = renderDrafts();

    expect(result.current.modelOptions).toEqual(['iPhone 16', 'iPhone 15 Pro Max', 'iPhone 13']);
  });

  it('deriva o valor da tabela e o mantém depois que o vendedor edita', () => {
    const { result } = renderDrafts();
    const id = result.current.drafts[0].id;

    act(() => result.current.setModel(id, 'iPhone 15 Pro Max'));
    act(() => result.current.setCapacity(id, '256GB'));
    expect(result.current.views[0].valueInput).toBe('4100');
    expect(result.current.views[0].receivedValue).toBe(4100);

    act(() => result.current.setValue(id, '3900'));
    expect(result.current.views[0].valueInput).toBe('3900');
    expect(result.current.views[0].receivedValue).toBe(3900);

    // Trocar o aparelho é uma decisão deliberada: o valor volta a derivar.
    act(() => result.current.setCapacity(id, '512GB'));
    expect(result.current.views[0].valueInput).toBe('4500');
  });

  it('aplica ajustes de condição sobre o valor derivado', () => {
    const { result } = renderDrafts();
    const id = result.current.drafts[0].id;

    act(() => result.current.setModel(id, 'iPhone 15 Pro Max'));
    act(() => result.current.setCapacity(id, '256GB'));
    expect(result.current.views[0].adjustments.map((item) => item.id)).toEqual(['adj-1']);

    act(() => result.current.toggleAdjustment(id, 'adj-1'));
    expect(result.current.views[0].receivedValue).toBe(3600);
    expect(result.current.tradeInInputs[0].selectedAdjustmentIds).toEqual(['adj-1']);
  });

  it('oferece só as capacidades cadastradas para o modelo escolhido', () => {
    const { result } = renderDrafts();
    const id = result.current.drafts[0].id;

    act(() => result.current.setModel(id, 'iPhone 15 Pro Max'));
    expect(result.current.views[0].capacityOptions).toEqual(['256GB', '512GB']);
  });

  it('aceita aparelho fora da tabela com valor digitado', () => {
    const { result } = renderDrafts();
    const id = result.current.drafts[0].id;

    act(() => result.current.setMode(id, 'custom'));
    act(() => result.current.setModel(id, 'Galaxy S23'));
    act(() => result.current.setCapacity(id, '256GB'));
    act(() => result.current.setValue(id, '1.800'));

    expect(result.current.views[0].baseValue).toBeNull();
    expect(result.current.views[0].adjustments).toEqual([]);
    expect(result.current.views[0].receivedValue).toBe(1800);
    expect(result.current.tradeInInputs[0]).toMatchObject({ model: 'Galaxy S23', manualReceivedValue: 1800 });
  });

  it('soma vários aparelhos e respeita o limite da lista', () => {
    const { result } = renderDrafts(2);
    const first = result.current.drafts[0].id;

    act(() => result.current.setModel(first, 'iPhone 15 Pro Max'));
    act(() => result.current.setCapacity(first, '256GB'));
    act(() => { result.current.addDraft(); });

    const second = result.current.drafts[1].id;
    act(() => result.current.setModel(second, 'iPhone 13'));
    act(() => result.current.setCapacity(second, '128GB'));

    expect(result.current.receivedTotal).toBe(5800);
    expect(result.current.tradeInInputs).toHaveLength(2);
    expect(result.current.canAddDraft).toBe(false);

    act(() => { result.current.addDraft(); });
    expect(result.current.drafts).toHaveLength(2);
  });

  it('remove um aparelho e mantém pelo menos um card em branco', () => {
    const { result } = renderDrafts();
    const first = result.current.drafts[0].id;

    act(() => { result.current.addDraft(); });
    act(() => result.current.removeDraft(first));
    expect(result.current.drafts).toHaveLength(1);

    act(() => result.current.setModel(result.current.drafts[0].id, 'iPhone 13'));
    act(() => result.current.removeDraft(result.current.drafts[0].id));
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.views[0].isEmpty).toBe(true);
  });

  it('não perde a edição manual quando as regras chegam em novas referências (resync)', () => {
    const { result, rerender } = renderHook(
      ({ rules }: { rules: TradeInValueRule[] }) => useTradeInDrafts({ valueRules: rules, adjustmentRules }),
      { initialProps: { rules: valueRules } },
    );
    const id = result.current.drafts[0].id;

    act(() => result.current.setModel(id, 'iPhone 15 Pro Max'));
    act(() => result.current.setCapacity(id, '256GB'));
    act(() => result.current.setValue(id, '3900'));

    rerender({ rules: valueRules.map((rule) => ({ ...rule })) });

    expect(result.current.views[0].valueInput).toBe('3900');
  });
});
