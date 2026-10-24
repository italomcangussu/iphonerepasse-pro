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
