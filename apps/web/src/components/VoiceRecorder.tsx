import { useEffect, useRef, useState } from 'react';
import { Mic, SendHorizontal, Square, X } from 'lucide-react';
import { MAX_CHAT_AUDIO_BYTES, MAX_CHAT_AUDIO_SECONDS } from '@private-chat/contracts';

export function voiceTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

/** Permission is requested only by the microphone button. Recording never sends itself. */
export function VoiceRecorder({ onSend, disabled, onActiveChange }: {
  onSend: (file: File) => Promise<void> | void;
  disabled?: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'permission' | 'recording' | 'preview' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const generation = useRef(0);
  const activeCallback = useRef(onActiveChange);
  activeCallback.current = onActiveChange;

  function release() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    const current = recorder.current;
    recorder.current = null;
    if (current && current.state !== 'inactive') current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  function cancel() {
    generation.current += 1;
    release();
    setFile(null);
    setPhase('idle');
    setSeconds(0);
    activeCallback.current(false);
  }

  useEffect(() => {
    const onPageHide = () => cancel();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      generation.current += 1; release(); activeCallback.current(false);
    };
  }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  async function start() {
    if (disabled || phase !== 'idle') return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar voz. Abre el chat con HTTPS en Safari o Chrome actualizado.');
      return;
    }
    const currentGeneration = ++generation.current;
    activeCallback.current(true);
    setPhase('permission');
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (currentGeneration !== generation.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream.current = acquired;
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('Este navegador no dispone de un formato de grabación compatible.');
      const recording = new MediaRecorder(acquired, { mimeType, audioBitsPerSecond: 64000 });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let bytes = 0;
      const started = performance.now();
      let invalid = false;
      recording.ondataavailable = (event) => {
        if (!event.data.size || currentGeneration !== generation.current) return;
        bytes += event.data.size;
        if (bytes > MAX_CHAT_AUDIO_BYTES) {
          invalid = true;
          setError('La nota supera 10 MiB. Graba una más corta.');
          if (recording.state !== 'inactive') recording.stop();
          return;
        }
        chunks.push(event.data);
      };
      recording.onerror = () => {
        if (currentGeneration !== generation.current) return;
        setError('Se interrumpió la grabación. Inténtalo de nuevo.');
        cancel();
      };
      recording.onstop = () => {
        if (currentGeneration !== generation.current) return;
        const elapsed = Math.min(MAX_CHAT_AUDIO_SECONDS, (performance.now() - started) / 1000);
        release();
        if (invalid || bytes === 0 || elapsed < 0.15) {
          setError(invalid ? 'La nota supera 10 MiB. Graba una más corta.' : 'No se grabó audio. Inténtalo de nuevo.');
          cancel();
          return;
        }
        const type = mimeType.split(';')[0]!;
        const extension = type === 'audio/mp4' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : 'webm';
        setFile(new File(chunks, `nota-de-voz.${extension}`, { type }));
        setSeconds(elapsed);
        setPhase('preview');
      };
      recording.start(1000);
      setPhase('recording');
      setSeconds(0);
      timer.current = window.setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        setSeconds(Math.min(MAX_CHAT_AUDIO_SECONDS, elapsed));
        if (elapsed >= MAX_CHAT_AUDIO_SECONDS - 1 && recording.state === 'recording') recording.stop();
      }, 200);
    } catch (cause) {
      if (currentGeneration !== generation.current) return;
      cancel();
      const name = cause instanceof DOMException ? cause.name : '';
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'No se permitió el micrófono. Habilítalo en los ajustes del navegador e inténtalo de nuevo.'
        : name === 'NotFoundError' ? 'No se encontró un micrófono.'
        : cause instanceof Error && !name ? cause.message : 'No se pudo abrir el micrófono. Revisa los permisos.');
    }
  }

  if (phase === 'idle') return <div className="voice-idle">
    <button type="button" disabled={disabled} onClick={() => void start()} aria-label="Grabar nota de voz"
      className="composer-circle grid h-[50px] w-[50px] place-items-center rounded-full border border-line bg-surface text-ink disabled:opacity-50">
      <Mic className="h-6 w-6" aria-hidden="true" />
    </button>
    {error && <p role="alert" className="voice-error text-sm text-danger">{error}</p>}
  </div>;

  return <div className="voice-panel rounded-3xl border border-line bg-surface p-3" aria-label="Nota de voz">
    <div className="flex items-center gap-3">
      <Mic aria-hidden="true" className={phase === 'recording' ? 'h-5 w-5 animate-pulse text-danger' : 'h-5 w-5 text-accent'} />
      <p role="status" className="flex-1 text-sm">{phase === 'permission' ? 'Esperando permiso del micrófono…' : phase === 'recording' ? 'Grabando' : 'Escucha antes de enviar'}
        {phase !== 'permission' && <span className="ml-2 tabular-nums">{voiceTime(seconds)}</span>}</p>
      {phase === 'recording' && <button type="button" aria-label="Parar grabación" onClick={() => recorder.current?.stop()}
        className="grid h-11 w-11 place-items-center rounded-full bg-danger text-on-danger"><Square className="h-5 w-5" aria-hidden="true" /></button>}
      <button type="button" disabled={phase === 'sending'} onClick={cancel} aria-label="Cancelar nota de voz" className="grid h-11 w-11 place-items-center rounded-full text-muted"><X className="h-5 w-5" aria-hidden="true" /></button>
    </div>
    {url && <audio src={url} controls preload="metadata" aria-label="Escuchar nota antes de enviar" className="mt-2 w-full" />}
    <div className="mt-2 flex items-center justify-between gap-3">
      <p className="text-xs text-muted">Hasta 3 minutos · Se envía sólo al confirmar.</p>
      {file && <button type="button" disabled={phase === 'sending' || disabled} onClick={async () => {
        setPhase('sending'); setError(null);
        try { await onSend(file); cancel(); } catch { setPhase('preview'); setError('No se pudo enviar la nota. Inténtalo de nuevo.'); }
      }} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm text-on-accent disabled:opacity-50">
        <SendHorizontal className="h-4 w-4" aria-hidden="true" />{phase === 'sending' ? 'Enviando…' : 'Enviar nota de voz'}
      </button>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>;
}
