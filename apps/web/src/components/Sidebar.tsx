import { LogOut, MessageCircle, Settings } from 'lucide-react';
import type { Message, PublicUser } from '@private-chat/contracts';
import { AvatarView } from './AvatarView';
import { snippetOf } from '../lib/reply';
import { formatTime } from '../lib/format';

export function Sidebar({ me, partner, unread, lastMessage, onOpenConversation, onOpenSettings, onOpenAvatar, onLogout, busy }: {
  me: PublicUser;
  partner: PublicUser | null;
  unread: number;
  lastMessage?: Message | null;
  onOpenConversation: () => void;
  onOpenSettings?: () => void;
  onOpenAvatar: () => void;
  onLogout: () => void;
  busy: boolean;
}) {
  return <aside aria-label="Navegación del chat" className="chat-sidebar hidden h-full w-[300px] shrink-0 flex-col border-r border-line bg-canvas md:flex lg:w-[320px]">
    <div className="flex min-h-24 items-center justify-between px-6">
      <h1 className="text-[25px] font-bold tracking-tight">Chats</h1>
      <button type="button" onClick={onOpenSettings} aria-label="Abrir ajustes y perfil" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-accent"><Settings className="h-5 w-5" aria-hidden="true" /></button>
    </div>
    <p className="mx-6 mb-5 text-xs text-muted">Tu conversación privada</p>
    <nav aria-label="Conversación privada" className="px-3">
      <button type="button" onClick={onOpenConversation} aria-current="page" aria-label={`Conversación con ${partner?.displayName ?? 'tu contacto'}${unread > 0 ? `, ${unread} sin leer` : ''}`}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-4 text-left transition hover:bg-surface-hover">
        {partner ? <AvatarView user={partner} size={56} /> : <MessageCircle className="h-14 w-14 rounded-full bg-accent-soft p-3 text-accent" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2"><span className="truncate text-[16px] font-bold">{partner?.displayName ?? 'Cargando contacto…'}</span>{lastMessage && <span className="shrink-0 text-[11px] text-muted">{formatTime(lastMessage.createdAt)}</span>}</span>
          <span className="mt-1 block truncate text-sm text-muted">{lastMessage ? snippetOf(lastMessage.body, lastMessage.photoUrl, lastMessage.videoUrl, lastMessage.audioUrl) : 'Sólo ustedes dos'}</span>
        </span>
        {unread > 0 && <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-accent px-1 text-xs text-on-accent">{unread}</span>}
      </button>
    </nav>
    <div className="mt-auto p-4">
      <div className="rounded-3xl border border-line bg-surface p-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpenAvatar} aria-label={`Cambiar imagen de ${me.displayName}`} className="shrink-0 rounded-full"><AvatarView user={me} size={44} /></button>
          <button type="button" onClick={onOpenSettings} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold">{me.displayName}</span><span className="block truncate text-xs text-muted">@{me.username}</span></button>
          <button type="button" disabled={busy} onClick={onLogout} aria-label={busy ? 'Cerrando sesión' : 'Cerrar sesión'} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-hover disabled:opacity-50"><LogOut className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </aside>;
}
