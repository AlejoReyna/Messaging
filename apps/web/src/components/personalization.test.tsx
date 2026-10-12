import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { PublicUser } from '@private-chat/contracts';
import { AvatarEditor } from './AvatarEditor';
import { AvatarPreview } from './AvatarPreview';
import { ThemePicker } from './ThemePicker';
import { FontPicker } from './FontPicker';
import { ProfileDialog } from './ProfileDialog';
import { BubbleColorPicker } from './BubbleColorPicker';
import { DEFAULT_THEME, MEMBER_DEFAULT_THEME, THEMES, themeForMode, useTheme } from '../lib/themes';
import { bubbleTextColor, rgbToHex, useBubbleColor } from '../lib/bubbles';
import { DEFAULT_FONT, FONTS, useFont } from '../lib/fonts';

const me: PublicUser = {
  id: '11111111-1111-4111-8111-111111111111', username: 'adminqa', displayName: 'Marthiel',
  role: 'admin', avatarUrl: null, avatarVersion: 0, mustChangePassword: false,
  updatedAt: '2026-10-10T12:00:00.000Z',
};
const revoke = vi.fn();
const setUser = vi.hoisted(() => vi.fn());
vi.mock('../state/session', () => ({
  useSession: () => ({ user: me, csrfToken: 'csrf-test-token-for-preview', setUser,
    logout: vi.fn(), changePassword: vi.fn(), busy: false }),
}));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Node 26 expone un localStorage sin archivo; usar almacenamiento del entorno
  // de prueba para que no sustituya al almacenamiento real del navegador.
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:avatar-preview');
    static revokeObjectURL = revoke;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); delete document.documentElement.dataset.theme; delete document.documentElement.dataset.font; });

function editor() {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const view = render(<AvatarEditor me={me} csrfToken="csrf-test-token-for-preview" onSaved={onSaved} onClose={onClose} />);
  return { ...view, onSaved, onClose };
}
function choose(file = new File(['image fixture'], 'avatar.png', { type: 'image/png' })) {
  fireEvent.change(screen.getByLabelText('Seleccionar nueva imagen'), { target: { files: [file] } });
}

