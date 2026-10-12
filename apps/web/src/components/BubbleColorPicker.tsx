import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BUBBLE_COLORS, hexToRgb, rgbToHex } from '../lib/bubbles';

export function BubbleColorPicker({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const [rgb, setRgb] = useState(() => hexToRgb(color).map(String));
  useEffect(() => { setRgb(hexToRgb(color).map(String)); }, [color]);
  return <section className="mt-5 border-t border-line pt-5" aria-labelledby="bubble-title">
    <h3 id="bubble-title" className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" aria-hidden="true" />Color de tus globos</h3>
    <p className="mt-1 text-xs leading-relaxed text-muted">Cambia el color de tus mensajes. Se recuerda para tu cuenta en este navegador.</p>
    <fieldset className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <legend className="sr-only">Elige el color de tus globos</legend>
      {BUBBLE_COLORS.map((option) => <label key={option.color} className="cursor-pointer">
        <input type="radio" name="bubble-color" value={option.color} checked={color === option.color}
          onChange={() => onChange(option.color)} className="peer sr-only" />
        <span className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs peer-checked:border-accent peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
          <span data-bubble-swatch={option.color} aria-hidden="true" className="bubble-swatch h-5 w-5 shrink-0 rounded-full border border-line" />{option.name}
        </span>
      </label>)}
    </fieldset>
    <label className="mt-3 flex min-h-11 items-center justify-between gap-3 text-sm" htmlFor="custom-bubble-color">
      Color personalizado
      <input id="custom-bubble-color" type="color" value={color === 'theme' ? '#7c3aed' : color}
        onChange={(event) => onChange(event.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
    </label>
    <fieldset className="mt-3 grid grid-cols-3 gap-3">
      <legend className="mb-2 text-sm font-semibold">Color personalizado RGB</legend>
      {['Rojo (R)', 'Verde (G)', 'Azul (B)'].map((label, index) => <label key={label} className="min-w-0 text-xs text-muted">
        {label}
        <input type="number" min={0} max={255} step={1} inputMode="numeric" value={rgb[index]} aria-label={label}
          onChange={(event) => {
            const next = rgb.map((value, channel) => channel === index ? event.target.value : value);
            setRgb(next);
            if (next.some((value) => value.trim() === '')) return;
            const hex = rgbToHex(Number(next[0]), Number(next[1]), Number(next[2]));
            if (hex) onChange(hex);
          }}
          onBlur={() => setRgb(hexToRgb(color).map(String))}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-muted px-3 text-base text-ink" />
      </label>)}
    </fieldset>
    <p className="mt-2 text-xs text-muted">Cada canal va de 0 a 255.</p>
    <div className="mt-3 rounded-xl bg-surface-muted p-3" aria-label="Vista previa de tus globos">
      <p className="own-bubble ml-auto w-fit rounded-2xl px-4 py-2 text-sm">Así se verán tus mensajes</p>
    </div>
  </section>;
}
