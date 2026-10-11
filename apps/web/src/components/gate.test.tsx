import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GateScreen } from './GateScreen';
import { PinChangeForm } from './PinChangeForm';
import type { PublicUser } from '@private-chat/contracts';

const pinLogin = vi.hoisted(() => vi.fn());
const pinSetup = vi.hoisted(() => vi.fn());
const setUser = vi.hoisted(() => vi.fn());
vi.mock('../state/session', () => ({
  useSession: () => ({
    pinLogin, pinSetup, setUser, csrfToken: 'csrf-test-token-pin',
    busy: false, loginError: null, online: true,
  }),
}));

let fetchMock: ReturnType<typeof vi.fn>;
function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => (
    new Response(JSON.stringify(handler(url, init)), { status: 200 })
  ));
  vi.stubGlobal('fetch', fetchMock);
}

const me: PublicUser = {
  id: '22222222-2222-4222-8222-222222222222', username: 'member', displayName: 'Contacto',
  role: 'member', avatarUrl: null, avatarVersion: 0, mustChangePassword: false,
  updatedAt: '2026-10-10T12:00:00.000Z',
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function press(code: string) {
  fireEvent.click(screen.getByRole('button', { name: `Dígito ${code}` }));
}

describe('GateScreen (puerta con PIN)', () => {
  it('pregunta el nombre una vez y da de alta el código tras confirmarlo', async () => {
    stubFetch((url) => {
      if (url === '/api/auth/pin-status') return { memberPinSet: false };
      throw new Error(`ruta inesperada: ${url}`);
    });
    pinSetup.mockResolvedValue({ user: me, csrfToken: 'nuevo' });
    render(<GateScreen />);
    // Paso 1: pregunta secreta con input de una sola línea.
    const question = await screen.findByLabelText(/chihuahua fallecido/i);
    expect(question.tagName).toBe('INPUT');
    fireEvent.change(question, { target: { value: 'sammy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    // Paso 2: crear código + confirmación con el teclado.
    expect(await screen.findByText(/Crea tu código/i)).toBeInTheDocument();
    press('1'); press('2'); press('3'); press('4');
    expect(await screen.findByText(/Confirma tu código/i)).toBeInTheDocument();
    press('1'); press('2'); press('3'); press('4');
    await waitFor(() => expect(pinSetup).toHaveBeenCalledWith('sammy', '1234'));
    expect(pinLogin).not.toHaveBeenCalled();
  });

  it('pide sólo el código cuando el invitado ya tiene PIN', async () => {
    stubFetch((url) => {
      if (url === '/api/auth/pin-status') return { memberPinSet: true };
      throw new Error(`ruta inesperada: ${url}`);
    });
    pinLogin.mockResolvedValue({ user: me, csrfToken: 'nuevo' });
    render(<GateScreen />);
    expect(await screen.findByText('Ingresa tu código')).toBeInTheDocument();
    expect(screen.queryByLabelText(/chihuahua/i)).not.toBeInTheDocument();
    press('5'); press('6'); press('7'); press('8');
    await waitFor(() => expect(pinLogin).toHaveBeenCalledWith('5678'));
  });

  it('si la confirmación no coincide, avisa y vuelve a crear', async () => {
    stubFetch((url) => {
      if (url === '/api/auth/pin-status') return { memberPinSet: false };
      throw new Error(`ruta inesperada: ${url}`);
    });
    render(<GateScreen />);
    await screen.findByLabelText(/chihuahua fallecido/i);
    fireEvent.change(screen.getByLabelText(/chihuahua fallecido/i), { target: { value: 'Sammy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText(/Crea tu código/i);
    press('1'); press('1'); press('1'); press('1');
    await screen.findByText(/Confirma tu código/i);
    press('2'); press('2'); press('2'); press('2');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no coinciden/i);
    expect(pinSetup).not.toHaveBeenCalled();
  });
});

describe('PinChangeForm (cambiar código)', () => {
  function fill(current: string, next: string, confirm: string) {
    fireEvent.change(screen.getByLabelText('Código actual'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('Código nuevo'), { target: { value: next } });
    fireEvent.change(screen.getByLabelText('Confirmar nuevo'), { target: { value: confirm } });
  }

  it('valida dígitos y confirmación antes de llamar a la API', () => {
    stubFetch(() => ({ user: me }));
    render(<PinChangeForm />);
    fill('12', '3456', '3456');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar código' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/actual.*4 dígitos/i);
    expect(fetchMock).not.toHaveBeenCalled();
    fill('1234', '3456', '9999');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar código' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no coincide/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía actual+nuevo y actualiza el perfil', async () => {
    const updated = { ...me, updatedAt: '2026-10-11T00:00:00.000Z' };
    stubFetch((url, init) => {
      expect(url).toBe('/api/auth/change-pin');
      expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({ currentPin: '1234', newPin: '4321' });
      return { user: updated };
    });
    render(<PinChangeForm />);
    fill('1234', '4321', '4321');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar código' }));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(updated));
    expect(await screen.findByRole('status')).toHaveTextContent(/Código actualizado/i);
  });
});
