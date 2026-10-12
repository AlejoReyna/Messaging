import { useEffect, useLayoutEffect, useState } from 'react';

// Paletas existentes, adaptadas a los roles de color de la conversación.
// Las fuentes oficiales y los ajustes de contraste están en docs/THEMES.md.
export const THEMES = [
  { id: 'original', name: 'Blanco original', mode: 'Claro' },
  { id: 'night', name: 'Nocturno · morado', mode: 'Oscuro' },
  { id: 'madoka', name: 'Madoka', mode: 'Claro' },
  { id: 'telegram-dark', name: 'Telegram Dark', mode: 'Oscuro' },
  { id: 'github-light', name: 'GitHub Light', mode: 'Claro' },
  { id: 'github-dark', name: 'GitHub Dark', mode: 'Oscuro' },
  { id: 'cocoa', name: 'Cocoa', mode: 'Claro' },
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
export const DEFAULT_THEME: ThemeId = 'original';
export const MEMBER_DEFAULT_THEME: ThemeId = 'madoka';

export function isDarkTheme(theme: ThemeId) {
  return THEMES.find((option) => option.id === theme)?.mode === 'Oscuro';
}

export function themeForMode(theme: ThemeId, dark: boolean): ThemeId {
  if (isDarkTheme(theme) === dark) return theme;
  const pairs: Partial<Record<ThemeId, ThemeId>> = {
    original: 'night', night: 'original',
    'github-light': 'github-dark', 'github-dark': 'github-light',
    'solarized-light': 'solarized-dark', 'solarized-dark': 'solarized-light',
    'catppuccin-latte': 'catppuccin-mocha', 'catppuccin-mocha': 'catppuccin-latte',
  };
  return pairs[theme] ?? (dark ? 'night' : 'original');
}

function isTheme(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function useTheme(userId?: string, preferredDefault: ThemeId = DEFAULT_THEME) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  // El miembro recibe Madoka una vez; después se recuerda su elección en v3.
  // La cuenta administradora conserva sus preferencias v2.
  const version = preferredDefault === MEMBER_DEFAULT_THEME ? 'v3' : 'v2';
  const key = userId ? `private-chat:theme:${version}:${userId}` : null;

  useEffect(() => {
    let saved: string | null = null;
    try { if (key) saved = window.localStorage.getItem(key); } catch { /* navegador sin almacenamiento */ }
    if (saved === 'pinkie-pie') saved = 'madoka';
    setTheme(isTheme(saved) ? saved : preferredDefault);
  }, [key, preferredDefault]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Safari's surrounding UI must use the same surface as .chat-header.
    // Read the CSS token so all palettes stay in sync without a second map.
    const colors = getComputedStyle(root);
    const navbarColor = colors.getPropertyValue('--color-header').trim() || colors.getPropertyValue('--color-surface').trim();
    if (navbarColor) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', navbarColor);
    }
  }, [theme]);

  function chooseTheme(next: ThemeId) {
    setTheme(next);
    // Sólo la preferencia visual: nunca sesión, credenciales, perfil ni mensajes.
    try { if (key) window.localStorage.setItem(key, next); } catch { /* sigue funcionando en memoria */ }
  }

  return { theme, chooseTheme };
}