describe('vista previa del avatar', () => {
  it('la foto ajena usa la versión actual, muestra ausencia o error y no modifica el perfil', () => {
    const other = { ...me, id: '22222222-2222-4222-8222-222222222222', displayName: 'Alexis' };
    const view = render(<AvatarPreview user={other} onClose={vi.fn()} />);
    expect(screen.getByText('No tiene foto de perfil.')).toBeInTheDocument();
    const withPhoto = { ...other, avatarUrl: `/api/users/${other.id}/avatar?v=1`, avatarVersion: 1 };
    view.rerender(<AvatarPreview user={withPhoto} onClose={vi.fn()} />);
    fireEvent.error(screen.getByRole('img', { name: 'Foto de perfil de Alexis' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la foto.');
    const updated = { ...withPhoto, avatarUrl: `/api/users/${other.id}/avatar?v=2`, avatarVersion: 2 };
    view.rerender(<AvatarPreview user={updated} onClose={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Foto de perfil de Alexis' })).toHaveAttribute('src', updated.avatarUrl);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('elegir y cancelar una imagen no envía ni cambia el perfil', () => {
    const { onSaved, onClose, unmount } = editor();
    choose();
    expect(screen.getByRole('img', { name: 'Foto de perfil de Marthiel' })).toHaveAttribute('src', 'blob:avatar-preview');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:avatar-preview');
  });

  it('guarda sólo tras decodificar y confirmar, con cookies, CSRF y multipart del contrato', async () => {
    const { onSaved, onClose } = editor();
    choose();
    const save = screen.getByRole('button', { name: 'Guardar imagen' });
    expect(save).toBeDisabled();
    fireEvent.load(screen.getByRole('img'));
    const updated = { ...me, avatarUrl: `/api/users/${me.id}/avatar?v=1`, avatarVersion: 1 };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ user: updated }), { status: 200 }));
    fireEvent.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [route, options] = fetchMock.mock.calls[0]!;
    expect(route).toBe('/api/users/me/avatar');
    expect(options).toMatchObject({ method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': 'csrf-test-token-for-preview' } });
    expect(options.body.get('avatar').name).toBe('avatar.png');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('rechaza SVG antes de crear una vista previa y no sube imágenes que no se pueden decodificar', () => {
    editor();
    choose(new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' }));
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG o WebP');
    expect(screen.queryByRole('button', { name: 'Guardar imagen' })).not.toBeInTheDocument();
    choose();
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('button', { name: 'Guardar imagen' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mantiene la vista previa tras un fallo del servidor para permitir reintentar', async () => {
    const { onSaved, onClose } = editor();
    choose(); fireEvent.load(screen.getByRole('img'));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Servidor no disponible' } }), { status: 503 }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar imagen' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Guardar imagen' })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
});

describe('personalización por cuenta', () => {
  it('sólo el miembro recibe Madoka una vez y luego conserva su nueva selección; migra el nombre anterior', () => {
    window.localStorage.setItem('private-chat:theme:v2:member-one', 'github-dark');
    window.localStorage.setItem('private-chat:theme:v2:admin-one', 'pinkie-pie');
    const member = renderHook(() => useTheme('member-one', MEMBER_DEFAULT_THEME));
    expect(member.result.current.theme).toBe('madoka');
    act(() => member.result.current.chooseTheme('cocoa'));
    member.unmount();
    expect(renderHook(() => useTheme('member-one', MEMBER_DEFAULT_THEME)).result.current.theme).toBe('cocoa');
    expect(renderHook(() => useTheme('admin-one')).result.current.theme).toBe('madoka');
    expect(renderHook(() => useTheme('admin-two')).result.current.theme).toBe('original');
    expect(THEMES.find((theme) => theme.id === 'madoka')?.name).toBe('Madoka');
  });

  it('Nunito es la fuente inicial y siguen disponibles GitHub, Solarized y Madoka', () => {
    expect(renderHook(() => useFont('new-account')).result.current.font).toBe('nunito');
    expect(THEMES.map((theme) => theme.id)).toEqual(expect.arrayContaining([
      'github-light', 'github-dark', 'solarized-light', 'solarized-dark', 'madoka', 'gruvbox',
    ]));
    expect(themeForMode('github-light', true)).toBe('github-dark');
    expect(themeForMode('solarized-dark', false)).toBe('solarized-light');
  });

  it('RGB aplica y recuerda el color sin aceptar canales vacíos, fraccionarios o fuera de 0–255', () => {
    function Picker() {
      const { bubbleColor, chooseBubbleColor } = useBubbleColor('rgb-account');
      return <BubbleColorPicker color={bubbleColor} onChange={chooseBubbleColor} />;
    }
    render(<Picker />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Rojo (R)' }), { target: { value: '255' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Verde (G)' }), { target: { value: '128' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Azul (B)' }), { target: { value: '0' } });
    expect(window.localStorage.getItem('private-chat:bubble:rgb-account')).toBe('#ff8000');
    expect(document.documentElement.style.getPropertyValue('--bubble-custom')).toBe('#ff8000');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Verde (G)' }), { target: { value: '256' } });
    expect(window.localStorage.getItem('private-chat:bubble:rgb-account')).toBe('#ff8000');
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'Verde (G)' }));
    expect(screen.getByRole('spinbutton', { name: 'Verde (G)' })).toHaveValue(128);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Rojo (R)' }), { target: { value: '' } });
    expect(window.localStorage.getItem('private-chat:bubble:rgb-account')).toBe('#ff8000');
    fireEvent.change(screen.getByLabelText('Color personalizado'), { target: { value: '#010203' } });
    expect(screen.getByRole('spinbutton', { name: 'Rojo (R)' })).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'Verde (G)' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Azul (B)' })).toHaveValue(3);
    expect(rgbToHex(-1, 0, 0)).toBeNull();
    expect(rgbToHex(1.5, 0, 0)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('vuelve al blanco original y permite alternar modo nocturno sin perder la fuente guardada', () => {
    window.localStorage.setItem('private-chat:theme:account-one', 'telegram-dark');
    window.localStorage.setItem('private-chat:font:account-one', 'nunito');
    const theme = renderHook(() => useTheme('account-one'));
    const font = renderHook(() => useFont('account-one'));
    expect(theme.result.current.theme).toBe('original');
    expect(font.result.current.font).toBe('nunito');
    const onChange = vi.fn();
    const picker = render(<ThemePicker theme="original" onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Modo nocturno' }));
    expect(onChange).toHaveBeenCalledWith('night');
    picker.rerender(<ThemePicker theme="night" onChange={onChange} />);
    expect(screen.getByRole('switch', { name: 'Modo nocturno' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('switch', { name: 'Modo nocturno' }));
    expect(onChange).toHaveBeenLastCalledWith('original');
    expect(themeForMode('catppuccin-latte', true)).toBe('catppuccin-mocha');
    expect(themeForMode('solarized-light', true)).toBe('solarized-dark');
  });

  it('recuerda colores personalizados por cuenta, rechaza valores inválidos y restaura el color del tema', () => {
    const first = renderHook(({ id }) => useBubbleColor(id), { initialProps: { id: 'one' } });
    act(() => first.result.current.chooseBubbleColor('#7c3aed'));
    expect(document.documentElement.style.getPropertyValue('--bubble-custom')).toBe('#7c3aed');
    expect(document.documentElement.style.getPropertyValue('--bubble-custom-ink')).toBe('#ffffff');
    first.unmount();
    const next = renderHook(({ id }) => useBubbleColor(id), { initialProps: { id: 'one' } });
    expect(next.result.current.bubbleColor).toBe('#7c3aed');
    next.rerender({ id: 'two' });
    expect(next.result.current.bubbleColor).toBe('theme');
    expect(document.documentElement.style.getPropertyValue('--bubble-custom')).toBe('');
    act(() => next.result.current.chooseBubbleColor('url(https://invalid.example)'));
    expect(next.result.current.bubbleColor).toBe('theme');
    act(() => next.result.current.chooseBubbleColor('#ffffff'));
    expect(bubbleTextColor('#ffffff')).toBe('#000000');
    act(() => next.result.current.chooseBubbleColor('theme'));
    expect(document.documentElement.style.getPropertyValue('--bubble-custom-ink')).toBe('');
  });

  it('cierra ajustes con el botón y Escape y permite elegir el color sin peticiones al servidor', () => {
    const onClose = vi.fn();
    const onColor = vi.fn();
    render(<ProfileDialog me={me} theme="original" onChooseTheme={vi.fn()} font="inter" onChooseFont={vi.fn()}
      bubbleColor="theme" onChooseBubbleColor={onColor} avatarOpen={false} onOpenAvatar={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Morado' }));
    expect(onColor).toHaveBeenCalledWith('#7c3aed');
    fireEvent.change(screen.getByLabelText('Color personalizado'), { target: { value: '#123456' } });
    expect(onColor).toHaveBeenLastCalledWith('#123456');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ajustes' }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('el lápiz enfoca el nombre y guardar modifica únicamente el perfil propio con CSRF', async () => {
    render(<ProfileDialog me={me} theme="original" onChooseTheme={vi.fn()} font="patrick-hand" onChooseFont={vi.fn()} avatarOpen={false}
      onOpenAvatar={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nombre de Marthiel' }));
    const name = screen.getByRole('textbox', { name: 'Nombre visible' });
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: 'Marthiel Actualizado' } });
    const updated = { ...me, displayName: 'Marthiel Actualizado' };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ user: updated }), { status: 200 }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(updated));
    const [route, options] = fetchMock.mock.calls[0]!;
    expect(route).toBe('/api/users/me');
    expect(options).toMatchObject({ method: 'PATCH', credentials: 'include', headers: { 'X-CSRF-Token': 'csrf-test-token-for-preview' } });
    expect(JSON.parse(options.body)).toEqual({ displayName: 'Marthiel Actualizado' });
  });

  it('el diálogo de ajustes expone los selectores de tema y fuente', () => {
    render(<ProfileDialog me={me} theme="original" onChooseTheme={vi.fn()} font="patrick-hand" onChooseFont={vi.fn()} avatarOpen={false}
      onOpenAvatar={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Elige el tema del chat' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Elige la fuente del chat' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(THEMES.length + FONTS.length);
  });

  it('muestra todos los temas seleccionables del catálogo', () => {
    const onChange = vi.fn();
    render(<ThemePicker theme="original" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(THEMES.length);
    fireEvent.click(screen.getByRole('radio', { name: /Dracula/ }));
    expect(onChange).toHaveBeenCalledWith('dracula');
  });

  it('muestra todas las fuentes seleccionables del catálogo', () => {
    const onChange = vi.fn();
    render(<FontPicker font="patrick-hand" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(FONTS.length);
    fireEvent.click(screen.getByRole('radio', { name: /Noto Serif/ }));
    expect(onChange).toHaveBeenCalledWith('noto-serif');
    fireEvent.click(screen.getByRole('radio', { name: /SF Mono Light/ }));
    expect(onChange).toHaveBeenCalledWith('sf-mono-light');
  });

  it('recuerda la fuente tras recargar, separa las cuentas y rechaza preferencias desconocidas', () => {
    const first = renderHook(({ id }) => useFont(id), { initialProps: { id: 'account-one' } });
    act(() => first.result.current.chooseFont('noto-serif'));
    expect(document.documentElement.dataset.font).toBe('noto-serif');
    first.unmount();
    const next = renderHook(({ id }) => useFont(id), { initialProps: { id: 'account-one' } });
    expect(next.result.current.font).toBe('noto-serif');
    next.rerender({ id: 'account-two' });
    expect(next.result.current.font).toBe(DEFAULT_FONT);
    window.localStorage.setItem('private-chat:font:account-three', 'unrecognized-font');
    next.rerender({ id: 'account-three' });
    expect(next.result.current.font).toBe(DEFAULT_FONT);
  });

  it('recuerda el tema tras recargar, separa las cuentas y rechaza preferencias desconocidas', () => {
    const first = renderHook(({ id }) => useTheme(id), { initialProps: { id: 'account-one' } });
    act(() => first.result.current.chooseTheme('tokyo-night'));
    expect(document.documentElement.dataset.theme).toBe('tokyo-night');
    first.unmount();
    const next = renderHook(({ id }) => useTheme(id), { initialProps: { id: 'account-one' } });
    expect(next.result.current.theme).toBe('tokyo-night');
    next.rerender({ id: 'account-two' });
    expect(next.result.current.theme).toBe(DEFAULT_THEME);
    window.localStorage.setItem('private-chat:theme:account-three', 'unrecognized-theme');
    next.rerender({ id: 'account-three' });
    expect(next.result.current.theme).toBe(DEFAULT_THEME);
  });
});
