import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Reply, SendHorizontal, Sticker, Video, X } from 'lucide-react';
import { MAX_MESSAGE_LENGTH, MAX_CHAT_VIDEO_SECONDS } from '@private-chat/contracts';
import { validateAvatarFile, validateVideoFile } from '../lib/api';
import type { ChatSticker } from '../lib/stickers';
import { snippetOf } from '../lib/reply';
import type { ReplyTarget } from '../hooks/useChat';
import { StickerPicker } from './StickerPicker';

export function Composer({
  onSend, onSendPhoto, onSendVideo, onTyping, disabled, placeholder, replyTo, onCancelReply,
}: {
  onSend: (body: string, replyTo?: ReplyTarget | null) => Promise<void> | void;
  onSendPhoto?: (file: File, caption: string, replyTo?: ReplyTarget | null) => Promise<void> | void;
  onSendVideo?: (file: File, caption: string, replyTo?: ReplyTarget | null) => Promise<void> | void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoPreviewUnavailable, setVideoPreviewUnavailable] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const stopTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickerToggleRef = useRef<HTMLButtonElement>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [sticker, setSticker] = useState<ChatSticker | null>(null);
  const [stickerReady, setStickerReady] = useState(false);

  function closeStickers() {
    setStickersOpen(false);
    stickerToggleRef.current?.focus();
  }

  useEffect(() => {
    if (disabled || sending) setStickersOpen(false);
  }, [disabled, sending]);

  useEffect(() => () => {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    onTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPhotoReady(false);
    setVideoReady(false);
    setVideoPreviewUnavailable(false);
    const file = video ?? photo;
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo, video]);

  function handleChange(v: string) {
    setValue(v);
    if (disabled) return;
    onTyping(v.trim().length > 0);
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => onTyping(false), 4000);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = value.trim();
    if ((!body && !photo && !video && !sticker) || sending || disabled || (photo && !photoReady) ||
      (video && !videoReady) || (sticker && !stickerReady)) return;
    if (!sticker && body.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    onTyping(false);
    try {
      if (sticker) await onSend(sticker.body, replyTo ?? null);
      else if (video && onSendVideo) await onSendVideo(video, body, replyTo ?? null);
      else if (photo && onSendPhoto) await onSendPhoto(photo, body, replyTo ?? null);
      else await onSend(body, replyTo ?? null);
      setSticker(null);
      setStickerReady(false);
      setPhoto(null);
      setVideo(null);
      setPhotoError(null);
      if (!sticker) setValue('');
      onCancelReply?.();
      inputRef.current?.focus();
    } catch {
      setPhotoError('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - value.trim().length;
  const canSend = !disabled && !sending && value.trim().length <= MAX_MESSAGE_LENGTH &&
    (sticker ? stickerReady : video ? videoReady : photo ? photoReady : value.trim().length > 0);

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Enviar mensaje"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && stickersOpen) { event.preventDefault(); event.stopPropagation(); closeStickers(); }
      }}>
      {replyTo && !disabled && !sending && (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-muted px-3 py-2" aria-label={`Respondiendo a ${replyTo.author}`}>
          <Reply className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
            <p className="truncate text-[14px] font-bold text-accent">{replyTo.author}</p>
            <p className="truncate text-[15px] text-muted">{snippetOf(replyTo.message.body, replyTo.message.photoUrl, replyTo.message.videoUrl)}</p>
          </div>
          <button type="button" onClick={() => { onCancelReply?.(); inputRef.current?.focus(); }}
            aria-label="Cancelar respuesta"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-hover active:scale-90">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
      {stickersOpen && !disabled && !sending && <StickerPicker onClose={closeStickers} onSelect={(selected) => {
        setSticker(selected);
        setStickerReady(false);
        setPhotoError(null);
        onTyping(false);
        closeStickers();
      }} />}
      {sticker && <div className="relative w-fit rounded-2xl border border-line bg-surface-muted px-3 py-2">
        <img src={sticker.src} alt={`Listo para enviar: ${sticker.label}`} width={140} height={120}
          className="h-28 w-36 object-contain" onLoad={() => setStickerReady(true)}
          onError={() => { setStickerReady(false); setPhotoError('No se pudo cargar el sticker. Elige otro.'); }} />
        <p className="mt-1 text-xs text-muted">{sticker.label}</p>
        <button type="button" disabled={sending} aria-label="Quitar sticker"
          onClick={() => { setSticker(null); setStickerReady(false); setPhotoError(null); inputRef.current?.focus(); }}
          className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-sm">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>}
      {preview && (
        <div className="relative w-fit rounded-2xl border border-line bg-surface-muted p-2">
          {video ? <>
            <video key={preview} src={preview} aria-label="Video listo para enviar" controls playsInline preload="metadata"
              className="max-h-40 max-w-full rounded-xl bg-black"
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget.duration;
                const valid = Number.isFinite(duration) && duration > 0 && duration <= MAX_CHAT_VIDEO_SECONDS;
                setVideoReady(valid);
                setPhotoError(valid ? null : 'El video debe durar como máximo 3 minutos.');
              }} onError={() => { setVideoPreviewUnavailable(true); setVideoReady(true); }} />
            <p className="mt-1 max-w-xs truncate text-xs text-muted">{video.name} · Hasta 50 MiB / 3 minutos</p>
            {videoPreviewUnavailable && <p className="mt-1 text-sm text-muted">Vista previa no disponible. Puedes enviarlo para abrirlo en el chat.</p>}
          </> : <img src={preview} alt="Foto lista para enviar" className="max-h-40 max-w-full rounded-xl object-contain"
            onLoad={() => setPhotoReady(true)} onError={() => { setPhotoReady(false); setPhotoError('No se pudo abrir esa foto. Elige otra.'); }} />
          }
          <button type="button" disabled={sending} onClick={() => { setPhoto(null); setVideo(null); setPhotoError(null); }} aria-label={video ? 'Quitar video' : 'Quitar foto'}
            className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-sm"><X className="h-5 w-5" /></button>
        </div>
      )}
      {photoError && <p role="alert" className="text-[15px] text-danger">{photoError}</p>}
      {/* Barra estilo WhatsApp: píldora de texto con sticker dentro,
          cámara fuera y botón circular de enviar. Mismos iconos actuales. */}
      <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="relative min-w-0 flex-1">
      <label htmlFor="composer" className="sr-only">Escribe un mensaje</label>
      <input
        ref={inputRef}
        id="composer"
        type="text"
        autoComplete="off"
        enterKeyHint="send"
        maxLength={MAX_MESSAGE_LENGTH + 100}
        value={sticker ? '' : value}
        disabled={disabled || !!sticker}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={sticker ? 'Sticker listo para enviar' : photo || video ? 'Añade un texto…' : placeholder ?? 'Escribe un mensaje…'}
        className="min-h-[50px] w-full min-w-0 rounded-full border border-line bg-surface-muted py-2.5 pl-5 pr-12 text-[17px] text-ink shadow-sm placeholder:text-muted transition-shadow duration-200 focus:border-accent focus:shadow-md disabled:opacity-60"
      />
      <button ref={stickerToggleRef} type="button" disabled={disabled || sending || !!photo || !!video}
        onClick={() => stickersOpen ? closeStickers() : setStickersOpen(true)}
        aria-label="Stickers de Chiikawa" aria-expanded={stickersOpen} aria-controls="chiikawa-stickers"
        title="Stickers de Chiikawa"
        className={`absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full transition hover:bg-surface-hover hover:text-accent active:scale-90 disabled:opacity-50 ${stickersOpen ? 'bg-accent-soft text-accent' : 'text-muted'}`}>
        <Sticker className="h-7 w-7" aria-hidden="true" />
      </button>
      </div>
      {onSendPhoto && <>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir foto" className="sr-only" tabIndex={-1}
          disabled={disabled || sending || !!sticker} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setVideo(null);
            const problem = validateAvatarFile(file);
            setPhotoError(problem);
            setPhoto(problem ? null : file);
          }} />
        <button type="button" disabled={disabled || sending || !!sticker} onClick={() => { setStickersOpen(false); fileRef.current?.click(); }}
          aria-label="Enviar foto" title="Enviar foto" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-hover hover:text-accent active:scale-90 disabled:opacity-50">
          <ImagePlus className="h-7 w-7" aria-hidden="true" />
        </button>
      </>}
      {onSendVideo && <>
        <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          aria-label="Elegir video" className="sr-only" tabIndex={-1} disabled={disabled || sending || !!sticker}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const problem = validateVideoFile(file);
            setPhoto(null);
            setVideoReady(false);
            setPhotoError(problem);
            setVideo(problem ? null : file);
          }} />
        <button type="button" disabled={disabled || sending || !!sticker}
          onClick={() => { setStickersOpen(false); videoFileRef.current?.click(); }} aria-label="Enviar video" title="Enviar video"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-hover hover:text-accent active:scale-90 disabled:opacity-50">
          <Video className="h-7 w-7" aria-hidden="true" />
        </button>
      </>}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Enviar mensaje"
        className={`grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-sm transition-all duration-200 hover:bg-accent-hover active:scale-90 ${
          canSend ? 'scale-100 hover:scale-105' : 'scale-95 opacity-60'
        } disabled:opacity-50`}
      >
        <SendHorizontal className="h-6 w-6" aria-hidden="true" />
      </button>
      </div>
      {value.trim().length > MAX_MESSAGE_LENGTH - 200 && (
        <span aria-live="polite" className="sr-only">Quedan {remaining} caracteres.</span>
      )}
    </form>
  );
}
