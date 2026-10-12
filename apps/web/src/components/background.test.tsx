import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundPicker } from './BackgroundPicker';
import { DEFAULT_BACKGROUND, backgroundStorage, useBackground } from '../lib/background';

const stored = new Map<string, unknown>();
const revoke = vi.fn();
let storageFails = false;
beforeEach(() => {
  stored.clear(); storageFails = false;
  vi.stubGlobal('URL', class extends URL { static createObjectURL = () => 'blob:background'; static revokeObjectURL = revoke; });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('indexedDB', { open: () => {
    const request: Record<string, unknown> = {};
    const db = { close: vi.fn(), transaction: () => {
      const transaction: Record<string, unknown> = {};
      const run = (key: string, value?: unknown) => {
        const operation: Record<string, unknown> = {};
        setTimeout(() => {
          if (storageFails) { (transaction.onabort as () => void)?.(); return; }
          if (value !== undefined) stored.set(key, value);
          operation.result = value ?? stored.get(key);
          (operation.onsuccess as () => void)?.(); (transaction.oncomplete as () => void)?.();
        }, 0);
        return operation;
      };
      transaction.objectStore = () => ({ get: (key: string) => run(key), put: (value: unknown, key: string) => run(key, value) });
      return transaction;
    } };
    setTimeout(() => { request.result = db; (request.onsuccess as () => void)?.(); }, 0);
    return request;
  } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('fondo personal', () => {
  it('previsualiza sin subir y cancelar conserva el fondo anterior y libera la imagen', async () => {
    const save = vi.fn(); const view = render(<BackgroundPicker background={DEFAULT_BACKGROUND} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar fondo' }));
    fireEvent.change(screen.getByLabelText('Elegir imagen de fondo'), { target: { files: [new File(['image'], 'fondo.png', { type: 'image/png' })] } });
    expect(screen.getByRole('button', { name: 'Guardar fondo' })).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Vista previa del fondo' })).toHaveAttribute('src', 'blob:background');
    expect(fetch).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(save).not.toHaveBeenCalled(); view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:background');
  });
  it('guarda una imagen sólo tras decodificar y confirmar y ofrece restablecer', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<BackgroundPicker background={DEFAULT_BACKGROUND} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar fondo' }));
    const file = new File(['image'], 'fondo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Elegir imagen de fondo'), { target: { files: [file] } });
    fireEvent.load(screen.getByRole('img')); fireEvent.click(screen.getByRole('button', { name: 'Guardar fondo' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ preset: 'plain', image: file }));
    expect(fetch).not.toHaveBeenCalled(); await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar fondo' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Azul profundo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer fondo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fondo' }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(DEFAULT_BACKGROUND));
  });
  it('rechaza SVG o imagen ilegible y muestra errores de almacenamiento sin perder preview', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Sin espacio'));
    render(<BackgroundPicker background={DEFAULT_BACKGROUND} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar fondo' }));
    fireEvent.change(screen.getByLabelText('Elegir imagen de fondo'), { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG');
    fireEvent.change(screen.getByLabelText('Elegir imagen de fondo'), { target: { files: [new File(['bad'], 'x.png', { type: 'image/png' })] } });
    fireEvent.error(screen.getByRole('img')); expect(screen.getByRole('button', { name: 'Guardar fondo' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Negro' })); fireEvent.click(screen.getByRole('button', { name: 'Guardar fondo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin espacio');
    expect(screen.getByRole('button', { name: 'Guardar fondo' })).toBeEnabled();
  });
  it('IndexedDB recuerda fotos por cuenta tras recargar y evita que aparezca el fondo ajeno al cambiar cuenta', async () => {
    const file = new Blob(['image'], { type: 'image/png' });
    await backgroundStorage('one', { preset: 'ocean', image: file });
    const view = renderHook(({ id }) => useBackground(id), { initialProps: { id: 'one' } });
    await waitFor(() => expect(view.result.current.background.image).toBe(file));
    view.rerender({ id: 'two' }); expect(view.result.current.background).toEqual(DEFAULT_BACKGROUND);
    await act(async () => view.result.current.saveBackground({ preset: 'plum' }));
    view.unmount();
    expect(await backgroundStorage('one')).toEqual({ preset: 'ocean', image: file });
    expect(await backgroundStorage('two')).toEqual({ preset: 'plum' }); expect(fetch).not.toHaveBeenCalled();
  });
  it('un fallo de IndexedDB no declara guardado', async () => {
    storageFails = true;
    await expect(backgroundStorage('one', { preset: 'ocean' })).rejects.toThrow('No se pudo guardar');
  });
});
