import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Message } from '@private-chat/contracts';
import { MessageBubble } from './MessageBubble';

afterEach(cleanup);
const message: Message = {
  id: '33333333-3333-4333-8333-333333333333', clientMessageId: '44444444-4444-4444-8444-444444444444',
  senderId: '11111111-1111-4111-8111-111111111111', sequence: 1,
  body: 'Último mensaje del chat', createdAt: '2026-10-12T12:00:00.000Z',
};

describe('opciones fuera del área desplazable del chat', () => {
  it('muestra todas las acciones fuera del historial que antes recortaba el menú', () => {
    render(<div className="chat-scroll" role="log" aria-label="Mensajes">
      <MessageBubble message={message} mine read={false} isAdmin={false}
        onReply={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />
    </div>);
    fireEvent.click(screen.getByRole('button', { name: /Opciones del mensaje/ }));
    const menu = screen.getByRole('menu');
    expect(screen.getByRole('log')).not.toContainElement(menu);
    expect(within(menu).getByRole('button', { name: /^Responder/ })).toHaveFocus();
    expect(within(menu).getByRole('button', { name: /^Editar/ })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /^Borrar/ })).toBeInTheDocument();
  });

  it('permite pulsar una acción del portal y cierra con Escape o al pulsar fuera', () => {
    const onReply = vi.fn();
    render(<MessageBubble message={message} mine read={false} isAdmin={false}
      onReply={onReply} onDelete={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Opciones del mensaje/ });
    fireEvent.click(trigger);
    const reply = screen.getByRole('button', { name: /^Responder/ });
    fireEvent.mouseDown(reply);
    fireEvent.click(reply);
    expect(onReply).toHaveBeenCalledExactlyOnceWith(message);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
