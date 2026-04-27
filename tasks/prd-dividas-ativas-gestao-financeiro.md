# PRD: Dívidas Ativas — Menu de Gestão e Aba no Financeiro

## 1. Introdução / Visão Geral

Hoje o sistema cobre apenas o lado **a receber** (Devedores — clientes que devem para a iPhone Repasse) através de `pages/Debtors.tsx` + tipos `Debt` / `DebtPayment` em [types.ts:165](types.ts:165).

Esta feature cria o lado **a pagar**: **Dívidas Ativas** — situações em que a iPhone Repasse deve para uma pessoa física ou empresa (fornecedor, sócio, prestador, etc.). A lógica é espelhada de Devedores, mas com fluxo financeiro invertido: cada pagamento parcial **sai** do caixa/banco em vez de entrar.

Inclui:

1. **Novo menu** "Dívidas Ativas" no grupo **Gestão** (ao lado de Financeiro, Estoque de Peças, etc.).
2. **Tela dedicada** com lista, busca, filtros, criar/editar/excluir dívida, registrar pagamentos parciais com valores diferentes até quitar.
3. **Aba "Dívidas Ativas"** dentro de `pages/Finance.tsx`, espelhando a aba "Devedores" existente.
4. Cada pagamento gera uma `Transaction` do tipo `OUT` na conta selecionada (Banco/Cofre), com categoria "Pagamento de dívida ativa".

A meta é centralizar contas a pagar em um lugar previsível, alinhado ao padrão visual e de dados já consolidado em Devedores.

## 2. Objetivos

- Cadastrar uma dívida ativa com: credor (pessoa ou empresa), valor original, vencimento, parcelas, observações.
- Registrar **N pagamentos parciais** com valores arbitrários e datas próprias, decrementando o saldo restante até quitar.
- Acompanhar status (`Aberta` / `Parcial` / `Quitada`) e badge de prazo (`Em aberto` / `Atrasado` / `Em dias`) reaproveitando a regra de Devedores.
- Refletir cada pagamento como **saída** (`Transaction.type = 'OUT'`) na conta de origem (Banco ou Cofre).
- Apresentar **resumo financeiro** (total a pagar, atrasado, quitado) tanto na tela dedicada quanto na aba do Financeiro.
- Permitir editar/excluir dívidas e estornar pagamentos individuais (espelho do que existe em Devedores).
- Manter **acesso restrito a admin** (mesmo padrão `adminOnly: true` de Financeiro/Devedores).

## 3. User Stories

### US-001: Modelo de dados de Dívida Ativa
**Description:** Como desenvolvedor, preciso de tipos e tabelas para persistir dívidas ativas e seus pagamentos, espelhando `Debt`/`DebtPayment`.

**Acceptance Criteria:**
- [ ] Adicionar em [types.ts](types.ts) os tipos:
  - `PayableDebtStatus = 'Aberta' | 'Parcial' | 'Quitada'`
  - `PayableDebtSource = 'manual' | 'import_anexo'`
  - `PayableDebt { id, creditorId, creditorName, creditorDocument?, creditorPhone?, originalAmount, remainingAmount, status, dueDate?, firstDueDate?, installmentsTotal?, notes?, source, createdAt, updatedAt }`
  - `PayableDebtPayment { id, payableDebtId, amount, paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão', account: 'Conta Bancária' | 'Cofre', paidAt, notes?, createdAt }`
- [ ] Migração Supabase cria tabelas `payable_debts` e `payable_debt_payments` com FKs e índices equivalentes a `debts`/`debt_payments`.
- [ ] `Transaction` ganha `payableDebtPaymentId?: string | null` (campo opcional, espelho do `debtPaymentId`).
- [ ] Typecheck passa.

### US-002: Entidade Credor (pessoa ou empresa)
**Description:** Como gestor, quero registrar a quem devemos — podendo ser uma pessoa física (CPF) ou jurídica (CNPJ ou nome livre).

**Acceptance Criteria:**
- [ ] `Creditor { id, name, document?, documentType?: 'CPF' | 'CNPJ', phone?, email?, notes?, createdAt, updatedAt }` em [types.ts](types.ts).
- [ ] Migração Supabase cria tabela `creditors` (separada de `customers` — domínio distinto).
- [ ] CRUD básico via `services/dataContext.tsx`: `addCreditor`, `updateCreditor`, `deleteCreditor`, `creditors` no contexto.
- [ ] Campo `name` obrigatório; demais opcionais; validar formato de CPF/CNPJ quando `documentType` informado.
- [ ] Typecheck passa.

