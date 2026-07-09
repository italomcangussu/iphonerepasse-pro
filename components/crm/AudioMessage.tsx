import React, { useCallback, useState, useRef, useEffect } from "react";
import { Loader2, Mic, Sparkles, Play, Pause } from "lucide-react";
import { useTranscriber } from "../../hooks/useTranscriber";
import { supabase } from "../../services/supabase";

export interface AudioMessageProps {
  url: string;
  fileName: string;
  tone?: 'inbound' | 'outboundHuman' | 'outboundAi';
  messageId?: string;
}

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const isEncryptedWhatsAppMediaUrl = (value: string) => {
  const lower = value.split("?")[0].toLowerCase();
  return value.includes("mmg.whatsapp.net") || lower.endsWith(".enc");
};

const AudioMessage: React.FC<AudioMessageProps> = ({ url, fileName, tone = 'inbound', messageId }) => {
  const { postAudio, isBusy, transcript, error, reset } = useTranscriber();
  const [revealed, setRevealed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [resolvingMedia, setResolvingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setResolvedUrl(url);
    setMediaError(null);
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('play', () => setIsPlaying(true));
    
    // Attempt to preload metadata
    audio.load();
    
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', () => setIsPlaying(false));
      audio.removeEventListener('play', () => setIsPlaying(true));
    };
  }, []);

  const resolvePlayableUrl = useCallback(async () => {
    if (!isEncryptedWhatsAppMediaUrl(resolvedUrl)) return resolvedUrl;
    if (!messageId) throw new Error("Não foi possível baixar a mídia desta mensagem.");

    setResolvingMedia(true);
    setMediaError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{
        mediaUrl?: string;
        error?: string;
      }>("crm-uaz-media-download", { body: { messageId } });

      if (invokeError) throw new Error(invokeError.message || "Falha ao baixar mídia pela UAZAPI.");
      if (!data?.mediaUrl || data.error) throw new Error(data?.error || "UAZAPI não retornou mídia baixada.");

      setResolvedUrl(data.mediaUrl);
      return data.mediaUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao baixar mídia.";
      setMediaError(message);
      throw err;
    } finally {
      setResolvingMedia(false);
    }
  }, [messageId, resolvedUrl]);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      const playableUrl = await resolvePlayableUrl().catch(() => null);
      if (!playableUrl) return;
      if (audioRef.current.src !== playableUrl) audioRef.current.src = playableUrl;
      void audioRef.current.play().catch((err) => {
        setMediaError(err instanceof Error ? err.message : "Não foi possível reproduzir o áudio.");
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  const handleTranscribe = useCallback(async () => {
    if (isBusy) return;
    if (revealed && transcript) {
      setRevealed(false);
      return;
    }
    if (transcript) {
      setRevealed(true);
      return;
    }
    try {
      reset();
      const playableUrl = await resolvePlayableUrl();
      const response = await fetch(playableUrl);
      if (!response.ok) throw new Error("Não foi possível baixar o áudio.");
      const blob = await response.blob();
      const inferredExt = (() => {
        const lower = playableUrl.split("?")[0].toLowerCase();
        const match = lower.match(/\.([a-z0-9]{2,5})$/);
        return match?.[1] || "webm";
      })();
      await postAudio(blob, { fileName: fileName || `audio.${inferredExt}` });
      setRevealed(true);
    } catch {
      // hook already captured error
    }
  }, [fileName, isBusy, postAudio, reset, resolvePlayableUrl, revealed, transcript]);

  const isOutbound = tone === 'outboundHuman' || tone === 'outboundAi';
  
  // WhatsApp styling colors
  const containerClass = isOutbound 
    ? "" // Inherit bubble background
    : "rounded-lg border border-slate-200 bg-white/80 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200";

  return (
    <div className={`w-[240px] max-w-full ${containerClass}`}>
      <audio ref={audioRef} src={resolvedUrl} preload="metadata" className="hidden" />
      
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button 
          type="button"
          onClick={togglePlayPause} 
          disabled={resolvingMedia}
          aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
        >
          {resolvingMedia ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <Pause fill="currentColor" size={16} /> : <Play fill="currentColor" size={16} className="ml-1" />}
        </button>
        
        {/* Waveform / Scrubber */}
        <div className="flex flex-1 flex-col justify-center mt-1">
          <div className="relative flex h-11 items-center">
            <input 
              type="range" 
              aria-label="Posição do áudio"
              min={0} 
              max={duration || 100} 
              value={currentTime} 
              onChange={handleSeek}
              className="absolute h-full w-full cursor-pointer opacity-0 z-10 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500"
            />
            <div className="w-full h-1.5 bg-black/10 dark:bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-current transition-all duration-75" 
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            {/* Scrubber thumb visual */}
            <div 
              className="absolute h-3 w-3 rounded-full bg-current shadow-sm transition-all duration-75 pointer-events-none"
              style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 6px)` }}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-ios-caption opacity-70">
            <span>{formatTime(currentTime)}</span>
            {duration > 0 && <span>{formatTime(duration)}</span>}
          </div>
        </div>
        
        {/* Mic Icon Avatar equivalent */}
        <div className="flex shrink-0 opacity-60">
          <Mic size={18} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleTranscribe()}
        disabled={isBusy || resolvingMedia}
        className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:cursor-wait disabled:opacity-60
          ${isOutbound 
            ? "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20" 
            : "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:hover:bg-brand-500/25"
          }`}
      >
        {isBusy ? (
          <>
            <Loader2 size={11} className="animate-spin" /> Transcrevendo...
          </>
        ) : resolvingMedia ? (
          <>
            <Loader2 size={11} className="animate-spin" /> Baixando mídia...
          </>
        ) : (
          <>
            <Sparkles size={11} /> {revealed && transcript ? "Ocultar transcrição" : transcript ? "Mostrar transcrição" : "Transcrever áudio"}
          </>
        )}
      </button>

      {mediaError && !resolvingMedia && (
        <div className={`mt-1.5 flex flex-col gap-1 text-ios-footnote ${isOutbound ? 'text-red-100' : 'text-red-700 dark:text-red-300'}`}>
          <span>{mediaError}</span>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-50 px-3 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-100"
            onClick={() => {
              setMediaError(null);
              void resolvePlayableUrl().catch(() => undefined);
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      
      {revealed && transcript && (
        <p className={`mt-1.5 whitespace-pre-wrap rounded-md px-2 py-1.5 text-ios-footnote leading-snug
          ${isOutbound 
            ? "bg-black/5 dark:bg-white/10" 
            : "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
          }`}
        >
          {transcript}
        </p>
      )}
      {error && !isBusy && (
        <p className={`mt-1.5 text-ios-footnote ${isOutbound ? 'text-red-200' : 'text-red-600 dark:text-red-400'}`}>{error}</p>
      )}
    </div>
  );
};

export default AudioMessage;
