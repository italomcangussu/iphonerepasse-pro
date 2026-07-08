// One inbound turn of the admin finance agent.
//
// Flow:
//   1. resolve sender -> admin (deny otherwise)
//   2. if a pending confirmation exists: SIM executes it, anything else cancels
//      it (money never moves without an explicit affirmative reply)
//   3. otherwise run the LLM tool-use loop; prepare_* tools stage a pending
//      confirmation for the next turn.

import { AdminIdentity, resolveAdminByPhone } from "./identity.ts";
import { executePending, OpsDeps } from "./operations.ts";
import { findOpenPendingAction, resolvePendingAction } from "./pending.ts";
import { isAffirmation, isNegation } from "./phone.ts";
import { ChatMessage, runChatWithTools, ToolTraceEntry } from "./llm.ts";

interface SupabaseLike {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
}

export interface RunnerInput {
  supabase: SupabaseLike;
  channelId: string | null;
  conversationId: string | null;
  senderPhone: string;
  messageContent: string;
  history?: ChatMessage[];
  apiKey: string;
  model?: string;
  now?: () => number;
  // Injectable for tests; defaults to the real OpenRouter loop.
  chat?: typeof runChatWithTools;
}

export interface RunnerResult {
  authorized: boolean;
  reply: string;
  mutation?: { action: string; ok: boolean } | null;
  toolTrace?: ToolTraceEntry[];
  error?: string;
}

const CONFIRM_HINT = "Responda *SIM* para confirmar ou *NÃO* para cancelar.";

function buildSystemPrompt(actor: AdminIdentity, cancelledNote: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "Você é a assistente de gestão interna da iPhoneRepasse Pro no WhatsApp — um gerente virtual do app para administradores.",
    `Está falando com ${actor.label ?? "um administrador"} (número autorizado).`,
    `Data de hoje: ${today}.`,
    "",
    "O que você consegue fazer (via ferramentas):",
    "- CONSULTAR (leitura, livre): saldos de Conta/Cofre e total em Devedores; resumo financeiro do período (receitas, despesas, saldo); resumo de vendas (qtd, faturamento, ticket médio); resumo de estoque; dívidas de clientes vencidas; contas a pagar em aberto; últimos lançamentos; perfil de um cliente; buscar aparelhos e listar reservas.",
    "- OPERAR (escrita, sempre com confirmação): transferir entre Conta Bancária e Cofre; lançar receita/despesa manual; receber pagamento de dívida de cliente; pagar uma conta a pagar; reservar um aparelho; liberar/cancelar uma reserva.",
    "",
    "Regras:",
    "- Responda em português do Brasil, em tom direto e objetivo de WhatsApp (curto, sem formalidade excessiva).",
    "- NUNCA invente números. Toda informação financeira/estoque/vendas vem das ferramentas de leitura.",
    "- Toda operação que mexe em dinheiro ou estoque passa pela ferramenta prepare_* correspondente, que NÃO executa nada — só monta um resumo. Apresente o resumo e peça confirmação.",
    `- Depois de um prepare_*, termine a mensagem com: "${CONFIRM_HINT}"`,
    "- NUNCA afirme que uma operação (transferência, lançamento, pagamento, recebimento, reserva ou liberação) foi concluída — isso só acontece após o admin responder SIM em outra mensagem.",
    "- Se faltar dado para uma operação (ex.: valor, conta, forma de pagamento, cliente), pergunte antes de preparar. Nunca chame dois prepare_* na mesma resposta.",
    "- Contas válidas para dinheiro: 'Conta Bancária' e 'Cofre'. Formas de pagamento: Pix, Dinheiro ou Cartão.",
    cancelledNote,
  ].filter(Boolean).join("\n");
}

async function logAudit(
  supabase: SupabaseLike,
  row: {
    phone: string;
    userId: string | null;
    action: string;
    params?: Record<string, unknown>;
    result?: unknown;
    status: "ok" | "error" | "denied";
    error?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("admin_agent_audit_log").insert({
      phone: row.phone,
      user_id: row.userId,
      action: row.action,
      params: row.params ?? {},
      result: row.result ?? null,
      status: row.status,
      error: row.error ?? null,
    });
  } catch {
    // Audit must never break the reply path.
  }
}

export async function runAdminAgentTurn(
  input: RunnerInput,
): Promise<RunnerResult> {
  const { supabase, senderPhone } = input;
  const now = input.now ?? (() => Date.now());
  const chat = input.chat ?? runChatWithTools;

  const actor = await resolveAdminByPhone(supabase, senderPhone);
  if (!actor) {
    await logAudit(supabase, {
      phone: senderPhone,
      userId: null,
      action: "denied",
      status: "denied",
    });
    return {
      authorized: false,
      reply: "⚠️ Este número não está autorizado a operar o assistente financeiro.",
    };
  }

  const deps: OpsDeps = {
    supabase,
    actor,
    channelId: input.channelId,
    conversationId: input.conversationId,
    now,
  };

  // --- Step 2: resolve a pending confirmation deterministically -----------
  const pending = await findOpenPendingAction(supabase, actor.phone, now());
  let cancelledNote = "";
  if (pending) {
    if (isAffirmation(input.messageContent)) {
      const exec = await executePending(deps, pending);
      await resolvePendingAction(
        supabase,
        pending.id,
        exec.ok ? "confirmed" : "cancelled",
        now(),
      );
      await logAudit(supabase, {
        phone: actor.phone,
        userId: actor.userId,
        action: pending.action,
        params: pending.params,
        result: exec.result ?? null,
        status: exec.ok ? "ok" : "error",
        error: exec.ok ? null : exec.error ?? null,
      });
      return {
        authorized: true,
        reply: exec.message,
        mutation: { action: pending.action, ok: exec.ok },
      };
    }

    // Not an affirmation: never execute. Cancel and either stop (explicit "não")
    // or continue interpreting the new message.
    await resolvePendingAction(supabase, pending.id, "cancelled", now());
    if (isNegation(input.messageContent)) {
      await logAudit(supabase, {
        phone: actor.phone,
        userId: actor.userId,
        action: `${pending.action}_cancelled`,
        params: pending.params,
        status: "ok",
      });
      return { authorized: true, reply: "Ok, operação cancelada. 👍" };
    }
    cancelledNote =
      `- Observação: havia uma operação pendente ("${pending.summary}") que foi CANCELADA porque o admin não confirmou; trate a mensagem atual como um novo pedido.`;
  }

  // --- Step 3: LLM tool-use loop ------------------------------------------
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(actor, cancelledNote) },
    ...(input.history ?? []),
    { role: "user", content: input.messageContent },
  ];

  const result = await chat(messages, deps, {
    apiKey: input.apiKey,
    model: input.model,
  });

  const reply = result.reply ||
    (result.error
      ? "Tive um problema para processar agora. Pode tentar de novo?"
      : "Não entendi. Pode reformular?");

  await logAudit(supabase, {
    phone: actor.phone,
    userId: actor.userId,
    action: "chat_turn",
    params: { message: input.messageContent },
    result: {
      tools: (result.toolTrace ?? []).map((t) => t.name),
      error: result.error ?? null,
    },
    status: result.error ? "error" : "ok",
    error: result.error ?? null,
  });

  return {
    authorized: true,
    reply,
    toolTrace: result.toolTrace,
    error: result.error,
  };
}
