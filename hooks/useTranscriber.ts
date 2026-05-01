import { useCallback, useState } from "react";
import { supabase } from "../services/supabase";

interface TranscriptionResponse {
  text?: string;
  error?: string;
}

export type TranscriberModel = "whisper-large-v3-turbo" | "whisper-large-v3";

interface PostAudioOptions {
  fileName?: string;
  language?: string;
  model?: TranscriberModel;
}

export const useTranscriber = () => {
  const [transcript, setTranscript] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  const postAudio = useCallback(async (audioBlob: Blob, options?: PostAudioOptions): Promise<string> => {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error("Arquivo de áudio inválido para transcrição.");
    }

    setIsBusy(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append("file", audioBlob, options?.fileName || `audio-${Date.now()}.webm`);
      payload.append("language", options?.language || "pt");
      payload.append("model", options?.model || "whisper-large-v3-turbo");

      const { data, error: invokeError } = await supabase.functions.invoke<TranscriptionResponse>(
        "crm-audio-transcribe",
        { body: payload },
      );

      if (invokeError) {
        throw new Error(invokeError.message || "Falha ao transcrever áudio via Groq.");
      }

      if (!data || data.error) {
        throw new Error(data?.error || "Resposta inválida da transcrição.");
      }

      const text = String(data.text || "").trim();
      setTranscript(text);
      return text;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao transcrever áudio.";
      setError(message);
      throw err;
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    transcript,
    isBusy,
    error,
    postAudio,
    reset,
  };
};
