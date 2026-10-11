import { useState } from 'react';
import type { ChatSticker } from '../lib/stickers';

export function StickerImage({ sticker }: { sticker: ChatSticker }) {
  const [broken, setBroken] = useState(false);
  return broken
    ? <p className="text-sm text-muted">Sticker: {sticker.label}</p>
    : <img src={sticker.src} alt={`Sticker: ${sticker.label}`} width={180} height={160}
        onError={() => setBroken(true)} className="h-40 w-44 max-w-full object-contain" />;
}