### US-003: Tela "Dívidas Ativas" — listagem, busca, filtros
**Description:** Como gestor, quero ver todas as dívidas ativas em uma tabela com busca por credor/notas e filtros por status e vencidos.

**Acceptance Criteria:**
- [ ] Nova rota `/payable-debts` em [App.tsx](App.tsx) e nova página `pages/PayableDebts.tsx`.
- [ ] Item de menu **"Dívidas Ativas"** em [components/Layout.tsx](components/Layout.tsx) no grupo `management`, com `adminOnly: true` e nova `permissionKey: 'payable_debts'` (registrar em [lib/permissions.ts](lib/permissions.ts)).
- [ ] Layout espelha [pages/Debtors.tsx](pages/Debtors.tsx): cards de resumo (Total a pagar / Atrasado / Quitado), tabela com colunas Credor, Valor original, Saldo, Vencimento, Status, Prazo, Ações.
- [ ] Busca filtra por nome do credor ou notas (case-insensitive, trim).
- [ ] Filtro de status (`all` | `Aberta` | `Parcial` | `Quitada`) + toggle "apenas atrasadas".
- [ ] Estado vazio com CTA "+ Nova dívida ativa".
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-004: Criar/editar dívida ativa
**Description:** Como gestor, quero cadastrar uma nova dívida ativa selecionando ou criando o credor, definindo valor, vencimento, parcelas e observações.

**Acceptance Criteria:**
- [ ] Modal "Nova dívida ativa" / "Editar dívida ativa" com campos:
  - Credor (autocomplete sobre `creditors` + botão "+ Novo credor" que abre modal inline)
  - Valor original (R$, > 0)
  - Vencimento (date picker; opcional)
  - Parcelas (`installmentsTotal`, número inteiro ≥ 1; opcional)
  - Primeira parcela (`firstDueDate`; opcional, default = vencimento)
  - Observações (textarea)
- [ ] Ao salvar nova dívida: `originalAmount = remainingAmount`, `status = 'Aberta'`, `source = 'manual'`.
- [ ] Edição não altera `originalAmount` se já houver pagamentos; bloquear redução abaixo do total já pago.
- [ ] Excluir dívida só é permitido se não houver pagamentos (caso contrário, exigir estorno prévio).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-005: Registrar pagamento parcial (com comprovante opcional)
**Description:** Como gestor, quero registrar pagamentos parciais com valores arbitrários e datas próprias até quitar a dívida, anexando comprovante (foto/PDF) quando disponível.

**Acceptance Criteria:**
- [ ] Modal "Registrar pagamento" abre a partir da linha da dívida (ação principal).
- [ ] Campos: valor (≤ `remainingAmount`, > 0), método de pagamento (Pix/Dinheiro/Cartão), conta de origem (Banco/Cofre — **não** "Devedores"), data do pagamento, notas, **anexo de comprovante (opcional)**.
- [ ] Upload do anexo aceita imagens (JPG/PNG/WEBP) e PDF, com tamanho máximo de 10 MB e validação client-side de MIME.
- [ ] Anexo enviado para bucket Supabase Storage (US-013) **antes** da escrita do pagamento; se upload falhar, pagamento não é gravado.
- [ ] Sem taxa de cartão: o campo `paymentMethod` é apenas classificação contábil — valor digitado é o valor final lançado, sem cálculo de fee/acréscimo (diferente do PDV).
- [ ] Ao salvar:
  - Insere `PayableDebtPayment` (com `attachmentPath`/`attachmentMime`/`attachmentName` se houver anexo).
  - Atualiza `remainingAmount = remainingAmount - amount` na dívida.
  - Atualiza `status`: `Quitada` se `remainingAmount <= 0`; `Parcial` se houve pagamento parcial; `Aberta` continua se nenhum pagamento foi feito.
  - Insere `Transaction { type: 'OUT', category: 'Pagamento de dívida ativa', account, amount, date, payableDebtPaymentId }`.
- [ ] Operação atômica (transação Supabase): falha em qualquer passo reverte tudo. Se a transação for revertida após upload, o objeto no Storage deve ser removido (cleanup).
- [ ] Histórico de pagamentos exibido em modal "Detalhes da dívida" (lista cronológica reversa) com botão "Ver comprovante" quando houver anexo.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-006: Estornar pagamento individual
**Description:** Como gestor, quero estornar um pagamento específico de uma dívida ativa, revertendo saldo, transação financeira e removendo o comprovante anexado.

