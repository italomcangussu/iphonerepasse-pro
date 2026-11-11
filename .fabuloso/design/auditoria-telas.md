# Auditoria de UX das telas — iPhoneRepasse Pro e CRM Plus

> 2026-11-11 · modo Auditar (só leitura, nenhum código alterado) · skill fabuloso-design.

## Como foi medido

- **Código:** `design.mjs auditar` em 185 arquivos de interface → 469 achados (111 P1, 300 P2, 58 P3). Detalhe em `auditoria.md`.
- **Tela rodando:** o app real em servidor de dev, com um Supabase simulado e **dados fictícios** (nada do banco real). 40 rotas do ERP capturadas como admin e como vendedor em iPhone (390×844) e desktop (1440×900), mais o CRM Plus autônomo (16 rotas), o estado vazio, o modo escuro, login e telas públicas. Fluxos com interação: menu "Mais", cadastro de aparelho, nova venda (3 passos), caixa.
- **Medição:** `design.mjs capturar` em 19 rotas × iPhone, Android e desktop, claro e escuro (alvos de toque, contraste, texto, camadas).
- **Limites:** é emulação em Chromium. Não aparecem o recorte do iPhone, o zoom do Safari ao focar campo, o teclado nem gestos do sistema. Telas que dependem de dado específico não foram abertas: conversa aberta do CRM (thread), contrato do Care+, detalhe de venda, garantia pública com dado, assinatura do Care com token válido. Papel **gerente** não foi capturado (só admin e vendedor). Nomes de contato do CRM nas capturas são artefato dos dados fictícios.

## Resposta curta às três perguntas

1. **10/10 nas três lentes:** nenhuma tela chega a 100%. Média de 72%. 12 das 35 telas avaliadas chegam a 80% (pronto); 4 estão abaixo de 60%. O que mais segura a nota é sistêmico (seção "Causas de raiz"): seis correções no cardápio sobem quase todas as telas de uma vez.
2. **18 leis:** o app obedece bem a Hick, Gradiente de meta, Zeigarnik, Região comum e Pico-fim. Viola de forma repetida Fitts, Tesler, Jakob, Similaridade e Von Restorff. Matriz abaixo.
3. **Cognição por papel:** o **vendedor** faz o essencial quase sem pensar (vender, orçar, consultar estoque), com um tropeço sério no passo de pagamento. O **admin** faz bem o dia a dia do ERP, mas precisa pensar (ou saber programar) para configurar o CRM: várias telas pedem JSON, UUID e nomes técnicos.

## Notas por tela (rubrica de 10 itens; 80% = pronto)

