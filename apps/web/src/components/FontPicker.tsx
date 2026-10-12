import { Check, Type } from 'lucide-react';
import { FONTS, type FontId } from '../lib/fonts';

const SAMPLE_STYLE: Record<FontId, { fontFamily: string; fontWeight?: number }> = {
  'patrick-hand': { fontFamily: '"Patrick Hand", cursive' },
  inter: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 },
  nunito: { fontFamily: 'Nunito, system-ui, sans-serif', fontWeight: 700 },
  'noto-serif': { fontFamily: '"Noto Serif", Georgia, serif', fontWeight: 400 },
  'sf-mono-light': { fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace', fontWeight: 300 },
};

export function FontPicker({ font, onChange }: { font: FontId; onChange: (font: FontId) => void }) {
  return (
    <section className="mt-5 border-t border-line pt-5" aria-labelledby="font-title">
      <h3 id="font-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Type className="h-4 w-4" aria-hidden="true" /> Tipografía
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        5 fuentes. Se aplica al momento y se recuerda para tu cuenta en este navegador.
        SF Mono Light usa la fuente instalada en tu dispositivo Apple; en otros dispositivos se muestra la monoespaciada del sistema.
      </p>
      <fieldset className="mt-3 grid grid-cols-1 gap-2.5">
        <legend className="sr-only">Elige la fuente del chat</legend>
        {FONTS.map((option) => (
          <label key={option.id} className="min-w-0 cursor-pointer">
            <input type="radio" name="chat-font" value={option.id} checked={font === option.id}
              onChange={() => onChange(option.id)} className="peer sr-only" />
            <span className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-ink peer-checked:border-accent peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent">
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-muted text-xl" style={SAMPLE_STYLE[option.id]}>
                {option.sample}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold" style={SAMPLE_STYLE[option.id]}>{option.name}</span>
                <span className="block truncate text-[11px] text-muted">{option.note}</span>
              </span>
              {font === option.id && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
