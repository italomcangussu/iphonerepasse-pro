# PRD: Toasts de Permissão Apple + Correções de Upload no Estoque

## 1. Introdução

Este PRD define a padronização do fluxo de solicitação de permissões no app com foco em comportamento esperado no ecossistema Apple (iOS/Safari), incluindo:
- pré-aviso por toast antes do alerta nativo para câmera, fotos (álbum) e push;
- solicitação contextual (somente no momento da ação);
- correções de robustez no upload de imagens de aparelho no estoque.

Também formaliza o mapeamento de onde essas permissões são usadas no produto.

## 2. Objetivos

- Adotar padrão de pré-aviso em toast com CTA único `Continuar` antes da solicitação nativa de permissão.
- Cobrir três permissões críticas: `Push`, `Câmera` e `Fotos/Álbum`.
- Reduzir falhas no fluxo de adicionar imagem no estoque (tipo inválido, arquivo acima de limite, MIME ausente/inconsistente).
- Documentar no próprio app e em PRD onde cada permissão é utilizada.

## 3. User Stories

### US-001: Pré-aviso para câmera no estoque
**Descrição:** Como operador de estoque, quero receber um aviso curto e claro antes da permissão de câmera para entender por que o app pede acesso.

**Critérios de Aceite:**
- [ ] Ao selecionar `Abrir câmera` no fluxo de fotos do estoque em iOS, exibe toast de pré-aviso com CTA único `Continuar`.
- [ ] O CTA aciona o pedido nativo de câmera no contexto da ação do usuário.
- [ ] Em bloqueio de câmera, o app exibe orientação objetiva para reativação.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-002: Pré-aviso para álbum/fotos no estoque
**Descrição:** Como operador de estoque, quero receber aviso antes de abrir o álbum para saber que o sistema abrirá o seletor de fotos.

**Critérios de Aceite:**
- [ ] Ao selecionar `Escolher da galeria` no iOS, exibe toast de pré-aviso com CTA único `Continuar`.
- [ ] O CTA abre o seletor nativo de fotos.
- [ ] O aviso pode ser controlado por chave local para evitar repetição excessiva.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-003: Pré-aviso e solicitação de push
**Descrição:** Como usuário do app, quero ativar notificações push com fluxo guiado para não me perder no pedido do sistema.

**Critérios de Aceite:**
- [ ] Existe ação explícita em `Configurações` para solicitar push.
- [ ] Antes de `Notification.requestPermission`, o app mostra toast com CTA único `Continuar`.
- [ ] O status da permissão (`Ativado`, `Bloqueado`, `Não decidido`, `Não suportado`) aparece na UI.
- [ ] O app mostra instrução quando iOS não estiver em modo instalado na Tela de Início.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-004: Correções no upload de imagem do estoque
**Descrição:** Como operador, quero enviar imagens sem erro inesperado ao cadastrar aparelho.

**Critérios de Aceite:**
- [ ] O fluxo valida tipo suportado antes do upload (`jpeg/png/webp/heic/heif`).
- [ ] O fluxo valida limite de tamanho por arquivo (15 MB para `device-images`).
- [ ] O serviço de upload resolve MIME quando `file.type` vier vazio/inconsistente.
- [ ] Mensagens de erro exibem causa prática para o usuário.
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

### US-005: Mapeamento de uso das permissões
**Descrição:** Como admin, quero visualizar rapidamente onde as permissões são usadas no app para auditoria funcional.

**Critérios de Aceite:**
- [ ] A aba `Permissões e Privacidade` mostra bloco com mapeamento de uso (Câmera/Fotos e Push).
- [ ] O mapeamento aponta os fluxos reais do produto (Estoque, Troca no PDV, Configurações).
- [ ] Typecheck/lint passam.
- [ ] Verify in browser using dev-browser skill.

## 4. Requisitos Funcionais

- FR-1: `StockFormModal` deve exibir pré-toast para câmera com botão único `Continuar` no iOS.
- FR-2: `StockFormModal` deve exibir pré-toast para fotos/álbum com botão único `Continuar` no iOS.
- FR-3: `Settings` deve oferecer ação explícita para solicitar push com pré-toast e CTA único `Continuar`.
- FR-4: `Settings` deve exibir estado atual da permissão de push.
- FR-5: Upload de imagem deve validar tipo e tamanho antes de enviar ao bucket.
- FR-6: Serviço de upload deve inferir `contentType` confiável quando necessário.
- FR-7: UI de `Permissões e Privacidade` deve incluir mapeamento claro de uso de permissões.

## 5. Não Objetivos

- Não implementar infraestrutura completa de envio de push (subscription, backend dispatch, service worker dedicado).
- Não alterar regras de autenticação, RLS ou políticas de bucket além do necessário para robustez de upload cliente.
- Não redesenhar todo o sistema de Toast além do suporte necessário para copy de permissão.

## 6. Considerações de Design

- Seguir princípio Apple: pedir permissão no contexto da ação.
- Pré-aviso com CTA único e neutro (`Continuar`), evitando padrões de coerção.
- Mensagens curtas, ação clara e linguagem operacional para equipe de loja.

## 7. Considerações Técnicas

- Fontes primárias de guideline Apple para esta implementação:
  - HIG Privacy (pre-alert antes de alerta do sistema, CTA único e claro).
  - Requesting access to protected resources (pedir só o necessário e com motivo explícito).
  - iOS web push em Safari depende de contexto de uso e suporte do ambiente.
- `StockFormModal` é reutilizado em:
  - `pages/Inventory.tsx` (cadastro/edição de aparelho);
  - `pages/PDV.tsx` (troca/trade-in).

## 8. Métricas de Sucesso

- Queda no número de erros de upload por arquivo inválido/tamanho.
- Aumento de conclusão do fluxo de adicionar foto sem retrabalho.
- Redução de dúvidas operacionais sobre ativação de push em iPhone.

## 9. Questões em Aberto

- Confirmar se haverá backend de push no curto prazo para aproveitar permissões concedidas.
- Definir se o pré-aviso de câmera/fotos deve reaparecer periodicamente ou permanecer “uma vez por dispositivo/fonte”.
