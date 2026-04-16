# PRD: Estoque iPhone, Compartilhamento e Financeiro com Devedores

## 1. Introdução

Este PRD define melhorias no fluxo de estoque e financeiro para operação mobile (com foco em iPhone) e gestão de devedores.
O objetivo é reduzir fricção ao adicionar fotos, melhorar o envio de informações para clientes via WhatsApp e ampliar o controle financeiro de dívidas parceladas.

## 2. Objetivos

- Garantir fluxo confiável de permissão para câmera/álbum no iPhone ao adicionar fotos de aparelhos no estoque.
- Permitir compartilhar dados de aparelho (inclusive fotos) via WhatsApp a partir do detalhe do item.
- Permitir baixar fotos do aparelho para o rolo da câmera no iPhone com fallback quando o navegador limitar o download automático.
- Incluir aba de Devedores dentro do Financeiro para visão integrada.
- Permitir definir e editar parcelamento de devedor com base no primeiro vencimento.
- Permitir lançamentos financeiros em `Conta Bancária`, `Cofre` e `Devedores`.
- Substituir o termo `Caixa` por `Conta Bancária` na experiência de usuário e no domínio de dados financeiro.

## 3. User Stories

### US-001: Fluxo de permissão de fotos no iPhone
**Descrição:** Como operador de estoque, quero um fluxo claro de permissão para câmera/álbum no iPhone para cadastrar fotos sem bloqueios inesperados.

**Critérios de Aceite:**
- [ ] Ao escolher câmera no iPhone, o sistema solicita acesso e exibe orientação se houver bloqueio.
- [ ] Ao escolher álbum no iPhone, o sistema abre seletor e orienta o usuário quando o navegador exigir ação manual.
- [ ] Em caso de permissão negada, a mensagem instrui caminho de correção (ajustes do navegador/sistema).
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-002: Compartilhar item de estoque via WhatsApp
**Descrição:** Como vendedor, quero compartilhar informações do aparelho via WhatsApp com opção de escolher o que enviar para responder clientes rapidamente.

**Critérios de Aceite:**
- [ ] Ao abrir um item do estoque, existe botão `Compartilhar via WhatsApp`.
- [ ] O clique abre modal com seleção de conteúdo (dados básicos, preço, observações, IMEI mascarado, fotos).
- [ ] O sistema abre `wa.me` com mensagem formatada conforme seleção.
- [ ] Quando possível, usa Web Share API para incluir fotos; quando não possível, abre WhatsApp com texto e orienta envio manual das imagens.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-003: Download de fotos do aparelho (foco iPhone)
**Descrição:** Como operador, quero baixar fotos do item para o rolo da câmera para reutilizar material com clientes e canais.

**Critérios de Aceite:**
- [ ] Ao abrir um item do estoque, existe botão `Baixar fotos`.
- [ ] Em navegadores com suporte, baixa os arquivos automaticamente.
- [ ] Em iPhone/Safari com limitação, apresenta fallback funcional (abrir foto em nova aba e instruir salvar na galeria).
- [ ] Exibe feedback de sucesso/erro por foto.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-004: Aba devedores no Financeiro
**Descrição:** Como gestor, quero visualizar devedores dentro do Financeiro para concentrar análise de caixa e recebíveis.

**Critérios de Aceite:**
- [ ] O Financeiro exibe aba `Devedores`.
- [ ] A aba mostra resumo de aberto/vencido/quitado e lista de devedores.
- [ ] Existe ação de acesso rápido para editar/baixar dados no contexto de devedores.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-005: Parcelamento editável para devedores (PDV e módulo devedores)
**Descrição:** Como operador financeiro, quero registrar e editar quantidade de parcelas e primeiro vencimento para controlar cobrança de forma previsível.

**Critérios de Aceite:**
- [ ] No PDV, ao adicionar pagamento `Devedor`, permite informar parcelas e primeiro vencimento.
- [ ] No módulo devedores, permite editar valor, parcelas e primeiro vencimento.
- [ ] Alterações persistem no banco e refletem em listagem/financeiro.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-006: Lançamentos financeiros em Conta Bancária/Cofre/Devedores
**Descrição:** Como gestor, quero registrar entradas e saídas em todas as contas financeiras relevantes para manter o saldo correto por conta.

