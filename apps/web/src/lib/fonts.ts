import { useEffect, useLayoutEffect, useState } from 'react';

// Catálogo de fuentes de la interfaz. Nunito es la predeterminada.
// Inter, Nunito y Noto Serif se sirven desde el propio dominio (archivos woff2 en
// src/assets/fonts, licencias OFL junto a ellos). SF Mono Light NO se distribuye:
// es propietaria de Apple y sólo se usa si ya está instalada en el dispositivo
// (pila ui-monospace del sistema); en otros dispositivos cae al monoespaciado local.
export const FONTS = [
  { id: 'patrick-hand', name: 'Patrick Hand', note: 'Manuscrita', sample: 'Aa' },
  { id: 'inter', name: 'Inter', note: 'Neutra · máxima legibilidad', sample: 'Aa' },
  { id: 'nunito', name: 'Nunito', note: 'Predeterminada · redondeada', sample: 'Aa' },
  { id: 'noto-serif', name: 'Noto Serif', note: 'Serif ligera · estilo Times', sample: 'Aa' },
  { id: 'sf-mono-light', name: 'SF Mono Light', note: 'Sistema Apple · monoespaciada', sample: 'Aa' },
] as const;

export type FontId = typeof FONTS[number]['id'];
export const DEFAULT_FONT: FontId = 'nunito';

function isFont(value: string | null): value is FontId {
  return FONTS.some((font) => font.id === value);
}

export function useFont(userId?: string, preferredDefault: FontId = DEFAULT_FONT) {
  const [font, setFont] = useState<FontId>(DEFAULT_FONT);
  const key = userId ? `private-chat:font:${userId}` : null;

  useEffect(() => {
    let saved: string | null = null;
    try { if (key) saved = window.localStorage.getItem(key); } catch { /* navegador sin almacenamiento */ }
    setFont(isFont(saved) ? saved : preferredDefault);
  }, [key, preferredDefault]);

  useLayoutEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);

  function chooseFont(next: FontId) {
    setFont(next);
    // Sólo la preferencia visual: nunca sesión, credenciales, perfil ni mensajes.
    try { if (key) window.localStorage.setItem(key, next); } catch { /* sigue funcionando en memoria */ }
  }

  return { font, chooseFont };
}
