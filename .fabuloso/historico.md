# Histórico do contexto (fabuloso)

Uma entrada por sessão: data, o que mudou no contexto e por quê.

## 2026-09-30 — bootstrap completo
- Modo: agentmap (676 arquivos, 10 hubs). Perfil: local.
- Mapa do banco: gerado via API Supabase (`ubuusaiezpyayqgfujbe`): 73 tabelas, 146 funções, 0 alertas altos/médios, 40 info. Última migration 20260929131000.
- Capacidades: 70 skills; nenhuma skill obrigatória ausente (`performance-profiler` cobre `performance-profile`; `frontend-design` cobre `design`).
- `arquitetura.md` escrita sem subagente (a pedido do usuário): aponta para o CLAUDE.md para n8n/CRM/agente admin, sem duplicar.
- Commits da sessão: eac10f1 (fix: lê o motivo real do erro de envio do comprovante), fe946ec (feat: erro de envio persistente com causa, próximo passo e correção de telefone).
- Integração: ainda local em `main` (ahead do origin); push pendente de confirmação.

## 2026-10-08 — lista de clientes do PDV (Combobox) no iPhone
- Modo: tarefa. Orquestrador: Sonnet 5.5. Commits 79fcd3c..79b101d.
- Tarefa: lista do Combobox cobria o campo de busca no iPhone com teclado aberto. Posicionamento saiu do `Combobox.tsx` para `comboboxPosition.ts` + `useListboxPosition.ts` (absolute em coordenadas de página, `visualViewport`).
- Contexto: convenção de popover portaled no body acrescentada ao CLAUDE.md (AGENTS.md/GEMINI.md divergem do CLAUDE.md e não foram alterados). `arquitetura.md` ganhou a seção "Fluxos principais" (pendência do bootstrap), montada a partir de CLAUDE.md, `codigo/indice.md` e `db/uso.md`.
- Mapas regenerados; banco: `public.device_catalog` alterada no mapa. Sem migrations nem edge functions. `pg marcar --edge-todas` não feito (aguarda confirmação do usuário).

## 2026-10-10 — atualização parcial de capacidades
- Modo: bootstrap parcial. Orquestrador: Opus 5.5.
- Skills: `review-agent` nova (Qualidade de código); `plugin-creator` removida (já coberta por `plugin-*`); `imagegen`, `openai-docs`, `skill-creator` alteradas sem mudar a entrada.

## 2026-10-15 — Repasse Care+ (assistência técnica continuada pós-venda)
- Modo: tarefa. Orquestrador: Opus 5.5. Commits d200fd8..d0c1f3c.
- Tarefa: regras configuráveis, contrato automatizado com assinatura eletrônica por código de 6 dígitos no WhatsApp, aba `/care` (painel, contratos, acionamentos, regras, simulador).
- Contexto: seção "Repasse Care+" no CLAUDE.md (AGENTS.md/GEMINI.md divergem e não foram alterados); `arquitetura.md` ganhou módulo, fronteira e fluxo do Care+.
- Banco: migrations 20261015120000_repasse_care e 20261015120100_repasse_care_search_path aplicadas via psql (db push travou em sessão idle in transaction) e registradas com `migration repair`; edge functions `care-contract` e `care-sign-public` deployadas. 13 tabelas `care_*` novas. Advisors: 11 avisos de SECURITY DEFINER executável em RPCs `care_*` são intencionais.
- Pendências: definir `CARE_OTP_SECRET` (hoje cai na service role key); preencher regras, bônus e dados da contratada em /care; revisão jurídica das cláusulas; assinatura da empresa e lembrete automático de parcelas não implementados.

## 2026-10-19 — compartilhar estoque (só à vista, seleção inteligente)
- Modo: tarefa. Orquestrador: Opus 5.5. Commits d619f5f..8777c67.
- Tarefa: botões WhatsApp/Instagram do Estoque viraram uma folha única (`ShareStockSheet`) com "só à vista" ou parcelado, prévia e seleção inteligente (escolhidos > filtro > disponível; "Marcar os da tela").
- Contexto: convenção de compartilhar estoque acrescentada ao CLAUDE.md (AGENTS.md/GEMINI.md divergem e não foram alterados). `arquitetura.md` sem mudança (nada estrutural). Mapas regenerados.
- Banco: nada. Sem migrations nem edge functions.

## 2026-10-19 — modais fora da ilha dinâmica e toque na barra de status
- Modo: tarefa. Orquestrador: Opus 5.5. Commits be0e0af..6530161.
- Tarefa: modais/folhas não invadem ilha dinâmica/notch (`--overlay-top-gap`); no celular o documento rola (não o `<main>`) para o toque na barra de status do iOS voltar ao topo.
- Contexto: duas convenções curtas no CLAUDE.md (AGENTS.md/GEMINI.md divergem e não foram alterados). `arquitetura.md` sem mudança. Mapas regenerados.
- Banco: nada. Pendência: conferir o gesto real da barra de status num iPhone com a PWA instalada (o simulador não o aciona).