| Tela | Nota | O que mais segura a nota |
|---|---|---|
| **ERP** | | |
| Novo orçamento | 90% | referência do app: barra fixa embaixo, desfazer, vazio desenhado |
| Dashboard | 85% | legenda do gráfico com contraste 2,56:1; card "Alertas" só com um botão |
| Em Uso | 85% | — |
| Login | 80% | sem "esqueci a senha" e sem mostrar senha |
| Orçamentos | 80% | dois botões "Novo orçamento" na mesma dobra |
| Financeiro | 80% | saldo de conta e cofre só depois de 4 cards de estoque; página pula ao carregar (CLS 0,118) |
| Garantias | 80% | aba ativa verde, diferente de todo outro controle segmentado |
| Lojas | 80% | — |
| Perfil da Loja | 80% | formulário de 3.500 px sem salvar à vista |
| Clientes | 75% | "Exportar CSV" acima da ação primária; ações só com ícone |
| Empresas | 75% | ações só com ícone (membros, editar) |
| Configurações | 75% | rótulo "ERP" sobre o título, jargão, descrições cortadas |
| Histórico de vendas (PDV) | 70% | lista começa abaixo da dobra; "Historico", "2 venda(s)"; 17 textos de 10–11 px |
| Cadastro de aparelho | 70% | abas dos passos só com ícone; campos que dão zoom no iPhone |
| Devedores | 70% | status é um `select` de 12 px disfarçado de etiqueta; card dentro de card |
| Repasse Care+ | 70% | abas cortadas na lateral; 6+ cards de número antes de qualquer ação |
| Editar Taxas | 70% | tabela corta a 3ª coluna no celular |
| Estoque | 65% | 1º aparelho só aparece a 740 px; filtros sem rótulo; "WhatsApp"/"Instagram" não dizem que compartilham |
| Nova venda (PDV) | 65% | formas de pagamento a mais de uma tela de rolagem no passo "Pagamento" |
| Dívidas Ativas | 65% | o nome não diz "contas a pagar"; três ações no topo |
| Marketing | 65% | duas fileiras de abas, siglas (GMROI), texto espremido em cards de 2 colunas |
| Vendedores | 65% | um vendedor por tela (avatar gigante); lixeira colada no "Editar" |
| Estoque de Peças | 55% | **botões Editar/Excluir por cima dos valores** no celular |
| Tela de erro global | 50% | diz "sincronizar a versão" para qualquer erro; some a navegação |
| Calculadora | 45% | 3 botões de compartilhar antes do resultado, 3 cores de destaque, texto de 10 px, caixas de 16 px |
| **CRM Plus** | | |
| Configurações | 90% | referência do CRM (lista agrupada no padrão iOS) |
| Conversas (lista) | 85% | faixa de filtros sem trava de rolagem lateral |
| Simulador | 80% | espaçamentos fora da escala |
| Assistente Financeiro | 75% | confirmação com `confirm()` do navegador |
| Leads | 70% | sem título; vazio só com uma linha de texto; "0 lead(s)" |
| Estatísticas · Ads | 70% | sem título da tela no celular |
| Canais | 70% | "PROVIDER", "UAZAPI", "modo herdado" |
| Agentes IA | 60% | "SYSTEM PROMPT", modelo em texto livre, botões-etiqueta sem rótulo do grupo |
| Funis, Automações, Broadcasts, Templates, Campos, Scripts, Integrações, Formulários | 55% | formulário técnico genérico: "TRIGGER inbound_message", "CANAL (UUID)", "STAGES (JSON)" |

Não receberam nota por falta de dado nas capturas: thread da conversa, contrato Care+, garantia pública, assinatura Care, páginas legais.

## Achados que quebram tarefa (corrigir primeiro)

| P | Onde | Problema | Correção |
|---|---|---|---|
| P0 | `pages/PartsStock` (celular) | Na tabela, "Editar" e "Excluir" ficam por cima de custo e total; não dá para ler o valor nem acertar o botão | No celular, trocar a tabela por cartões (o padrão do Estoque) ou mover as ações para um menu "⋯" de 44×44 |
| P1 | Rotas `/crm/*` dentro do ERP (`AdminAgentPage`, `AISettingsPage`, `CRMSimpleCrud`, `CRMLeads`, `SimulatorPage`, `ConversationsPage`) | `.crm-btn-primary` usa `--crm-brand`, que só existe dentro de `.crm-plus-theme`. Fora do CRM autônomo o botão primário fica **branco com texto branco** ("Autorizar", "Novo agente", "Salvar") | Definir as variáveis `--crm-*` em `:root` (index.css:1244) ou envolver as rotas `/crm/*` do ERP em `.crm-plus-theme` |
| P1 | CRM autônomo, desktop, barra lateral | Logo e nome "CRM Plus" duplicados e sobrepostos pelo botão fechar; nome do papel ("Admin") em branco sobre branco no cartão "Sessão" | Um só bloco de marca; cor do texto por token (`--crm-text`) |
| P1 | `pages/PDV.tsx` passo 3 | O passo se chama "Pagamento", mas abre em checklist + resumo; as formas de pagamento ficam ~1.000 px abaixo, depois de "Definir desconto" | Ordem: formas de pagamento e restante no topo; resumo e desconto depois; checklist vira uma linha de pendência junto ao botão final |
| P1 | `components/Layout.tsx:168-171` | Atalhos "Novo aparelho" e "Novo cliente" do menu "Mais" só abrem a lista; o formulário não abre | Navegar com estado (`?novo=1`) e abrir o modal, como "Nova venda" já abre o fluxo |
| P1 | `components/auth/ProtectedRoute.tsx:40-44` | Vendedor que cai numa rota sem permissão é jogado no Dashboard sem aviso (14 rotas do ERP + 11 do CRM) | Toast "Você não tem acesso a Financeiro" ou tela "sem permissão" com o caminho de volta |
| P1 | `components/ui/AppErrorBoundary.tsx:44` | Qualquer erro de tela diz "sincronizar a versão mais recente" e remove cabeçalho e navegação | Mensagem pela causa; manter o shell; botão "Voltar ao início" além de "Recarregar" |
| P1 | ERP no celular | "Abrir CRM Plus" só existe na barra lateral do desktop (`Layout.tsx:417`) | Item no menu "Mais" |

