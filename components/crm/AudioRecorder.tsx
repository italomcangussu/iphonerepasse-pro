import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";

interface AudioRecorderProps {
  initialStream?: MediaStream;
  onStop: (blob: Blob, mimeType: string) => void;
  onCancel: () => void;
  isSending: boolean;
  onError?: (message: string) => void;
}

const PREFERRED_MIME_TYPES = [
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/webm;codecs=opus",
  "audio/webm",
];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({ initialStream, onStop, onCancel, isSending, onError }) => {
  const [duration, setDuration] = useState(0);
  const [stopped, setStopped] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const stoppedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorder?.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = initialStream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const selectedType = PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
        mimeTypeRef.current = selectedType || "audio/webm";

        const mediaRecorder = selectedType
          ? new MediaRecorder(stream, { mimeType: selectedType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.start();

        timerRef.current = setInterval(() => {
          if (!stoppedRef.current) setDuration((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível acessar o microfone.";
        onError?.(message);
        onCancel();
      }
    };

    void start();

    return () => {
      cancelled = true;
      clearTimer();
      cleanupStream();
    };
  }, [clearTimer, cleanupStream, initialStream, onCancel, onError]);

  const handleStop = useCallback(() => {
    if (!mediaRecorderRef.current || stoppedRef.current) return;

    stoppedRef.current = true;
    setStopped(true);
    clearTimer();

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      onStop(blob, mimeTypeRef.current);
    };

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  }, [clearTimer, onStop]);

  const isBusy = stopped || isSending;

  return (
    <div
      className={`flex flex-1 items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors ${
        isBusy
          ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-700/40 dark:bg-emerald-900/20"
          : "border-red-100 bg-red-50/80 dark:border-red-700/40 dark:bg-red-900/20"
      }`}
    >
      {isBusy ? (
        <Loader2 size={14} className="text-emerald-600 animate-spin dark:text-emerald-400" />
      ) : (
        <span className="block h-3 w-3 animate-pulse rounded-full bg-red-500" aria-hidden />
      )}
      <span
        className={`flex-1 text-sm font-semibold tabular-nums ${
          isBusy ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
        }`}
      >
        {isBusy ? `Enviando ${formatTime(duration)}…` : `Gravando ${formatTime(duration)}`}
      </span>

      <button
        type="button"
        onClick={onCancel}
        disabled={isBusy}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-red-950/50"
        title="Cancelar"
        aria-label="Cancelar gravação"
      >
        <Trash2 size={18} />
      </button>

      <button
        type="button"
        onClick={handleStop}
        disabled={isBusy}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-50 ${
          isBusy ? "bg-emerald-500" : "bg-red-500 hover:bg-red-600"
        }`}
        title="Enviar"
        aria-label="Enviar gravação"
      >
        {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
      </button>
    </div>
  );
};

export default AudioRecorder;
