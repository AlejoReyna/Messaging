import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PHOTO_MESSAGE_BODY, type Message } from '@private-chat/contracts';
import { CHIIKAWA_STICKERS } from '../lib/stickers';
import { MessageBubble } from './MessageBubble';
import { ChatPanel } from './ChatPanel';
import type { PublicUser } from '@private-chat/contracts';

afterEach(() => cleanup());

const mine = '11111111-1111-4111-8111-111111111111';
const theirs = '22222222-2222-4222-8222-222222222222';

function textMessage(over: Partial<Message> = {}): Message {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    clientMessageId: '44444444-4444-4333-8333-444444444444',
    senderId: mine,
    sequence: 1,
    body: 'Hola original',
    createdAt: '2026-01-01T12:00:00.000Z',
    editedAt: null,
    ...over,
  };
}

function user(over: Partial<PublicUser> = {}): PublicUser {
  return {
    id: over.id ?? mine,
    username: over.username ?? 'admin',
    displayName: over.displayName ?? 'Admin',
    role: over.role ?? 'admin',
    avatarUrl: null,
    avatarVersion: 0,
    mustChangePassword: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('edición de mensajes propios (no los recibidos)', () => {
  it('el mensaje propio de texto ofrece Editar en su menú', () => {
    render(<MessageBubble message={textMessage()} mine read={false} isAdmin={false}
      onDelete={vi.fn()} onEdit={vi.fn()} onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /opciones del mensaje/i }));
    expect(screen.getByRole('button', { name: /editar mensaje/i })).toBeInTheDocument();
  });

  it('el mensaje recibido no ofrece Editar aunque se sea admin', () => {
    render(<MessageBubble message={textMessage({ senderId: theirs })} mine={false} read={false} isAdmin
      onDelete={vi.fn()} onEdit={vi.fn()} onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /opciones del mensaje/i }));
    expect(screen.queryByRole('button', { name: /editar mensaje/i })).not.toBeInTheDocument();
  });

  it('stickers y fotos propias no ofrecen Editar (sólo texto)', () => {
    const sticker = textMessage({ body: CHIIKAWA_STICKERS[0]!.body });
    const { unmount } = render(<MessageBubble message={sticker} mine read={false} isAdmin={false}
      onDelete={vi.fn()} onEdit={vi.fn()} onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /opciones del mensaje/i }));
    expect(screen.queryByRole('button', { name: /editar mensaje/i })).not.toBeInTheDocument();
    unmount();
    cleanup();
    const photo = textMessage({
      body: PHOTO_MESSAGE_BODY,
      photoUrl: `/api/messages/${textMessage().id}/photo`,
    });
    render(<MessageBubble message={photo} mine read={false} isAdmin={false}
      onDelete={vi.fn()} onEdit={vi.fn()} onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /opciones del mensaje/i }));
    expect(screen.queryByRole('button', { name: /editar mensaje/i })).not.toBeInTheDocument();
  });

  it('muestra “editado” cuando el mensaje trae editedAt', () => {
    render(<MessageBubble message={textMessage({ editedAt: '2026-01-01T12:05:00.000Z' })} mine read={false} isAdmin={false}
      onDelete={vi.fn()} onEdit={vi.fn()} onReply={vi.fn()} />);
    expect(screen.getByText('editado')).toBeInTheDocument();
  });

  it('guardar llama a onEdit con el id y el texto nuevo', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    render(<MessageBubble message={textMessage()} mine read={false} isAdmin={false}
      onDelete={vi.fn()} onEdit={onEdit} onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /opciones del mensaje/i }));
    fireEvent.click(screen.getByRole('button', { name: /editar mensaje/i }));
    const box = screen.getByLabelText('Editar mensaje');
    fireEvent.change(box, { target: { value: 'Hola editado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios del mensaje' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledExactlyOnceWith(textMessage().id, 'Hola editado'));
  });

  it('ChatPanel sólo expone edición en mensajes propios', () => {
    const me = user();
    const partner = user({ id: theirs, username: 'member', displayName: 'Pareja', role: 'member' });
    const own = textMessage({ id: '55555555-5555-4555-8555-555555555555', clientMessageId: '66666666-6666-4666-8666-666666666666', senderId: me.id, sequence: 2, body: 'Mío' });
    const foreign = textMessage({ id: '77777777-7777-4777-8777-777777777777', clientMessageId: '88888888-8888-4888-8888-888888888888', senderId: theirs, sequence: 1, body: 'Tuyo' });
    const onEditMessage = vi.fn().mockResolvedValue(undefined);
    render(<ChatPanel me={me} partner={partner} messages={[foreign, own]} pending={[]} loading={false}
      loadingMore={false} hasMore={false} loadError={null} connected partnerTyping={false} partnerOnline
      readByPartner={0} notice={null} showSidebarToggle={false} onOpenSettings={vi.fn()} onLoadMore={vi.fn()}
      onReload={vi.fn()} onSend={vi.fn()} onRetry={vi.fn()} onDiscardPending={vi.fn()} onTyping={vi.fn()}
      onDeleteMessage={vi.fn()} onEditMessage={onEditMessage} onClear={vi.fn()} isAdmin={false} clearArmed={false} />);
    const triggers = screen.getAllByRole('button', { name: /opciones del mensaje/i });
    expect(triggers).toHaveLength(2);
    fireEvent.click(triggers[0]!);
    expect(screen.queryByRole('button', { name: /editar mensaje/i })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(triggers[1]!);
    expect(screen.getByRole('button', { name: /editar mensaje/i })).toBeInTheDocument();
  });
});
