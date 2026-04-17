# PRD: Fluxo Mobile de Fotos em Lote no Cadastro de Estoque

## 1. Introduction / Overview

Hoje o cadastro de aparelho envia fotos imediatamente ao selecionar arquivos, o que gera fricção no mobile quando o operador precisa adicionar muitas imagens seguidas.

Esta entrega cria um fluxo mobile orientado a fila local: capturar/selecionar várias fotos, organizar antes do envio (reordenar e definir capa), subir em lote e concluir cadastro com auto-upload no final, sem salvar enquanto houver falhas pendentes.

## 2. Goals

- Permitir adicionar várias fotos localmente antes do upload.
- Limitar o fluxo a no máximo 10 fotos por aparelho (enviadas + pendentes).
- Permitir reordenar fotos e definir capa antes de subir.
- Implementar upload em lote com retry de falhas.
- Garantir auto-upload ao concluir cadastro e bloqueio de conclusão se houver falhas.
- Preservar rascunho por sessão para contexto `inventory` e `pdv-tradein`.

## 3. User Stories

### US-001: Fila local de fotos com limite de 10
**Description:** Como operador de estoque, quero acumular fotos localmente antes de enviar para organizar o cadastro com mais rapidez no celular.

**Acceptance Criteria:**
- [ ] Seleção de arquivos/fotos adiciona itens em fila local com preview.
- [ ] Limite total de fotos por aparelho considera fotos já enviadas + fila local e bloqueia acima de 10.
- [ ] Fotos inválidas (tipo/tamanho) continuam sendo rejeitadas com feedback claro.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Organização da fila local (reordenação e capa)
**Description:** Como operador, quero ajustar ordem e capa das fotos antes do upload para que o anúncio/visualização final fique correto.

**Acceptance Criteria:**
- [ ] Cada item da fila local permite remover, mover para cima/baixo e definir como capa.
- [ ] Ao definir capa na fila local, o item é marcado de forma visual e priorizado no resultado final.
- [ ] Fotos já enviadas também permitem remoção, reordenação e definição de capa.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Captura contínua + upload em lote com retry
**Description:** Como operador mobile, quero tirar várias fotos seguidas e enviar em lote para reduzir toques e tempo operacional.

**Acceptance Criteria:**
- [ ] No mobile, ação de câmera ativa captura contínua até o operador parar ou atingir limite.
- [ ] Existe botão explícito `Enviar fotos` para subir pendentes/falhas em lote.
- [ ] Upload em lote mantém sucessos, preserva falhas na fila e oferece `Tentar novamente`.
- [ ] Compressão de imagem é aplicada automaticamente no mobile com fallback seguro para original.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Auto-upload no Concluir Cadastro com bloqueio de falhas
**Description:** Como operador, quero que o sistema finalize apenas quando todas as fotos locais forem resolvidas para não perder imagens no cadastro.

**Acceptance Criteria:**
- [ ] Ao clicar `Concluir Cadastro` com fotos pendentes/falhas, o sistema dispara auto-upload.
- [ ] Se restarem falhas após auto-upload, o cadastro não conclui e permanece no modal para retry.
- [ ] Se o lote concluir sem falhas, o fluxo segue normalmente para salvar o aparelho.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Rascunho por sessão por contexto de uso
**Description:** Como operador, quero retomar o cadastro se fechar o modal sem querer para não repetir seleção de fotos e preenchimento.

**Acceptance Criteria:**
- [ ] Fluxo salva rascunho de formulário/fila em cache de sessão para `inventory` e `pdv-tradein`.
- [ ] Ao reabrir o modal no mesmo contexto, o rascunho é restaurado.
- [ ] Ao salvar com sucesso, o rascunho é limpo.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Cobertura de testes do fluxo
**Description:** Como equipe de engenharia, queremos validar regras críticas do fluxo para evitar regressões no cadastro e no upload.

**Acceptance Criteria:**
- [ ] Testes unitários cobrem limite de 10, reordenação/capa, merge de sucesso+falha e regra de bloqueio de conclusão.
- [ ] Testes de componente cobrem upload manual da fila e bloqueio de conclusão com falha de upload.
- [ ] Ajustes não quebram typecheck.
- [ ] Tests pass
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: O modal de cadastro deve manter fila local de fotos (`pending`, `uploading`, `failed`) antes do envio.
- FR-2: O sistema deve impedir exceder 10 fotos totais por aparelho.
- FR-3: A fila local deve suportar remover, reordenar e definir capa.
- FR-4: O sistema deve oferecer botão explícito para upload manual em lote.
- FR-5: O upload em lote deve manter falhas na fila para retry e anexar sucessos em `StockItem.photos`.
- FR-6: No mobile, captura por câmera deve suportar sequência contínua até interrupção do usuário.
- FR-7: Ao concluir cadastro com fila pendente/falha, o sistema deve autoenviar e bloquear conclusão em caso de falha remanescente.
- FR-8: O modal deve manter rascunho por sessão usando chave de contexto (`inventory`, `pdv-tradein`).
- FR-9: O contrato persistido de `StockItem.photos: string[]` deve permanecer sem mudança de schema.

## 5. Non-Goals (Out of Scope)

- Não criar fila offline persistente entre reloads do navegador.
- Não introduzir background sync com service worker.
- Não alterar schema/migrations do banco para fotos.
- Não redesign completo das outras abas do modal além do necessário para o novo fluxo de fotos.

## 6. Design Considerations

- Priorizar leitura operacional em mobile com foco nas miniaturas e ações essenciais.
- Evitar ruído visual: controles compactos, hierarquia clara (fila local -> ações de upload -> galeria enviada).
- Exibir estados de upload por item (pendente, enviando, falhou) com feedback direto.

## 7. Technical Considerations

- Arquivo principal: `components/StockFormModal.tsx`.
- Contextos de uso a manter compatíveis: `pages/Inventory.tsx` e `pages/PDV.tsx`.
- Utilitários novos devem isolar regras de fila, merge e compressão para facilitar testes unitários.
- Compressão deve ser best-effort no cliente: se API de canvas/imagem falhar, manter arquivo original.

## 8. Success Metrics

- Operador consegue adicionar várias fotos em sequência no mobile com menos reaberturas manuais.
- Redução de falhas de conclusão por upload interrompido no meio do cadastro.
- Menor retrabalho por perda de progresso em fechamento acidental de modal.

## 9. Open Questions

- Nenhuma para esta fase (escopo fechado com defaults definidos).
