import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CHIIKAWA_PACKS, type ChatSticker } from '../lib/stickers';

export function StickerPicker({ onSelect, onClose }: {
  onSelect: (sticker: ChatSticker) => void;
  onClose: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [packId, setPackId] = useState(CHIIKAWA_PACKS[0]!.id);
  const pack = CHIIKAWA_PACKS.find((candidate) => candidate.id === packId)!;
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = 0; }, [packId]);
  return (
    <section id="chiikawa-stickers" aria-label="Stickers de Chiikawa"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1">
        <div className="min-w-0"><h3 className="truncate font-bold text-ink">{pack.label}</h3>
          <p className="text-xs text-muted">{pack.stickers.length} stickers · ©nagano</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar stickers"
          className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-hover focus-visible:outline-accent">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div role="group" aria-label="Packs de stickers" className="flex gap-1 overflow-x-auto overscroll-contain border-b border-line p-2">
        {CHIIKAWA_PACKS.map((candidate) => (
          <button key={candidate.id} type="button" aria-label={`Pack ${candidate.label}`}
            aria-pressed={packId === candidate.id} onClick={() => setPackId(candidate.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-accent ${packId === candidate.id ? 'border-accent bg-surface-hover text-accent' : 'border-line text-muted hover:bg-surface-hover'}`}>
            <img src={candidate.coverSrc} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
            <span>{candidate.label}</span>
          </button>
        ))}
      </div>
      <div ref={gridRef} className="grid max-h-[32dvh] grid-cols-4 gap-1 overflow-y-auto overscroll-contain p-2 sm:grid-cols-8">
        {pack.stickers.map((sticker, index) => (
          <button ref={index === 0 ? firstRef : undefined} key={sticker.id} type="button"
            onClick={() => onSelect(sticker)} aria-label={`Elegir ${sticker.label}`} title={sticker.label}
            className="grid min-h-16 place-items-center rounded-xl p-2 transition hover:bg-surface-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-accent">
            <img src={sticker.thumbnailSrc ?? sticker.src} alt="" width={80} height={72} loading="lazy" className="h-16 w-20 max-w-full object-contain" />
          </button>
        ))}
      </div>
    </section>
  );
}