## Causas de raiz (um conserto sobe muitas telas)

| # | Causa | Evidência | Correção no cardápio |
|---|---|---|---|
| 1 | Texto abaixo de 12 px | 77 no código (`text-[10px]`, `text-[11px]`), 86 medidos; piores: PDVHistory (17), PDV (15), AdsPage (14), Calculator (7) | `text-xs` (12 px) como piso; rótulo de card em 12 px peso 600 |
| 2 | Placeholder e borda de campo sem contraste | placeholder `text-gray-400` = 2,6:1 em todo `ios-input`; borda de campo 1,69:1 | placeholder em `--ds-color-text-muted` (#64748b, 4,8:1); borda em tom que dê 3:1 |
| 3 | Alvos pequenos | 62 falham no WCAG 2.5.8 (caixas de 16×16 na Calculadora, "Mais tarde" de 16 px de altura no aviso de instalar/notificar); 432 abaixo de 44 px (`h-8`) | piso de `min-h-11 min-w-11` nos primitivos de botão-ícone e checkbox |
| 4 | Campo numérico sem máscara ou teclado | "Valor negociado" da venda mostrava `2960.00` em vez de `R$ 2.960,00`; 16 campos de quantidade e parcelas sem teclado numérico. (Correção desta linha: na primeira versão escrevi "20 campos de valor"; só um era de valor, os demais são quantidades.) | máscara BRL e `inputMode="decimal"` no valor; `inputMode="numeric"` nas quantidades |
| 5 | Erro cru e validação em toast | 42 `erro-cru` (mensagem técnica do Supabase na tela), 12 validações só em toast | helper único que traduz o erro (o que houve + saída); erro de campo ao lado do campo |
| 6 | Zoom bloqueado | `index.html:81` `maximum-scale=1, user-scalable=no` (WCAG 1.4.4) + 26 campos < 16 px | tirar o bloqueio e pôr `text-base` nos campos: o zoom ao focar some pelo motivo certo |
| 7 | Espaçamento fora da escala | 135 valores soltos (`p-[14px]`, `gap-[7px]`); 10 raios distintos | encaixar na escala de 4 px; reduzir para 4 raios |
| 8 | Rótulo pequeno em caixa alta sobre o título | "PDV", "ERP", "RELACIONAMENTO", "CRM PLUS", "PDV · ORÇAMENTO" | remover; o título fala sozinho |
| 9 | Rolagem lateral sem trava | 18 faixas (`overflow-x-auto` sem `overflow-y-hidden overscroll-x-none`) | uma utilidade `rolagem-x` e só ela |
| 10 | Aviso fixo de instalar/notificar | aparece em toda rota na primeira visita e cobre resumo e navegação | mostrar só no Dashboard, depois da primeira tarefa concluída |

## As 18 leis

✓ obedece · ◐ obedece com exceções · ✗ viola de forma repetida.

| # | Lei | | Evidência |
|---|---|---|---|
| 1 | Proximidade | ◐ | Bom nos formulários. Estoque: três fileiras de filtro com o mesmo espaço e sem rótulo (status, loja, condição) |
| 2 | Similaridade | ✗ | Barra de ação da venda no meio da página × barra fixa embaixo no orçamento; aba ativa verde em Garantias × branca no resto; botões do CRM (`crm-btn`) × do ERP (`ios-button`); 10 raios, 14 tamanhos fora da escala |
| 3 | Região comum | ◐ | Cards agrupam bem. Card dentro de card em Devedores, Dívidas e Calculadora (3 níveis) |
| 4 | Conexão uniforme | ✓ | Passos da venda e do cadastro ligados; item ativo da navegação com o mesmo fundo |
| 5 | Prägnanz | ◐ | Telas simples no geral. Calculadora e Marketing acumulam forma demais |
| 6 | Hick | ✓ | Navegação inferior com 5 itens (4 para o vendedor); "Mais" agrupado. Exceção: Calculadora e Dívidas Ativas com 3 ações no topo; 18 telas com 2+ destaques na dobra |
| 7 | Fitts | ✗ | 62 alvos falham no mínimo AA, 432 abaixo de 44 px; ação primária no topo em 38 medições (longe do polegar), menos no orçamento; lixeira colada em "Editar" (Vendedores) |
| 8 | Tesler | ✗ | Admin digita UUID de canal, JSON de etapas, nome de trigger e de modelo; 20 campos de valor sem máscara |
| 9 | Postel | ◐ | Telefone e CPF com máscara. Valor exige ponto decimal; 1 `pattern` rígido |
| 10 | Miller | ◐ | Resumo sempre visível na venda. No passo 3 o total fica longe das formas de pagamento |
| 11 | Doherty | ✓ | Primeiro conteúdo em 350–750 ms, botões com estado de carregando; só 2 ações assíncronas sem retorno |
| 12 | Zeigarnik | ✓ | Rascunho de venda e de orçamento; checklist de conclusão |
| 13 | Posição serial | ◐ | Dashboard e "Mais" nas pontas. No Financeiro o saldo (o que o dono mais consulta) fica no fim |
| 14 | Gradiente de meta | ✓ | "1. Cliente · 2. Produtos · 3. Pagamento" com passo feito em verde |
| 15 | Jakob | ✗ | Sem título em Leads, Estatísticas e Ads no celular; 2 `confirm()` do navegador; 2 `<div>` clicáveis; redirecionamento silencioso; login sem "esqueci a senha" |
| 16 | Estética-usabilidade | ◐ | Acabamento bom no ERP (tokens, modo escuro, vazios desenhados); cai nas telas técnicas do CRM |
| 17 | Von Restorff | ✗ | Calculadora (verde, rosa e azul juntos); "Sair" laranja é o elemento mais forte da barra do CRM; checklist da venda só por cor de texto |
| 18 | Pico-fim | ◐ | Venda termina em tela de sucesso com comprovante. Erro global e "Garantia não encontrada" terminam em beco sem saída |

## Cognição por papel

Contagem de toques a partir do app aberto no celular.

### Vendedor

| Tarefa | Toques | Faz sem pensar? | O que trava |
|---|---|---|---|
| Fazer uma venda | 1 + 3 passos | Quase | Passo 3: rolar mais de uma tela para achar Pix/Cartão; valor aparece como `2960.00`; "Continuar" habilitado com campos vazios (o erro aparece ao lado, então recupera) |
| Montar orçamento | 2 ("Mais" → "Novo orçamento") | Sim | — |
| Consultar aparelho e preço | 1 + busca | Sim | Lista começa abaixo da dobra (filtros + 4 cards de total antes) |
| Compartilhar estoque | 2 | Precisa adivinhar | Botões "WhatsApp" e "Instagram" não dizem "Compartilhar lista" |
| Reservar aparelho | 2 (card → "Reservar") | Sim | — |
| Cadastrar aparelho | 2 + 3 passos | Sim, com uma dúvida | Abas dos passos só com ícone (telefone, câmera, cifrão) |
| Abrir algo sem permissão | — | Não | Volta ao Dashboard sem explicação |
| Atender no CRM | — | Sim no app do CRM | No ERP pelo celular não há atalho para o CRM |

### Admin

| Tarefa | Toques | Faz sem pensar? | O que trava |
|---|---|---|---|
| Ver resultado do mês | 0 | Sim | — |
| Ver saldo de conta e cofre | 1 + rolagem | Com esforço | Financeiro abre em custo e projeção de estoque; saldos no fim |
| Lançar entrada, pagar, transferir | 2 | Sim | "Aporte" como nome da entrada |
| Cobrar devedor atrasado | 2 + rolagem no "Mais" | Sim | Devedores e Dívidas ficam no fim do "Mais" |
| Contas a pagar | 2 + rolagem | Precisa ler | "Dívidas Ativas" exige o subtítulo para entender |
| Permissões por função | 2 (engrenagem → item) | Sim | — |
| Editar taxas de cartão | 3 | Sim | Tabela cortada no celular |
| Peças no celular | 2 | **Não consegue ler** | Sobreposição (P0) |
| Criar automação, funil, template | 3+ | **Não** | Pede "inbound_message", UUID do canal, JSON |
| Configurar agente de IA | 3 | Não | "System prompt", modelo digitado à mão |
| Autorizar número no assistente (pelo ERP) | 3 | Não | Botão invisível (P1) |

**Gerente:** não capturado. Pelo código, usa as mesmas telas do vendedor mais as liberadas na matriz de permissões; vale o mesmo que o vendedor, incluindo o redirecionamento silencioso.

## Personas

- **Casey (uma mão, na rua):** ações primárias no topo em quase todas as telas; caixas de 16 px na Calculadora; pagamento longe no passo 3; placeholder claro demais ao sol.
- **Riley (testa limites):** tela de erro sem volta; nomes longos quebram em 2 linhas mas não estouram; nenhuma rota com rolagem lateral da página (0 transbordos).
- **Sam (leitor de tela):** títulos pulam de h1 para h3 em 22 medições; 16 campos só com placeholder; 5 focos removidos; validação em toast não fica no campo.
- **Alex (uso diário):** desktop denso e bom no Estoque; sem ações em lote; card "Alertas" do Dashboard ocupa espaço com um botão.

## Ordem de ataque

1. **Tarefa quebrada** (1–2 dias): tabela de peças no celular; variáveis `--crm-*` fora do CRM autônomo; barra lateral do CRM; atalhos "Novo aparelho/cliente"; aviso de sem permissão. Sobe Peças de 55% para ~75% e destrava o admin.
2. **Passo de pagamento da venda** + `CurrencyInput` nos 20 campos de valor. Sobe Nova venda de 65% para ~85%; é a tarefa mais repetida do app.
3. **Cardápio** (causas 1, 2, 3, 6): piso de 12 px, contraste de placeholder e borda, piso de 44 px, zoom liberado. Mexe em poucos arquivos (tokens e primitivos) e sobe ~5 a 10 pontos em quase todas as telas.
4. **CRM sem jargão:** trocar o formulário genérico por campos de verdade (seletor de canal, lista de etapas, seletor de gatilho) e pôr título nas telas do celular. Sobe 8 telas de 55% para ~80%.
5. **Estoque e Calculadora:** lista na primeira dobra; resultado antes de compartilhar; uma cor de destaque.
6. **Limpeza:** rótulos sobre título, plurais "(s)", "Historico", espaçamentos fora da escala, faixas de rolagem.

Com 1 a 3 feitos, a média estimada passa de 72% para perto de 82%. Para 90%+ é preciso o item 4 e a revisão de erro (causa 5). 100% não é meta realista; 90% é o ponto em que a pessoa só faz a tarefa.

## Depois das correções (2026-11-11, mesma data)

Aplicado na branch `claude/fervent-gauss-xvl2g8`. Suíte: 1.230 testes passando, typecheck e build limpos. Varredura estática: 469 → 385 achados; **P1 de 111 → 32** (os 32 restantes: 15 são do recibo térmico, que fica em 10–11 px de propósito; 10 de campos abaixo de 16 px; o resto é zoom e gesto).

| Tela | Antes | Depois | O que mudou |
|---|---|---|---|
| Estoque de Peças | 55% | 80% | cartões no celular; ações de 44 px |
| CRUD do CRM (8 telas) | 55% | 75% | seletor de canal e etapa, listas de tipo e situação, data local, ajuda por campo, erro ao lado do campo, JSON em "Avançado", título no celular |
| Calculadora | 45% | 65% | resultado antes de compartilhar; uma cor de destaque; "Configurar taxas" com texto; caixas maiores |
| Nova venda | 65% | 75% | checklist em uma linha com ícone; valor em reais; linhas zeradas somem; formas de pagamento sobem ~330 px |
| Estoque | 65% | 75% | primeiro aparelho na primeira dobra; "Compartilhar lista de aparelhos" |
| Tela de erro | 50% | 70% | texto verdadeiro e "Voltar ao início" |
| Financeiro | 80% | 85% | saldos antes dos cards de estoque |
| Agentes IA · Assistente · Canais · Leads · Estatísticas · Ads | 60–75% | 70–80% | botão primário visível no ERP, rótulos em português, título no celular, confirmação do app |

Média das 35 telas: 72% → 76%; 15 telas em 80% ou mais; nenhuma abaixo de 60%. As notas "depois" vêm das recapturas das telas alteradas (mesma emulação); as demais telas não foram remedidas.

### O que não foi feito, e por quê

- **Zoom bloqueado (`index.html`)**: `tests/crm-ios-layout-contract.test.ts` exige `user-scalable=no` e `maximum-scale=1`. É decisão do projeto para o chat do CRM no iPhone; mudar pede o sim do dono.
- **Renomear "Dívidas Ativas" para "Contas a pagar"**: o termo aparece em telas, mensagens, permissões e no assistente financeiro. É vocabulário do negócio, não acabamento.
- **Passo de pagamento**: as formas de pagamento agora começam no limite da primeira dobra (antes, a mais de uma tela). Para ficarem inteiras acima da dobra é preciso mover o bloco de negociação para depois delas, o que muda a ordem da tarefa; fica como proposta.
- **Gatilhos de automação**: o banco aceita texto livre e só existe `inbound_message` em uso; o seletor oferece esse e preserva qualquer outro valor já gravado.
- **Formulários › lead**: continua pedindo o ID do lead; um seletor carregaria a base inteira de leads. Pede busca por nome, que é evolução.
- **135 espaçamentos fora da escala, 42 mensagens de erro cruas, 18 campos só com placeholder**: são mudanças arquivo a arquivo sem causa única; ficam como próxima rodada.
- **Login sem "esqueci a senha"**: é funcionalidade nova (fluxo de e-mail), não ajuste de tela.
- **Texto de 11 px na barra inferior do CRM**: padrão de tab bar do iOS; mantido.
- **Cabeçalho da tela de erro**: a tela ainda substitui o shell (a árvore do React caiu); ganhou saída, não navegação.

### Segunda rodada: os quatro itens em aberto (a pedido do dono)

- **Zoom liberado:** `index.html` sem `maximum-scale=1, user-scalable=no`; o teste de contrato passou a exigir isso. Para o iPhone não dar zoom ao focar um campo, os campos têm piso de 16 px no iOS (`ios-no-focus-zoom` no fim do `index.css`). Conferir no aparelho: a emulação não reproduz o zoom do Safari nem o teclado do chat do CRM.
- **"Dívidas Ativas" virou "Contas a pagar"** em menu, permissões, Financeiro, PDV e mensagens. Não mudou: nomes no banco, chave de permissão `payable_debts`, e os textos do assistente financeiro do WhatsApp (edge function), que ainda falam "dívidas ativas".
- **"Esqueci minha senha" no login:** envia o link pelo Supabase e, ao abrir o link, o app pede a nova senha antes de liberar a entrada. Testado de ponta a ponta contra o Supabase simulado. Depende de configuração que não deu para conferir daqui: o endereço do app (ERP e CRM) precisa estar em Authentication › URL Configuration › Redirect URLs, e o envio de e-mail do projeto precisa estar ativo.
- **Passo de pagamento:** as formas de pagamento ficam inteiras na primeira dobra; a negociação de valor e o desconto vêm logo depois.

Notas: Nova venda 75% → 85%, Login 80% → 85%, Contas a pagar 65% → 75%. Média das 35 telas: 77%; 16 em 80% ou mais.

### Decisão de negócio (2026-11-11): "Dívidas Ativas" fica

A renomeação para "Contas a pagar" foi desfeita a pedido do dono: Dívidas Ativas é um conceito próprio do negócio e não deve se confundir com contas a pagar. O nome volta em menu, permissões, Financeiro, PDV e mensagens. Não propor essa troca de novo.

### Decisão de produto (2026-11-11): zoom de pinça continua bloqueado

O bloqueio de zoom no viewport voltou, a pedido do dono: tela de app não dá zoom no meio da tela, isso tira a sensação de app nativo. Zoom vale só para conteúdo (imagem, PDF) dentro do visualizador. O teste de contrato voltou a exigir o bloqueio. Não propor liberar o zoom de novo; o achado `zoom-bloqueado` das varreduras é exceção consciente.
