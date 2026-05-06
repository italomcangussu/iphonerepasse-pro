/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/crm.ts";

const GROQ_TRANSCRIPTION_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_MODEL = "whisper-large-v3-turbo";
const DEFAULT_LANGUAGE = "pt";
const ALLOWED_MODELS = new Set(["whisper-large-v3-turbo", "whisper-large-v3"]);

interface GroqErrorPayload {
  message?: string;
}

interface GroqTranscriptionPayload {
  text?: string;
  error?: GroqErrorPayload;
}

const getOptionalFormString = (formData: FormData, fieldName: string): string => {
  const rawValue = formData.get(fieldName);
  return typeof rawValue === "string" ? rawValue.trim() : "";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY não configurada.");
    }

    const incomingFormData = await req.formData();
    const audioFile = incomingFormData.get("file");

    if (!(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: "Arquivo de áudio não enviado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (audioFile.size <= 0) {
      return new Response(JSON.stringify({ error: "Arquivo de áudio inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedModel = getOptionalFormString(incomingFormData, "model") || DEFAULT_MODEL;
    if (!ALLOWED_MODELS.has(requestedModel)) {
      return new Response(JSON.stringify({ error: "Modelo de transcrição inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedLanguage = getOptionalFormString(incomingFormData, "language") || DEFAULT_LANGUAGE;
    const payload = new FormData();
    payload.set("file", audioFile, audioFile.name || "audio.webm");
    payload.set("model", requestedModel);
    payload.set("language", requestedLanguage);
    payload.set("response_format", "verbose_json");

    const groqResponse = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: payload,
    });

    const groqResponseText = await groqResponse.text();
    let groqPayload: GroqTranscriptionPayload = {};
    try {
      groqPayload = groqResponseText ? JSON.parse(groqResponseText) as GroqTranscriptionPayload : {};
    } catch {
      groqPayload = { error: { message: groqResponseText || "Resposta inválida da Groq." } };
    }

    if (!groqResponse.ok) {
      const groqMessage = typeof groqPayload?.error?.message === "string"
        ? groqPayload.error.message
        : "Falha ao transcrever áudio com Groq.";

      return new Response(JSON.stringify({ error: groqMessage }), {
        status: groqResponse.status >= 500 ? 502 : groqResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = typeof groqPayload.text === "string" ? groqPayload.text.trim() : "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno na transcrição.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
