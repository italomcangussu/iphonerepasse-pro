# Exportação CSV de Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à tela Clientes um download CSV da base completa, com uma linha por cliente e histórico de aparelhos e cidades consolidado.

**Architecture:** Um módulo puro recebe clientes, vendas e lojas e produz o CSV. `Clients.tsx` cria um Blob UTF-8 com BOM e dispara seu download.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library e lucide-react.

## Global Constraints

- Exportar todos os clientes, independente da busca ativa.
- Usar as colunas `nome`, `telefone`, `cpf`, `data de nascimento`, `modelo de aparelho comprado`, `cidade`, nesta ordem.
- Manter uma única linha por cliente; valores múltiplos únicos usam ` | `.
- A cidade vem de `StoreLocation.city`, resolvida por `Sale.storeId` ou pelo `storeId` do primeiro item vendido.
- CSV é UTF-8 com BOM, separado por vírgulas e com escape RFC 4180.
- Não adicionar dependências.

---

### Task 1: Gerador puro do CSV

**Files:**
- Create: `pages/clients/clientExport.ts`
- Create: `pages/clients/clientExport.test.ts`

**Interfaces:**
- Consumes: `Customer`, `Sale` e `StoreLocation` de `types.ts`.
- Produces: `buildClientExportCsv(customers, sales, stores): string`.

- [x] **Step 1: Write the failing test**

```ts
it('consolida aparelhos e cidades únicos em uma linha por cliente', () => {
  const csv = buildClientExportCsv([cliente], [vendaSobral, vendaFortaleza], lojas);
  expect(csv).toContain('Ana,88999999999,123,,iPhone 15 | iPad Air,Sobral | Fortaleza');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- pages/clients/clientExport.test.ts --run`

Expected: FAIL because `./clientExport` does not exist.

- [x] **Step 3: Write minimal implementation**

Implementar `buildClientExportCsv` com cabeçalho, uma linha por cliente, deduplicação preservando ordem, cidades por `sale.storeId || sale.items[0]?.storeId`, campos vazios para clientes sem vendas, escape de aspas/vírgulas/quebras de linha e `\uFEFF` no começo.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- pages/clients/clientExport.test.ts --run`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add pages/clients/clientExport.ts pages/clients/clientExport.test.ts
git commit -m "feat: adiciona gerador CSV de clientes"
```

### Task 2: Download na tela Clientes

**Files:**
- Modify: `pages/Clients.tsx`
- Modify: `pages/Clients.test.tsx`

**Interfaces:**
- Consumes: `buildClientExportCsv(customers, sales, stores)`.
- Produces: Botão acessível `Exportar CSV` que baixa `clientes_YYYY-MM-DD.csv`.

- [x] **Step 1: Write the failing test**

```tsx
it('baixa a exportação CSV de todos os clientes', async () => {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:clientes');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  render(<Clients />);
  await userEvent.setup().click(screen.getByRole('button', { name: /exportar csv/i }));
  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalled();
});
```

Atualizar o mock de `useData` para incluir `stores` e uma venda com `items` e `storeId`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- pages/Clients.test.tsx --run`

Expected: FAIL porque o botão ainda não existe.

- [x] **Step 3: Write minimal implementation**

Importar o gerador, obter `stores` do contexto, criar Blob `text/csv;charset=utf-8;` e link temporário com o nome datado. Adicionar o botão secundário antes de `Novo Cliente`, com `Download`, largura responsiva e `aria-label="Exportar CSV de clientes"`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- pages/Clients.test.tsx --run`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add pages/Clients.tsx pages/Clients.test.tsx
git commit -m "feat: exporta lista de clientes em CSV"
```

### Task 3: Verificação integrada

**Files:**
- Verify: `pages/clients/clientExport.test.ts`
- Verify: `pages/Clients.test.tsx`

- [x] **Step 1: Run focused suite**

Run: `npm test -- pages/clients/clientExport.test.ts pages/Clients.test.tsx --run`

Expected: PASS sem falhas.

- [x] **Step 2: Run type checking**

Run: `npm run typecheck`

Expected: exit code 0.

- [x] **Step 3: Commit plan tracking update**

```bash
git add docs/superpowers/plans/2026-09-03-clientes-exportacao-csv.md
git commit -m "docs: registra plano da exportação de clientes"
```
