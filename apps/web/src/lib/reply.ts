import { PHOTO_MESSAGE_BODY, type Message } from '@private-chat/contracts';
import { getMessageSticker } from './stickers';

/** Cita lista para mostrar o enviar como pendiente (autor resuelto al elegir). */
export interface ReplySnapshot {
  author: string;
  messageId: string;
  senderId: string;
  body: string;
  photoUrl?: string;
}

export function snapshotOf(message: Message, author: string): ReplySnapshot {
  return {
    author,
    messageId: message.id,
    senderId: message.senderId,
    body: message.body,
    ...(message.photoUrl ? { photoUrl: message.photoUrl } : {}),
  };
}

/** Texto corto de la cita: foto, sticker o inicio del texto. */
export function snippetOf(body: string, photoUrl?: string): string {
  if (photoUrl && body === PHOTO_MESSAGE_BODY) return '📷 Foto';
  const sticker = getMessageSticker(body);
  if (sticker) return `Sticker: ${sticker.label}`;
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}
