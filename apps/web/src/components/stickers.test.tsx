import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Message } from '@private-chat/contracts';
import { Composer } from './Composer';
import { MessageBubble, PendingBubble } from './MessageBubble';
import { CHIIKAWA_STICKERS } from '../lib/stickers';

afterEach(() => cleanup());
const sticker = CHIIKAWA_STICKERS[0]!;
const message: Message = {
  id: '33333333-3333-4333-8333-333333333333',
  clientMessageId: '44444444-4444-4444-8444-444444444444',
  senderId: '11111111-1111-4111-8111-111111111111',
  sequence: 1, body: sticker.body, createdAt: '2026-10-11T12:00:00.000Z',
};

function choose() {
  fireEvent.click(screen.getByRole('button', { name: 'Stickers de Chiikawa' }));
  fireEvent.click(screen.getByRole('button', { name: `Elegir ${sticker.label}` }));
}

describe('stickers de Chiikawa', () => {
  it('permite revisar y cancelar sin enviar, cerrar con Escape y restaurar el foco', () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Stickers de Chiikawa' }));
    const picker = screen.getByRole('region', { name: 'Stickers de Chiikawa' });
    expect(within(picker).getAllByRole('button', { name: /^Elegir / })).toHaveLength(40);
    expect(within(picker).getAllByRole('button', { name: /^Elegir / })[0]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stickers de Chiikawa' })).toHaveFocus();
    choose();
    expect(screen.getByRole('img', { name: `Listo para enviar: ${sticker.label}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar sticker' }));
    expect(screen.getByRole('textbox')).toHaveValue('Mi borrador');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('envía por el callback de texto sólo al confirmar y conserva el borrador', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onSendPhoto = vi.fn();
    render(<Composer onSend={onSend} onSendPhoto={onSendPhoto} onTyping={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Después te escribo' } });
    choose();
    fireEvent.load(screen.getByRole('img', { name: `Listo para enviar: ${sticker.label}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    expect(onSend).toHaveBeenCalledExactlyOnceWith(sticker.body, null);
    expect(onSendPhoto).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('Después te escribo');
  });

  it('bloquea stickers desconectado y no permite enviar una imagen que falla', () => {
    const onSend = vi.fn();
    const props = { onSend, onTyping: vi.fn() };
    const view = render(<Composer {...props} disabled />);
    expect(screen.getByRole('button', { name: 'Stickers de Chiikawa' })).toBeDisabled();
    view.rerender(<Composer {...props} />);
    choose();
    fireEvent.error(screen.getByRole('img', { name: `Listo para enviar: ${sticker.label}` }));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el sticker');
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('muestra el sticker, lectura y borrado propio; mantiene texto desconocido y fotos', () => {
    const onDelete = vi.fn();
    const view = render(<MessageBubble message={message} mine read isAdmin={false} onDelete={onDelete} onReply={vi.fn()} />);
    expect(screen.getByRole('img', { name: `Sticker: ${sticker.label}` })).toHaveAttribute('src', sticker.src);
    expect(screen.getByText('Leído')).toBeInTheDocument();
    expect(screen.queryByText(sticker.body)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Borrar mensaje/ }));
    expect(onDelete).toHaveBeenCalledWith(message.id);
    view.rerender(<MessageBubble message={message} mine={false} read={false} isAdmin={false} onDelete={onDelete} onReply={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Borrar mensaje/ })).not.toBeInTheDocument();
    for (const body of ['[sticker:chiikawa:unknown]', `Texto ${sticker.body}`, `${sticker.body} final`]) {
      view.rerender(<MessageBubble message={{ ...message, body }} mine={false} read={false} isAdmin={false} onDelete={onDelete} onReply={vi.fn()} />);
      expect(screen.getByText(body)).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    }
    view.rerender(<MessageBubble message={{ ...message, photoUrl: `/api/messages/${message.id}/photo` }} mine read={false} isAdmin={false} onDelete={onDelete} onReply={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Foto enviada' })).toBeInTheDocument();
    expect(screen.getByText(sticker.body)).toBeInTheDocument();
  });

  it('reintenta y descarta pendientes y ofrece descripción si el asset no carga', () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    render(<PendingBubble body={sticker.body} failed onRetry={onRetry} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
    fireEvent.error(screen.getByRole('img', { name: `Sticker: ${sticker.label}` }));
    expect(screen.getByText(`Sticker: ${sticker.label}`)).toBeInTheDocument();
  });
});
