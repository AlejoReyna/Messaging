import { useEffect, useState } from 'react';
import { Check, Image, RotateCcw } from 'lucide-react';
import { BACKGROUNDS, DEFAULT_BACKGROUND, useBackgroundImage, type ChatBackground } from '../lib/background';
import { validateAvatarFile } from '../lib/api';

export function BackgroundPicker({ background, onSave }: {
  background: ChatBackground;
  onSave: (background: ChatBackground) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(background);
  const [ready, setReady] = useState(!background.image);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const url = useBackgroundImage(draft.image);
  useEffect(() => { if (!editing) setDraft(background); }, [background, editing]);
  return <section className="settings-card mt-5" aria-labelledby="background-title">
    <h3 id="background-title" className="flex items-center gap-2 text-sm font-bold"><Image className="h-4 w-4 text-accent" aria-hidden="true" />Fondo del chat</h3>
    <p className="mt-2 text-xs leading-relaxed text-muted">Sólo para tu cuenta en este navegador. Tu foto de fondo se guarda en este dispositivo y no se envía al chat.</p>
    {!editing ? <button type="button" onClick={() => { setDraft(background); setEditing(true); setReady(true); setSaved(false); setError(null); }}
      className="mt-3 min-h-11 w-full rounded-xl bg-surface-hover text-sm text-accent">Cambiar fondo</button>
      : <>
        <div className="background-preview relative mt-3 overflow-hidden rounded-2xl border border-line p-4" data-background={draft.preset}>
          {url && <img src={url} alt="Vista previa del fondo" className="absolute inset-0 h-full w-full object-cover" onLoad={(event) => {
            const image = event.currentTarget;
            const valid = image.naturalWidth * image.naturalHeight <= 16_000_000;
            setReady(valid); setError(valid ? null : 'Elige una foto de hasta 16 millones de píxeles.');
          }} onError={() => { setReady(false); setError('No se pudo abrir esa imagen. Elige otra.'); }} />}
          <div className="relative flex h-28 flex-col justify-center gap-3 text-sm">
            <p className="w-fit max-w-[85%] rounded-2xl bg-surface px-3 py-2 shadow-sm">Así se verá tu conversación</p>
            <p className="w-fit self-end rounded-2xl bg-accent-soft px-3 py-2 shadow-sm">Tu espacio, a tu estilo <Check className="ml-1 inline h-3 w-3" /></p>
          </div>
        </div>
        <fieldset className="mt-3 flex flex-wrap gap-2">
          <legend className="sr-only">Elige el fondo del chat</legend>
          {BACKGROUNDS.map((preset) => <label key={preset.id} className="cursor-pointer">
            <input type="radio" name="chat-background" checked={!draft.image && draft.preset === preset.id} onChange={() => {
              setDraft({ preset: preset.id }); setReady(true); setError(null);
            }} className="peer sr-only" disabled={busy} />
            <span className="block rounded-full border border-line px-3 py-2 text-xs peer-checked:border-accent peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{preset.name}</span>
          </label>)}
        </fieldset>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line text-sm text-accent">
          <Image className="h-4 w-4" aria-hidden="true" />Elegir imagen de fondo
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir imagen de fondo" className="sr-only" disabled={busy} onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            const problem = validateAvatarFile(file); setError(problem);
            if (!problem) { setDraft({ preset: draft.preset, image: file }); setReady(false); }
          }} />
        </label>
        <p className="mt-1 text-xs text-muted">JPEG, PNG o WebP · Hasta 5 MiB</p>
        <button type="button" disabled={busy} onClick={() => { setDraft(DEFAULT_BACKGROUND); setReady(true); setError(null); }}
          className="mt-2 flex min-h-11 items-center gap-2 text-sm text-accent"><RotateCcw className="h-4 w-4" aria-hidden="true" />Restablecer fondo</button>
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy || !ready} onClick={async () => {
            setBusy(true); setError(null);
            try { await onSave(draft); setEditing(false); setSaved(true); }
            catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el fondo.'); }
            finally { setBusy(false); }
          }} className="min-h-11 flex-1 rounded-full bg-accent px-4 text-sm text-on-accent disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar fondo'}</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setDraft(background); setError(null); }} className="min-h-11 rounded-full bg-surface-hover px-4 text-sm">Cancelar</button>
        </div>
      </>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    {saved && <p role="status" className="mt-2 text-sm text-success">Fondo guardado en este dispositivo.</p>}
  </section>;
}