## 2026-10-19 — Repasse Care+: revisão jurídica do contrato e suspensão por atraso
- Modo: tarefa. Orquestrador: Opus 5.5. Commits d619f5f..d77c173.
- Tarefa: cláusulas RC-2026.11-v1 (adesão, `limiting()`, "valor por atendimento"), objeto determinado (serviços e limites obrigatórios), check-up preventivo, contato LGPD, suspensão por atraso com reativação por vistoria.
- Contexto: parágrafo Care+ do CLAUDE.md atualizado (AGENTS.md/GEMINI.md divergem e não foram alterados); `arquitetura.md` ganhou o fluxo de suspensão. Mapas regenerados.
- Banco: migration 20261019120000_repasse_care_contract_review aplicada no remoto (psql + migration repair), cron `care-refresh-suspensions` agendado; edge functions `care-contract` e `care-sign-public` redeployadas.
- Pendências: revisão por advogado da tese "serviço, não seguro" (CNSP Res. 296/2013); preencher em /care serviços, limites, check-up, encarregado e dados da contratada; definir `CARE_OTP_SECRET`.

## 2026-10-23 — matriz de permissões por função vale no banco e nas telas
- Modo: tarefa. Orquestrador: Opus 5.5. Commits 8340eaf..dbe273b.
- Tarefa: `app_role_permissions` passa a ser aplicada por `has_app_permission()` em políticas/RPCs e por `can()` nas telas; gerente usa o que o admin libera.
- Contexto: regra no CLAUDE.md + `.fabuloso/conhecimento/permissoes.md` (novo); fluxo "Permissão de ação" em `arquitetura.md` (AGENTS.md/GEMINI.md divergem, não alterados). Mapas regenerados.
- Banco: migration 20261023120000_app_permissions_enforced_in_db aplicada no remoto (`supabase db push --linked`). Sem edge functions.
- Pendências: Debtors, Finance, PayableDebts, Warranties, Clients sem botões ocultos por permissão; falta teste na tela com gerente real.
- Observação: deriva do banco em 14 tabelas (mapa) sem migration desta tarefa.
- 2026-10-24: capacidades atualizadas (fabuloso-security, plugin-creator; review-agent removida).

## 2026-10-24 — Orçamentos no PDV
- Modo: tarefa. Orquestrador: Opus 5.5. Commits 012881f..c540102.
- Tarefa: montar orçamento (itens do estoque ou manuais, taxas de cartão), validade 1–30 dias, documento HTML, lista de orçamentos.
- Contexto: `.fabuloso/conhecimento/pdv-orcamentos.md` (novo) + linha-índice no CLAUDE.md; fluxo "Orçamento PDV" em `arquitetura.md` (AGENTS.md/GEMINI.md não alterados). Mapas regenerados.
- Banco: migration 20261024120000_pdv_quotes aplicada no remoto (`supabase db push`). Sem edge functions.
- Pendências: teste funcional logado no navegador.
- 2026-10-31: capacidades atualizadas (skills novas/removidas)

## 2026-10-31 — Financeiro: filtro por tipo e passe de UX
- Modo: tarefa. Orquestrador: Opus 5.5. Commits c1f789c..d5162e7.
- Tarefa: filtro "Todas as receitas/despesas", card "Por tipo" com totais e passe de UX nas abas de /finance.
- Contexto: `.fabuloso/conhecimento/financeiro.md` (novo) + linha-índice no CLAUDE.md; fluxo "Extrato por tipo" e pasta `pages/finance` em `arquitetura.md`. Mapas regenerados.
- Banco: nada. Observação: deriva em `public.user_profiles` sem migration desta tarefa.
- Pendências: viewport do index.html bloqueia zoom (acessibilidade global); quebrar Finance.tsx por aba.

## 2026-10-31 — Financeiro: Finance.tsx dividido por aba
- Modo: tarefa. Orquestrador: Opus 5.5. Commits 9da2628..8eddb09.
- Tarefa: dividir `pages/Finance.tsx` (1.800 linhas) em um componente por aba, sem mudar comportamento.
- Contexto: `.fabuloso/conhecimento/financeiro.md` (estrutura nova, dívida técnica removida); fluxo "Extrato por tipo" em `arquitetura.md`. Mapas regenerados.
- Banco: nada. Pendências: viewport do index.html bloqueia zoom (acessibilidade global).

## 2026-10-31 — Data e hora no mesmo formato em todo o app
- Modo: tarefa. Orquestrador: Opus 5.5. Commits 8e5d03a..8680255.
- Tarefa: `formatDateTimeBRL` único para momentos (extrato, faturamento, dívidas, PDV, estoque, CRM, Settings); extrato com hora e CSV com coluna Hora.
- Contexto: `.fabuloso/conhecimento/financeiro.md` + convenção de data e hora no CLAUDE.md. Mapas regenerados.
- Banco: nada.

