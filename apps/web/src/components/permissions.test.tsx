import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChatPanel } from '../components/ChatPanel';
import type { Message, PublicUser } from '@private-chat/contracts';

afterEach(() => cleanup());

function user(over: Partial<PublicUser> = {}): PublicUser {
  return {
    id: over.id ?? '11111111-1111-4111-8111-111111111111',
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

function baseProps(over: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  const me = user();
  const partner = user({ id: '22222222-2222-4222-8222-222222222222', username: 'member', displayName: 'Pareja', role: 'member' });
  const message: Message = {
    id: '33333333-3333-4333-8333-333333333333',
    clientMessageId: '44444444-4444-4333-8333-444444444444',
    senderId: partner.id,
    sequence: 1,
    body: 'Hola, ¿cómo estás?',
    createdAt: '2026-01-01T12:00:00.000Z',
  };
  return {
    me,
    partner,
    messages: [message],
    pending: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    loadError: null,
    connected: true,
    partnerTyping: false,
    partnerOnline: true,
    readByPartner: 0,
    notice: null,
    showSidebarToggle: false,
    onOpenSettings: vi.fn(),
    onLoadMore: vi.fn(),
    onReload: vi.fn(),
    onSend: vi.fn(),
    onRetry: vi.fn(),
    onDiscardPending: vi.fn(),
    onTyping: vi.fn(),
    onDeleteMessage: vi.fn(),
    onClear: vi.fn(),
    isAdmin: true,
    clearArmed: false,
    ...over,
  } satisfies React.ComponentProps<typeof ChatPanel>;
}

describe('permisos de borrado en el cliente (el servidor es la autoridad)', () => {
  it('el admin ve controles de borrado por mensaje y vaciado', () => {
    render(<ChatPanel {...baseProps({ isAdmin: true })} />);
    expect(screen.getByRole('button', { name: /borrar mensaje/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vaciar conversación/i })).toBeInTheDocument();
  });

  it('el member NO ve controles de borrado del chat', () => {
    // isAdmin=false oculta borrar y vaciar; el contrato exige esta ausencia en UI.
    render(<ChatPanel {...baseProps({ isAdmin: false })} />);
    expect(screen.queryByRole('button', { name: /borrar mensaje/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /vaciar conversación/i })).not.toBeInTheDocument();
    // El historial sigue visible para el miembro.
    expect(screen.getByText('Hola, ¿cómo estás?')).toBeInTheDocument();
  });
});

describe('MVP sin botones muertos', () => {
  it('no muestra llamadas, audio, grupos, registro ni adjuntos', () => {
    render(<ChatPanel {...baseProps()} />);
    expect(screen.queryByRole('button', { name: /llamar|videollamada|audio|grupo|adjuntar/i })).not.toBeInTheDocument();
  });

  it('muestra estado enviado tras persistencia (sin inventar entregado)', () => {
    render(<ChatPanel {...baseProps({
      messages: [{
        id: '33333333-3333-4333-8333-333333333333',
        clientMessageId: '44444444-4444-4333-8333-444444444444',
        senderId: '11111111-1111-4111-8111-111111111111',
        sequence: 2,
        body: 'Yo escribí esto',
        createdAt: '2026-01-01T12:01:00.000Z',
      }],
    })} />);
    // Propio persistido sin lectura del otro: "Enviado", no "Leído" ni "Entregado".
    expect(screen.getByText('Enviado')).toBeInTheDocument();
    expect(screen.queryByText('Entregado')).not.toBeInTheDocument();
  });
});
