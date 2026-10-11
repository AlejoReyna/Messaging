import { useEffect, useState } from 'react';

// Paletas existentes, adaptadas a los roles de color de la conversación.
// Las fuentes oficiales y los ajustes de contraste están en docs/THEMES.md.
export const THEMES = [
  { id: 'github-light', name: 'GitHub Light', mode: 'Claro' },
  { id: 'github-dark', name: 'GitHub Dark', mode: 'Oscuro' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', mode: 'Claro' },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', mode: 'Oscuro' },
  { id: 'dracula', name: 'Dracula', mode: 'Oscuro' },
  { id: 'nord', name: 'Nord', mode: 'Oscuro' },
  { id: 'solarized-light', name: 'Solarized Light', mode: 'Claro' },
  { id: 'solarized-dark', name: 'Solarized Dark', mode: 'Oscuro' },
  { id: 'gruvbox', name: 'Gruvbox Dark', mode: 'Oscuro' },
  { id: 'tokyo-night', name: 'Tokyo Night', mode: 'Oscuro' },
] as const;

export type ThemeId = typeof THEMES[number]['id'];
export const DEFAULT_THEME: ThemeId = 'github-light';

function isTheme(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function useTheme(userId?: string) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const key = userId ? `private-chat:theme:${userId}` : null;

  useEffect(() => {
    let saved: string | null = null;
    try { if (key) saved = window.localStorage.getItem(key); } catch { /* navegador sin almacenamiento */ }
    setTheme(isTheme(saved) ? saved : DEFAULT_THEME);
  }, [key]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function chooseTheme(next: ThemeId) {
    setTheme(next);
    // Sólo la preferencia visual: nunca sesión, credenciales, perfil ni mensajes.
    try { if (key) window.localStorage.setItem(key, next); } catch { /* sigue funcionando en memoria */ }
  }

  return { theme, chooseTheme };
}