## 2026-11-01 — Financeiro: pagamento de pessoal por funcionário e atraso de devedores pelas parcelas
- Modo: tarefa. Orquestrador: Sonnet 5.5. Commits 5e66aba..a5cc0c0.
- Tarefa: lançamento guarda o funcionário pago (`payee_seller_id`, categorias Salário/Serviço semanal); atraso de devedores e dívidas a pagar calculado pelas parcelas, com `customBadge` mandando na cor.
- Contexto: `.fabuloso/conhecimento/financeiro.md` (3 seções novas, incluindo o caminho de entrega pela Management API) + fluxo "Pagamento de pessoal" em `arquitetura.md`. Mapas regenerados.
- Banco: migrations `20261101120000_transactions_payee_seller` e `20261101130000_migrate_legacy_payroll_categories` aplicadas no remoto (102 lançamentos migrados), via Management API.

## 2026-11-09 — Reserva com vários sinais, troca e botão Simulador no Estoque
- Modo: tarefa. Orquestrador: Opus 5.5. Commits 23c834d..f66d604.
- Tarefa: pedidos do Victor: botão Simulador no Estoque; reserva com sinais em formas diferentes e aparelho na troca.
- Contexto: `.fabuloso/conhecimento/reservas.md` (novo) + índice no CLAUDE.md + fluxos de reserva em `arquitetura.md`. Mapas regenerados.
- Banco: migration `20261109190000_reservation_deposit_parts_trade_in` aplicada no remoto (Management API); nenhuma edge function. Observação: `cancel_transaction` (`20260911113452`) perdeu bloqueios de venda e sinal de reserva.

## 2026-11-10 — App multiempresa (tenants)
- Modo: tarefa. Orquestrador: Opus 5.5. Commits b2891a2..d770e7f.
- Tarefa: admin cria empresas e define administradores, troca de empresa por seletor no topo e transfere loja inteira ou aparelhos entre empresas.
- Contexto: `.fabuloso/conhecimento/multiempresa.md` (novo) + índice no CLAUDE.md + fronteira e 3 fluxos em `arquitetura.md`. Mapas regenerados.
- Banco: migration `20261110120000_multitenancy` aplicada; edge functions deployadas: admin-provision-user, admin-manage-user, care-contract, care-sign-public, warranty-public, crm-simulator-quote.
- Observação: deriva do remoto em tabelas `care_*`, `ai_turn_events` e outras (ver mapa do banco); pendências no multiempresa.md.

## 2026-11-10 — Venda de aparelhos entre empresas
- Modo: tarefa. Orquestrador: Sonnet 5.5. Commits 968ae5c, a45ce1b.
- Tarefa: transferência de aparelhos entre empresas pode ser venda (lançamento IN/OUT, preço por aparelho, custos ficam na origem).
- Contexto: `multiempresa.md` (seção nova), `financeiro.md` (categorias da RPC), fluxo em `arquitetura.md`. Mapas regenerados.
- Banco: migration `20261110150000_tenant_stock_sale` aplicada no remoto; nenhuma edge function.

## 2026-11-10 — Liberar funcionários da principal em outras empresas
- Modo: tarefa. Orquestrador: Opus 5.5. Commits b9227b1..8dda0ae.
- Tarefa: admin libera funcionários da iPhone Repasse em outras empresas, com o mesmo papel; o liberado vê a empresa no seletor.
- Contexto: `multiempresa.md` (seção nova) + fluxo em `arquitetura.md`. Mapas regenerados.
- Banco: migration `20261110170000_tenant_shared_members` aplicada no remoto (`db push --linked`); nenhuma edge function.

## 2026-11-11 — Rolagem travada no celular e trava de modais empilhados
- Modo: tarefa. Orquestrador: Fable 5.2. Commits f520158..ef9f8e7.
- Tarefa: celular volta a rolar (regra de `:root` do CRM tirada) e trava de rolagem de overlays passa a ser única e contada (`lib/bodyScrollLock.ts`).
- Contexto: `CLAUDE.md` (Conventions, 1 linha). Mapas regenerados.
- Observação: deriva no remoto em `public.app_role_permissions`, sem migration desta tarefa.

## 2026-11-11 — Vídeos do aparelho no estoque e no compartilhamento
- Modo: tarefa. Orquestrador: Fable 5.2. Commits 9033521..f1fba55.
- Tarefa: vídeos (até 3) no cadastro/edição do estoque e junto das fotos ao compartilhar o aparelho no WhatsApp.
- Contexto: `CLAUDE.md` (Conventions, 1 linha) + 2 fluxos em `arquitetura.md`. Mapas regenerados.
- Banco: migration `20261111120000_stock_item_videos` aplicada no remoto; nenhuma edge function.
