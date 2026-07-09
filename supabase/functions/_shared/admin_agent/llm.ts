// OpenRouter (OpenAI-compatible) tool-use loop for the admin agent.

import { OpsDeps } from "./operations.ts";
import { runTool, TOOL_SPECS } from "./tools.ts";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Overridable via the ADMIN_AGENT_MODEL env/secret. Keep this a currently-valid
// OpenRouter slug — the old `anthropic/claude-3.5-sonnet` slug now 404s.
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ToolTraceEntry {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface RunChatResult {
  reply: string;
  toolTrace: ToolTraceEntry[];
  error?: string;
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/**
 * Run the tool-use loop until the model returns a plain assistant message or
 * the iteration cap is hit. Tool calls are executed against `deps`.
 */
export async function runChatWithTools(
  messages: ChatMessage[],
  deps: OpsDeps,
  opts: {
    apiKey: string;
    model?: string;
    maxIterations?: number;
    timeoutMs?: number;
  },
): Promise<RunChatResult> {
  const model = opts.model || DEFAULT_MODEL;
  const maxIterations = opts.maxIterations ?? 6;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const convo: ChatMessage[] = [...messages];
  const toolTrace: ToolTraceEntry[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://iphonerepasse.com.br",
          "X-Title": "iPhoneRepasse Admin Agent",
        },
        body: JSON.stringify({
          model,
          messages: convo,
          tools: TOOL_SPECS,
          tool_choice: "auto",
          temperature: 0.2,
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      return {
        reply: "",
        toolTrace,
        error: `llm_request_failed:${(err as Error).message}`,
      };
    }
    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        reply: "",
        toolTrace,
        error: `llm_http_${response.status}:${text.slice(0, 300)}`,
      };
    }

    const body = await response.json().catch(() => null) as
      | { choices?: Array<{ message?: ChatMessage }> }
      | null;
    const message = body?.choices?.[0]?.message;
    if (!message) {
      return { reply: "", toolTrace, error: "llm_empty_response" };
    }

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { reply: (message.content ?? "").trim(), toolTrace };
    }

    // Record the assistant turn that requested tools, then run them.
    convo.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      const name = call.function?.name ?? "";
      const args = parseArgs(call.function?.arguments);
      let result: unknown;
      try {
        result = await runTool(name, args, deps);
      } catch (err) {
        result = { ok: false, error: (err as Error).message };
      }
      toolTrace.push({ name, args, result });
      convo.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: "Não consegui concluir. Pode reformular o pedido?",
    toolTrace,
    error: "max_iterations_reached",
  };
}