**Acceptance Criteria:**
- [ ] Botão "Estornar" em cada item do histórico de pagamentos.
- [ ] Confirmação obrigatória ("Esta ação não pode ser desfeita").
- [ ] Ao estornar: deleta `PayableDebtPayment`, reverte `remainingAmount += amount`, recalcula `status`, deleta `Transaction` correspondente (via `payableDebtPaymentId`) e **remove o objeto de comprovante** do bucket Supabase (se houver).
- [ ] Operação atômica: rollback completo se qualquer passo falhar.
- [ ] Typecheck e lint passam.

### US-013: Bucket Supabase Storage para comprovantes de pagamento
**Description:** Como sistema, preciso de um bucket dedicado para guardar comprovantes de pagamento de dívidas ativas com URLs assinadas e RLS adequada.

**Acceptance Criteria:**
- [ ] Criar bucket `payable-debt-receipts` (privado) via migração ou bootstrap.
- [ ] Estrutura de path: `{org_id}/{payable_debt_id}/{payment_id}-{timestamp}.{ext}`.
- [ ] Policy RLS no bucket: leitura/escrita restrita a admins/managers da mesma organização (espelhar policies dos demais buckets do projeto).
- [ ] Visualização do comprovante usa **URL assinada** (signed URL com expiração curta — sugestão: 5 minutos) gerada sob demanda; não expor URL pública.
- [ ] Adicionar em `PayableDebtPayment` os campos: `attachmentPath?: string`, `attachmentMime?: string`, `attachmentName?: string`, `attachmentSize?: number`.
- [ ] Helper `services/storage.ts` (ou equivalente existente) exporta `uploadPayableDebtReceipt(file, path)` e `getPayableDebtReceiptSignedUrl(path)`.
- [ ] Limpeza: ao excluir uma dívida (somente permitido sem pagamentos — FR-7), nada a remover; ao estornar pagamento, remover o objeto.
- [ ] Typecheck e lint passam.

### US-007: Categoria financeira "Pagamento de dívida ativa"
**Description:** Como sistema, preciso garantir que a categoria padrão exista para classificar saídas geradas por pagamentos.

**Acceptance Criteria:**
- [ ] Seed na migração ou bootstrap em `dataContext` cria `FinancialCategory { name: 'Pagamento de dívida ativa', type: 'OUT', isDefault: true }`.
- [ ] Categoria não pode ser excluída pelo usuário (já há regra similar para defaults — manter consistência com [prd-fix-finance-category-delete-no-action.md](tasks/prd-fix-finance-category-delete-no-action.md)).
- [ ] Typecheck passa.

### US-008: Aba "Dívidas Ativas" em Finance.tsx
**Description:** Como gestor, quero ver dívidas ativas dentro do Financeiro, espelhando a aba "Devedores".

**Acceptance Criteria:**
- [ ] Adicionar `'payable_debts'` ao `TabType` em [pages/Finance.tsx:22](pages/Finance.tsx:22).
- [ ] Nova aba "Dívidas Ativas" no array de tabs (após "Devedores").
- [ ] Conteúdo da aba: cards de resumo + tabela compacta de dívidas (sem ações de criar/editar — link "Ir para Dívidas Ativas" leva para `/payable-debts`).
- [ ] Tabela mostra: credor, valor original, saldo, vencimento, status, prazo.
- [ ] Filtros: busca + status + atrasadas (mesmo padrão da aba Devedores).
- [ ] `data-testid="finance-tab-payable_debts"` para consistência com `finance-tab-debtors`.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-009: Resumo financeiro inclui dívidas ativas no dashboard de Finance
**Description:** Como gestor, quero que o card "Saldo consolidado" do Financeiro reflita o passivo das dívidas ativas (informativo, não somado ao caixa).

**Acceptance Criteria:**
- [ ] Aba "Dashboard" do Financeiro ganha um card "Dívidas Ativas em aberto: R$ X" (vermelho/atenção) ao lado dos cards atuais.
- [ ] Valor = soma de `remainingAmount` das dívidas com status ≠ `Quitada`.
- [ ] Não altera o saldo consolidado de Banco/Cofre (separar passivo de caixa).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-010: Permissões e visibilidade
**Description:** Como admin, quero controlar quem vê e edita Dívidas Ativas no `Settings → Permissões`.

