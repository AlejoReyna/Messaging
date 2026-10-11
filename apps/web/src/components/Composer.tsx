import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, SendHorizontal, Sticker, X } from 'lucide-react';
import { MAX_MESSAGE_LENGTH } from '@private-chat/contracts';
import { validateAvatarFile } from '../lib/api';
import type { ChatSticker } from '../lib/stickers';
import { StickerPicker } from './StickerPicker';

export function Composer({
  onSend, onSendPhoto, onTyping, disabled, placeholder,
}: {
  onSend: (body: string) => Promise<void> | void;
  onSendPhoto?: (file: File, caption: string) => Promise<void> | void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
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
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

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
    if ((!body && !photo && !sticker) || sending || disabled || (photo && !photoReady) || (sticker && !stickerReady)) return;
    if (!sticker && body.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    onTyping(false);
    try {
      if (sticker) await onSend(sticker.body);
      else if (photo && onSendPhoto) await onSendPhoto(photo, body);
      else await onSend(body);
      setSticker(null);
      setStickerReady(false);
      setPhoto(null);
      setPhotoError(null);
      if (!sticker) setValue('');
      inputRef.current?.focus();
    } catch {
      setPhotoError('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - value.trim().length;
  const canSend = !disabled && !sending && (sticker ? stickerReady : photo ? photoReady : value.trim().length > 0);

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Enviar mensaje"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && stickersOpen) { event.preventDefault(); event.stopPropagation(); closeStickers(); }
      }}>
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
          <img src={preview} alt="Foto lista para enviar" className="max-h-40 max-w-full rounded-xl object-contain"
            onLoad={() => setPhotoReady(true)} onError={() => { setPhotoReady(false); setPhotoError('No se pudo abrir esa foto. Elige otra.'); }} />
          <button type="button" disabled={sending} onClick={() => { setPhoto(null); setPhotoError(null); }} aria-label="Quitar foto"
            className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-sm"><X className="h-5 w-5" /></button>
        </div>
      )}
      {photoError && <p role="alert" className="text-sm text-danger">{photoError}</p>}
      <div className="flex items-center gap-2">
      <button ref={stickerToggleRef} type="button" disabled={disabled || sending || !!photo}
        onClick={() => stickersOpen ? closeStickers() : setStickersOpen(true)}
        aria-label="Stickers de Chiikawa" aria-expanded={stickersOpen} aria-controls="chiikawa-stickers"
        title="Stickers de Chiikawa"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-surface-hover hover:text-accent active:scale-90 disabled:opacity-50 ${stickersOpen ? 'bg-accent-soft text-accent' : 'text-muted'}`}>
        <Sticker className="h-6 w-6" aria-hidden="true" />
      </button>
      {onSendPhoto && <>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir foto" className="sr-only" tabIndex={-1}
          disabled={disabled || sending || !!sticker} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const problem = validateAvatarFile(file);
            setPhotoError(problem);
            setPhoto(problem ? null : file);
          }} />
        <button type="button" disabled={disabled || sending || !!sticker} onClick={() => { setStickersOpen(false); fileRef.current?.click(); }}
          aria-label="Enviar foto" title="Enviar foto" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-hover hover:text-accent active:scale-90 disabled:opacity-50">
          <ImagePlus className="h-6 w-6" aria-hidden="true" />
        </button>
      </>}
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
        placeholder={sticker ? 'Sticker listo para enviar' : photo ? 'Añade un texto…' : placeholder ?? 'Escribe un mensaje…'}
        className="min-h-[52px] min-w-0 flex-1 rounded-full border border-line bg-surface-muted px-5 text-[16px] text-ink shadow-sm placeholder:text-muted transition-shadow duration-200 focus:border-accent focus:shadow-md disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Enviar mensaje"
        className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-sm transition-all duration-200 hover:bg-accent-hover active:scale-90 ${
          canSend ? 'scale-100 hover:scale-105' : 'scale-95 opacity-60'
        } disabled:opacity-50`}
      >
        <SendHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
      </div>
      {value.trim().length > MAX_MESSAGE_LENGTH - 200 && (
        <span aria-live="polite" className="sr-only">Quedan {remaining} caracteres.</span>
      )}
    </form>
  );
}
