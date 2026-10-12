import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);
const copy = { title: '¿Estás seguro?', body: 'Esto borrará toda la conversación.', confirmLabel: 'Aceptar' };

it('abrir o cancelar no ejecuta el borrado; sólo Aceptar confirma', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmDialog {...copy} tone="default" onConfirm={onConfirm} onCancel={onCancel} />);
  expect(screen.getByRole('alertdialog', { name: '¿Estás seguro?' })).toHaveTextContent(copy.body);
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

it('contiene el foco, permite Escape y lo devuelve al control anterior al cerrar', () => {
  const opener = document.createElement('button');
  document.body.append(opener); opener.focus();
  const onCancel = vi.fn();
  const view = render(<ConfirmDialog {...copy} onConfirm={vi.fn()} onCancel={onCancel} />);
  const cancel = screen.getByRole('button', { name: 'Cancelar' });
  const accept = screen.getByRole('button', { name: 'Aceptar' });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(accept).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledOnce();
  view.unmount(); expect(opener).toHaveFocus(); opener.remove();
});

it('bloquea confirmación repetida y cancelación mientras se procesa', () => {
  const onConfirm = vi.fn(); const onCancel = vi.fn();
  const view = render(<ConfirmDialog {...copy} busy onConfirm={onConfirm} onCancel={onCancel} />);
  expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Procesando…' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(view.container.querySelector('.confirm-overlay')!);
  expect(onConfirm).not.toHaveBeenCalled(); expect(onCancel).not.toHaveBeenCalled();
});
