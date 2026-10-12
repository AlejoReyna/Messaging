import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { voiceTime } from './VoiceRecorder';

export function MessageAudio({ src, duration }: { src: string; duration?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return <div className="message-audio min-w-0 px-2 py-2">
    <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Mic className="h-4 w-4 text-accent" aria-hidden="true" />Nota de voz
      {duration !== undefined && <span className="ml-auto text-xs font-normal text-muted">{voiceTime(duration)}</span>}</p>
    {broken ? <p role="status" className="text-sm text-muted">Audio no disponible. Recarga el chat para intentarlo de nuevo.</p>
      : <audio key={src} src={src} controls preload="metadata" aria-label="Escuchar nota de voz" onError={() => setBroken(true)} className="block h-10 w-full max-w-full" />}
  </div>;
}

export function PendingAudio({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file); setSrc(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return src ? <MessageAudio src={src} /> : null;
}
