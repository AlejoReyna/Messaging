import { useEffect, useLayoutEffect, useState } from 'react';

export const BUBBLE_COLORS = [
  { color: 'theme', name: 'Según el tema' },
  { color: '#7c3aed', name: 'Morado' },
  { color: '#2563eb', name: 'Azul' },
  { color: '#047857', name: 'Verde' },
  { color: '#be185d', name: 'Rosa' },
  { color: '#c2410c', name: 'Naranja' },
  { color: '#334155', name: 'Gris' },
] as const;

export function isBubbleColor(value: string | null): value is string {
  return value === 'theme' || /^#[0-9a-f]{6}$/i.test(value ?? '');
}

/** Elegir el texto con mayor contraste frente al color del globo. */
export function bubbleTextColor(color: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}

export function useBubbleColor(userId?: string) {
  const key = userId ? `private-chat:bubble:${userId}` : null;
  const [state, setState] = useState<{ key: string | null; color: string }>({ key: null, color: 'theme' });
  const bubbleColor = state.key === key ? state.color : 'theme';
  useEffect(() => {
    let saved: string | null = null;
    try { if (key) saved = window.localStorage.getItem(key); } catch { /* preferencia en memoria */ }
    setState({ key, color: isBubbleColor(saved) ? saved : 'theme' });
  }, [key]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (bubbleColor === 'theme') {
      root.style.removeProperty('--bubble-custom');
      root.style.removeProperty('--bubble-custom-ink');
    } else {
      root.style.setProperty('--bubble-custom', bubbleColor);
      root.style.setProperty('--bubble-custom-ink', bubbleTextColor(bubbleColor));
    }
  }, [bubbleColor]);
  function chooseBubbleColor(color: string) {
    if (!isBubbleColor(color)) return;
    setState({ key, color });
    try { if (key) window.localStorage.setItem(key, color); } catch { /* preferencia en memoria */ }
  }
  return { bubbleColor, chooseBubbleColor };
}
