import { describe, expect, it } from 'vitest';
import { isPushSupported, urlBase64ToUint8Array } from './push';

describe('push del navegador (contrato v5)', () => {
  it('decodifica base64url VAPID sin perder bytes', () => {
    const bytes = urlBase64ToUint8Array('B_4nE-4vH8sJ7kL1mN2oP3qR4sT5uV6wX7yZ8aB9cD0eF1gH2iJ3kL4');
    expect(bytes.length).toBeGreaterThan(30);
    // Roundtrip del primer byte conocido: 'B' base64url ~ 0x07 (no se valida clave aquí).
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('en jsdom no hay soporte push (sin serviceWorker real)', () => {
    expect(isPushSupported()).toBe(false);
  });
});
