# Sinal de reserva na tabela de estoque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar na aba Reservado se cada aparelho recebeu sinal e o valor recebido, sem ampliar a tabela.

**Architecture:** A tela `Inventory` já recebe o valor em `item.reservation.depositAmount`. A apresentação ficará no bloco de reserva da coluna Dispositivo, em ambas as variações responsivas da tabela, reutilizando `formatCurrencyBRL`; não haverá mudança de dados, API ou schema.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest e Testing Library.

## Global Constraints

- Use `reservation.depositAmount > 0` como único critério para sinal pago; `null`, `undefined` e `0` representam ausência de sinal.
- Reutilize `formatCurrencyBRL` para valores em reais.
- O texto deve comunicar o estado independentemente de cor e ficar dentro do bloco de reserva, sem criar uma coluna.
- Não altere os arquivos já modificados pelo usuário: `services/data/useDataRealtime.ts` e `services/dataContext.test.tsx`.

---

### Task 1: Cobrir os estados do sinal na tabela reservada

**Files:**
- Modify: `pages/Inventory.test.tsx:335-346`

**Interfaces:**
- Consumes: o fixture `stk-reserved`, cujo `reservation.depositAmount` é `250`.
- Produces: caracterização da cópia e formatação apresentadas no desktop para reservas com e sem sinal.

- [x] **Step 1: Escrever o teste que falha**

Após selecionar a aba Reservado, acrescente ao teste `separates reserved stock from available tab`:

```tsx
expect(screen.getByText('Sinal pago · R$ 250,00')).toBeInTheDocument();

const baseData = useDataMock();
useDataMock.mockReturnValue({
  ...baseData,
  stock: baseData.stock.map((item: any) =>
    item.id === 'stk-reserved'
      ? { ...item, reservation: { ...item.reservation, depositAmount: 0 } }
      : item
  )
});
```

Em um novo teste, renderize, selecione Reservado e valide:

```tsx
expect(screen.getByText('Sem sinal pago')).toBeInTheDocument();
expect(screen.queryByText(/Sinal pago · R\$ 0,00/)).not.toBeInTheDocument();
```

- [x] **Step 2: Rodar o teste para confirmar a falha**

Run: `npx vitest run pages/Inventory.test.tsx -t "separates reserved stock|shows when a reserved device has no deposit"`

Expected: FAIL porque a tela ainda não renderiza os textos de sinal.

- [x] **Step 3: Commit do teste caracterizador**

```bash
git add pages/Inventory.test.tsx
git commit -m "test: cover reservation deposit indicator"
```

### Task 2: Exibir o sinal no bloco da reserva

**Files:**
- Modify: `pages/Inventory.tsx:1141-1145`
- Modify: `pages/Inventory.tsx:1305-1309`
- Test: `pages/Inventory.test.tsx`

**Interfaces:**
- Consumes: `StockItem.reservation?.depositAmount?: number | null` e `formatCurrencyBRL(value)`.
- Produces: `Sinal pago · R$ N,NN` para valor positivo e `Sem sinal pago` nos demais casos.

- [x] **Step 1: Implementar a cópia de sinal imediatamente após o resumo da reserva**

Nas duas ocorrências de `item.status === StockStatus.RESERVED`, acrescente, depois do parágrafo `Reserva: ...`:

```tsx
<p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
  {typeof item.reservation?.depositAmount === 'number' && item.reservation.depositAmount > 0
    ? `Sinal pago · ${formatCurrencyBRL(item.reservation.depositAmount)}`
    : 'Sem sinal pago'}
</p>
```

No desktop, preserve o `mt-0.5` para manter o ritmo vertical do bloco de dispositivo.

- [x] **Step 2: Rodar os testes focados**

Run: `npx vitest run pages/Inventory.test.tsx -t "separates reserved stock|shows when a reserved device has no deposit"`

Expected: PASS.

- [x] **Step 3: Rodar verificações de integração da página**

Run: `npx vitest run pages/Inventory.test.tsx && npm run typecheck && npm run lint`

Expected: todos os comandos concluem com código 0.

- [x] **Step 4: Revisar o diff e cometer a implementação**

```bash
git diff --check
git add pages/Inventory.tsx pages/Inventory.test.tsx
git commit -m "feat: show reservation deposit in inventory"
```
