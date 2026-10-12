import { useEffect, useState } from 'react';

export const BACKGROUNDS = [
  { id: 'plain', name: 'Liso · según el tema' },
  { id: 'doodle', name: 'Trazos nocturnos' },
  { id: 'midnight', name: 'Negro' },
  { id: 'ocean', name: 'Azul profundo' },
  { id: 'plum', name: 'Ciruela' },
  { id: 'sand', name: 'Arena' },
] as const;
export type BackgroundPreset = typeof BACKGROUNDS[number]['id'];
export type ChatBackground = { preset: BackgroundPreset; image?: Blob };
export const DEFAULT_BACKGROUND: ChatBackground = { preset: 'plain' };

/** Only this browser stores this account's chosen picture; no request to the API. */
export async function backgroundStorage(userId: string, value?: ChatBackground): Promise<ChatBackground> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('private-chat-appearance', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('backgrounds');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento local.'));
  });
  try {
    return await new Promise<ChatBackground>((resolve, reject) => {
      const transaction = db.transaction('backgrounds', value ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('backgrounds');
      const request = value ? store.put(value, userId) : store.get(userId);
      let result: ChatBackground = DEFAULT_BACKGROUND;
      request.onsuccess = () => {
        const candidate = value ?? request.result as ChatBackground | undefined;
        if (candidate && BACKGROUNDS.some((preset) => preset.id === candidate.preset)
          && (!candidate.image || candidate.image instanceof Blob && ['image/jpeg', 'image/png', 'image/webp'].includes(candidate.image.type) && candidate.image.size <= 5 * 1024 * 1024)) result = candidate;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(new Error('No se pudo guardar el fondo. Comprueba el espacio disponible del navegador.'));
    });
  } finally { db.close(); }
}

export function useBackground(userId?: string) {
  const [state, setState] = useState<{ userId?: string; value: ChatBackground }>({ value: DEFAULT_BACKGROUND });
  const background = state.userId === userId ? state.value : DEFAULT_BACKGROUND;
  useEffect(() => {
    let cancelled = false;
    if (!userId) { setState({ value: DEFAULT_BACKGROUND }); return; }
    void backgroundStorage(userId).then((value) => {
      if (!cancelled) setState({ userId, value });
    }).catch(() => { if (!cancelled) setState({ userId, value: DEFAULT_BACKGROUND }); });
    return () => { cancelled = true; };
  }, [userId]);
  async function saveBackground(value: ChatBackground) {
    if (!userId) return;
    await backgroundStorage(userId, value);
    setState({ userId, value });
  }
  return { background, saveBackground };
}

export function useBackgroundImage(image?: Blob) {
  const [state, setState] = useState<{ image: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!image) { setState(null); return; }
    const url = URL.createObjectURL(image);
    setState({ image, url });
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return state?.image === image ? state?.url : undefined;
}
