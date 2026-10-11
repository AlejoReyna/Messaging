import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CHIIKAWA_STICKERS, type ChatSticker } from '../lib/stickers';

export function StickerPicker({ onSelect, onClose }: {
  onSelect: (sticker: ChatSticker) => void;
  onClose: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  return (
    <section id="chiikawa-stickers" aria-label="Stickers de Chiikawa"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1">
        <div><h3 className="font-bold text-ink">Chiikawa</h3>
          <p className="text-xs text-muted">40 stickers · ©nagano</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar stickers"
          className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-hover focus-visible:outline-accent">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid max-h-[32dvh] grid-cols-4 gap-1 overflow-y-auto overscroll-contain p-2 sm:grid-cols-8">
        {CHIIKAWA_STICKERS.map((sticker, index) => (
          <button ref={index === 0 ? firstRef : undefined} key={sticker.id} type="button"
            onClick={() => onSelect(sticker)} aria-label={`Elegir ${sticker.label}`} title={sticker.label}
            className="grid min-h-16 place-items-center rounded-xl p-2 transition hover:bg-surface-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-accent">
            <img src={sticker.src} alt="" width={80} height={72} className="h-16 w-20 max-w-full object-contain" />
          </button>
        ))}
      </div>
    </section>
  );
}
