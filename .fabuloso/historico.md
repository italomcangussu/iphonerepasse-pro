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