**Acceptance Criteria:**
- [ ] `permissionKey: 'payable_debts'` registrada em [lib/permissions.ts](lib/permissions.ts) com níveis `hidden | visible | editable`.
- [ ] Default: `admin → editable`, `manager → visible`, `seller → hidden`.
- [ ] Tela de Settings de permissões lista a nova permissão automaticamente.
- [ ] Tentativas de acesso direto via URL respeitam o gate.
- [ ] Typecheck e lint passam.

### US-011: Telemetria
**Description:** Como time de produto, quero rastrear uso da feature.

**Acceptance Criteria:**
- [ ] Eventos em `services/telemetry.ts`:
  - `payable_debt_created`
  - `payable_debt_updated`
  - `payable_debt_deleted`
  - `payable_debt_payment_registered` (com `metadata: { amount, account, isFullSettlement }`)
  - `payable_debt_payment_reverted`
  - `payable_debts_view_opened`
- [ ] Disparados nos respectivos handlers.

### US-012: Testes
**Description:** Como dev, quero cobertura mínima para evitar regressão.

**Acceptance Criteria:**
- [ ] `utils/payableDebts.ts` (espelho de `utils/debts.ts`) com `payableDebts.test.ts` cobrindo: `isPayableDebtOverdue`, `getPayableDebtDeadlineBadge`, `calculatePayableDebtSummary`, `filterPayableDebts`, `validatePayableDebtPaymentAmount`.
- [ ] `pages/PayableDebts.test.tsx` cobre: render lista, criar dívida, registrar pagamento parcial **com e sem anexo**, quitar dívida, estornar pagamento (com cleanup do bucket mockado).
- [ ] `pages/Finance.test.tsx` ganha caso para a nova aba (render + filtros + ausência de botões de ação — verificação de read-only).
- [ ] Smoke test em `tests/smoke/` ganha um cenário curto: criar dívida → pagamento parcial → pagamento de quitação → conferir saldo Banco decrementado.

## 4. Functional Requirements

- **FR-1:** Dívida Ativa é distinta de Devedor: Devedor é "alguém deve para nós" (entrada futura); Dívida Ativa é "nós devemos para alguém" (saída futura).
- **FR-2:** Credor é uma entidade própria (`creditors`), **não** reaproveita `customers` — domínios distintos para evitar mistura conceitual.
- **FR-3:** Pagamento de dívida ativa **sempre** sai de Banco ou Cofre — nunca da conta "Devedores".
- **FR-4:** Cada pagamento gera exatamente uma `Transaction` do tipo `OUT`, com `category = 'Pagamento de dívida ativa'`, vinculada via `payableDebtPaymentId`.
- **FR-5:** Status da dívida é derivado: `Quitada` se `remainingAmount <= 0`; `Parcial` se houve pelo menos 1 pagamento e ainda há saldo; `Aberta` se nenhum pagamento.
- **FR-6:** Badge de prazo segue a regra de `getDebtDeadlineBadge` aplicada à dívida ativa (mesma lógica de datas).
- **FR-7:** Excluir uma dívida com pagamentos é bloqueado; é necessário estornar todos os pagamentos primeiro.
- **FR-8:** Editar `originalAmount` é permitido enquanto não houver pagamentos; depois, só permite aumentar (nunca abaixo do total já pago).
- **FR-9:** Operações de pagamento e estorno são atômicas (transação Supabase ou rollback explícito no `dataContext`).
- **FR-10:** Permissão `payable_debts` é separada de `debtors` e `finance`; default `adminOnly: true` para o item de menu.
- **FR-11:** Aba "Dívidas Ativas" no Financeiro é **somente leitura** (CRUD acontece na tela dedicada `/payable-debts`); nenhum botão de criar/editar/pagar/estornar é exibido nessa aba — apenas link "Ir para Dívidas Ativas".
- **FR-12:** Categoria "Pagamento de dívida ativa" é default (`isDefault: true`) e não pode ser excluída.
- **FR-13:** Pagamento por cartão **não** aplica taxa nem acréscimo — `paymentMethod` é puramente classificação contábil; o valor digitado é o valor lançado em caixa.
- **FR-14:** Cada `PayableDebtPayment` pode ter no máximo **um** comprovante anexado. Re-upload substitui o anterior (remove o antigo do bucket).
- **FR-15:** Dívida ativa é sempre 1:1 com um único credor — não há rateio entre múltiplos credores; cenários de rateio devem ser modelados como dívidas separadas.

## 5. Non-Goals (Fora de Escopo)

