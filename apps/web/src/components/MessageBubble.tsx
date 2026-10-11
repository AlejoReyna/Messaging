import { Check, CheckCheck, Clock3, TriangleAlert, Trash2 } from 'lucide-react';
import { PHOTO_MESSAGE_BODY, type Message } from '@private-chat/contracts';
import { MessagePhoto, PendingPhoto } from './MessagePhoto';
import { formatTime, fullDate } from '../lib/format';
import { getMessageSticker } from '../lib/stickers';
import { StickerImage } from './StickerImage';

export function MessageBubble({
  message, mine, read, isAdmin, onDelete, animate = false,
}: {
  message: Message;
  mine: boolean;
  read: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  /** Entrada con pop estilo WhatsApp; el historial se muestra con `false`. */
  animate?: boolean;
}) {
  const sticker = message.photoUrl ? undefined : getMessageSticker(message.body);
  const tickCls = animate
    ? 'tick-pop items-center gap-0.5 font-medium'
    : 'inline-flex items-center gap-0.5 font-medium';
  return (
    <div className={`group flex w-full ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[82%] rounded-3xl border px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[70%] ${
          sticker ? 'border-transparent bg-transparent text-ink' : mine
            ? 'rounded-br-lg border-accent-soft bg-accent-soft text-ink'
            : 'rounded-bl-lg border-line/70 bg-surface text-ink'
        }${animate ? (mine ? ' enter-pop-mine' : ' enter-pop-theirs') : ''}`}
      >
        {message.photoUrl && <MessagePhoto src={message.photoUrl} />}
        {sticker ? <StickerImage key={sticker.id} sticker={sticker} />
          : (!message.photoUrl || message.body !== PHOTO_MESSAGE_BODY) && <p className="whitespace-pre-wrap break-words" lang="es">{message.body}</p>}
        <div className={`mt-1 flex items-center gap-1.5 text-[11px] text-muted ${mine ? 'justify-end' : 'justify-start'}`}>
          <time dateTime={message.createdAt} title={fullDate(message.createdAt)}>
            {formatTime(message.createdAt)}
          </time>
          {mine && (
            read
              ? <span key="read" className={`${tickCls} text-success`}><CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Leído</span></span>
              : <span key="sent" className={tickCls}><Check className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Enviado</span></span>
          )}
          {(isAdmin || mine) && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label={`Borrar mensaje enviado ${formatTime(message.createdAt)}`}
              title="Borrar para ambos"
              className="message-delete-button ml-1 inline-grid min-h-[36px] min-w-[36px] place-items-center rounded-full text-muted opacity-0 transition hover:scale-110 hover:bg-surface-hover hover:text-danger active:scale-95 focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PendingBubble({
  body, photo, failed, error, onRetry, onDiscard,
}: {
  body: string;
  photo?: File;
  failed: boolean;
  error?: string;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const sticker = photo ? undefined : getMessageSticker(body);
  return (
    <div className="flex w-full justify-end">
      <div className="enter-pop-mine max-w-[82%] rounded-3xl rounded-br-lg border border-dashed border-line bg-accent-soft/70 px-4 py-2.5 text-[15px] leading-relaxed text-ink sm:max-w-[70%]">
        {photo && <PendingPhoto file={photo} />}
        {sticker ? <StickerImage key={sticker.id} sticker={sticker} />
          : (!photo || body !== PHOTO_MESSAGE_BODY) && <p className="whitespace-pre-wrap break-words opacity-80">{body}</p>}
        <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-muted">
          {failed ? (
            <>
              <span className="inline-flex items-center gap-1 font-semibold text-danger">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> No enviado
              </span>
              <button type="button" onClick={onRetry} className="min-h-[28px] rounded-full bg-accent px-3 font-bold text-on-accent transition hover:brightness-110 active:scale-95">
                Reintentar
              </button>
              <button type="button" onClick={onDiscard} className="min-h-[28px] rounded-full bg-surface-hover px-3 font-semibold transition hover:bg-black/10 active:scale-95">
                Descartar
              </button>
            </>
          ) : (
            <span className="inline-flex animate-pulse items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Enviando…
            </span>
          )}
        </div>
        {failed && error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