**Critérios de Aceite:**
- [ ] O sistema aceita lançamentos para `Conta Bancária`, `Cofre` e `Devedores`.
- [ ] O saldo por conta considera os lançamentos corretamente.
- [ ] Fluxos existentes de transferência e pagamento continuam funcionando.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-007: Renomear Caixa para Conta Bancária
**Descrição:** Como usuário do sistema, quero ver a terminologia `Conta Bancária` no lugar de `Caixa` para refletir melhor a operação.

**Critérios de Aceite:**
- [ ] Interfaces principais usam `Conta Bancária` no lugar de `Caixa`.
- [ ] Mapeamentos de dados preservam compatibilidade com registros antigos.
- [ ] Constraints e validações de banco aceitam o novo valor de conta.
- [ ] Typecheck/lint passam.

## 4. Requisitos Funcionais

- FR-1: O modal de cadastro/edição de estoque deve oferecer seleção de origem de foto (câmera/álbum) com fluxo de permissão explícito para iPhone.
- FR-2: O detalhe do item de estoque deve possuir ações de compartilhamento por WhatsApp com modal de seleção de conteúdo.
- FR-3: O detalhe do item de estoque deve possuir ação de download de fotos com fallback compatível com iPhone.
- FR-4: A página Financeiro deve incluir aba de Devedores.
- FR-5: O domínio `debts` deve armazenar quantidade de parcelas e data de primeiro vencimento.
- FR-6: O PDV deve persistir metadados de devedor (`debt_installments`, `debt_due_date`, notas) no registro de pagamento.
- FR-7: O módulo Devedores deve permitir editar dívida existente incluindo parcelas e primeiro vencimento.
- FR-8: O domínio de transações financeiras deve aceitar contas `Conta Bancária`, `Cofre` e `Devedores`.
- FR-9: Interfaces e validações devem substituir `Caixa` por `Conta Bancária`, mantendo fallback de leitura para dados legados.
- FR-10: O projeto deve verificar e garantir configuração do bucket de imagens (`device-images`) e logos (`logos`) em migration idempotente.

## 5. Não Objetivos

- Não incluir envio automatizado de mídia por API oficial do WhatsApp Business.
- Não implementar cobrança automática, lembretes por WhatsApp ou régua de cobrança.
- Não alterar o modelo completo de conciliação contábil.
- Não migrar histórico de vendas para novo formato de parcelamento além dos campos necessários.

## 6. Considerações de Design

- Manter linguagem visual iOS já usada no projeto (modais, botões e badges).
- Priorizar componentes já existentes (`Modal`, `IOSButton`, `Toast`).
- Em iPhone, priorizar ações de baixa fricção e mensagens curtas com instrução clara.

## 7. Considerações Técnicas

- Criar migration idempotente para:
  - storage buckets/policies essenciais de `device-images` e `logos`;
  - novos campos em `debts` e `payment_methods`;
  - atualização de checks de conta (`Conta Bancária`, `Cofre`, `Devedores`).
- Garantir compatibilidade com dados antigos que ainda contenham `Caixa`.
- Atualizar tipos TS, mapeadores do DataContext, páginas `Finance`, `Debtors`, `PDV` e componentes de estoque.

## 8. Métricas de Sucesso

- Redução de erro de upload de fotos em iPhone durante cadastro de estoque.
- Aumento de uso de compartilhamento de itens por WhatsApp no fluxo comercial.
- Menor tempo para registrar dívida parcelada (PDV ou edição de devedor).
- Menos inconsistências em saldo por conta no Financeiro.

## 9. Questões em Aberto

- Definir limite padrão de tamanho por imagem no bucket (`device-images`) com base em tráfego real.
- Decidir se `Devedores` deve operar como conta contábil plena em todos os relatórios ou apenas no Financeiro operacional.
- Definir se o link WhatsApp deve permitir pré-preencher número do cliente quando houver telefone cadastrado.