- **Não** importar dívidas via anexo/CSV neste PRD (manter `source: 'import_anexo'` apenas como tipo, sem UI).
- **Não** integrar com sistemas externos (boletos, ERP, contas a pagar bancárias).
- **Não** gerar parcelas individuais como linhas separadas (`installmentsTotal` é informativo; saldo é único).
- **Não** alterar o conceito da conta financeira "Devedores" (continua sendo usada para entradas pendentes de clientes).
- **Não** permitir que um credor seja um cliente automaticamente (relacionamento manual; usuário pode digitar o mesmo nome se quiser).
- **Não** adicionar lembretes/notificações de vencimento neste PRD.
- **Não** vincular dívida ativa a `Sale` (saídas para fornecedores não são vendas).
- **Não** aplicar taxa/acréscimo de cartão em pagamentos (FR-13).
- **Não** permitir registrar/editar pagamentos pela aba do Financeiro — somente leitura (FR-11).
- **Não** permitir múltiplos credores por dívida (FR-15).
- **Não** suportar múltiplos anexos por pagamento (apenas um comprovante por pagamento — FR-14).

## 6. Design Considerations

- **Reuso visual**: clonar layout de [pages/Debtors.tsx](pages/Debtors.tsx) — cards de resumo no topo, tabela ao centro, filtros à direita, botão primário "+ Nova dívida ativa".
- **Cor do passivo**: usar tom de alerta (vermelho suave) nos cards de "Total a pagar" e "Atrasado", distinto do verde usado em entradas.
- **Ícone do menu**: reutilizar `DollarSign` (Lucide) do menu Financeiro/Devedores ou, para diferenciar, usar `HandCoins`/`ArrowDownCircle`. Decisão: `HandCoins` para distinguir visualmente.
- **Aba no Finance**: badge sutil com contagem de dívidas em aberto ao lado do label, espelhando padrões já vistos.
- **Modal de credor**: simples, com campos opcionais; não impor CPF/CNPJ obrigatórios para suportar credores informais.

## 7. Technical Considerations

- **Espelho de debts**: `utils/payableDebts.ts` é um espelho 1:1 de [utils/debts.ts](utils/debts.ts). Considerar extrair um helper genérico `createDebtUtils<T>()` se a duplicação ficar incômoda — mas neste PRD, **manter duplicação** para reduzir risco de acoplamento entre os dois domínios.
- **dataContext.tsx**: adicionar `creditors`, `payableDebts`, `payableDebtPayments` ao contexto + handlers `addPayableDebt`, `updatePayableDebt`, `deletePayableDebt`, `addPayableDebtPayment`, `revertPayableDebtPayment`.
- **Migração Supabase**: criar `creditors`, `payable_debts`, `payable_debt_payments`. RLS espelha as policies de `debts`/`debt_payments` (acesso restrito por organização/admin).
- **Transações atômicas**: como o caminho `addDebtPayment` atual já cria a `Transaction` e atualiza saldo na mesma chamada, replicar exatamente esse padrão em `addPayableDebtPayment`.
- **Permissões**: adicionar `payable_debts` à enum/array em [lib/permissions.ts](lib/permissions.ts).
- **Roteamento**: adicionar `<Route path="/payable-debts" element={<PayableDebts />} />` em [App.tsx](App.tsx) com gate `can('payable_debts', 'visible')`.
- **Performance**: lista paginada apenas se passar de 200 dívidas em aberto (mesmo limite empírico de Devedores hoje). Não otimizar antes.
- **Internacionalização**: textos em português (pt-BR) consistentes com o resto do app.

## 8. Success Metrics

- Gestor consegue cadastrar uma dívida ativa e registrar 1º pagamento em ≤ 60s.
- Cada pagamento de dívida ativa aparece corretamente como saída na aba Banco/Cofre do Financeiro.
- Resumo "Total a pagar" no dashboard do Financeiro bate exatamente com a soma de `remainingAmount` das dívidas em aberto.
- 0 regressões em Devedores (testes existentes verdes).
- 100% dos pagamentos têm `Transaction` correspondente (constraint validada por teste de integração).

## 9. Decisões Tomadas

- **Pagamento por cartão não aplica taxa/acréscimo.** `paymentMethod` é apenas classificação contábil; valor digitado é o lançado. → FR-13.
- **Comprovantes (foto/PDF) anexáveis** ao pagamento, armazenados em bucket privado Supabase Storage com URL assinada. → US-005, US-006, US-013, FR-14.
- **1:1 dívida-credor**, sem rateio. → FR-15.
- **Aba "Dívidas Ativas" no Financeiro é somente leitura.** → FR-11.

## 10. Open Questions

- Nenhuma pendente.
