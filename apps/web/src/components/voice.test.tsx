import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CHAT_AUDIO_BYTES, MAX_CHAT_AUDIO_SECONDS } from '@private-chat/contracts';
import { VoiceRecorder } from './VoiceRecorder';
import { MessageAudio } from './MessageAudio';
import { Composer } from './Composer';

const stopTrack = vi.fn();
const getUserMedia = vi.fn();
const revoke = vi.fn();
class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (type: string) => type.startsWith('audio/webm');
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { if (this.state === 'inactive') throw new Error('double stop'); this.state = 'inactive'; this.onstop?.(); }
  chunk(blob = new Blob(['voice bytes'], { type: 'audio/webm' })) { this.ondataavailable?.({ data: blob }); }
}
beforeEach(() => {
  FakeRecorder.instances = [];
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:voice-preview');
    static revokeObjectURL = revoke;
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
async function start() {
  fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));
  await screen.findByRole('button', { name: 'Parar grabación' });
  return FakeRecorder.instances[0]!;
}
async function preview() {
  const recording = await start();
  await act(async () => {
    const now = performance.now();
    vi.spyOn(performance, 'now').mockReturnValue(now + 1000);
    recording.chunk(); recording.stop();
  });
  return recording;
}

describe('grabación de voz', () => {
  it('pide micrófono sólo al tocar y envía exclusivamente después de escuchar y confirmar', async () => {
    const onSend = vi.fn(); const view = render(<VoiceRecorder onSend={onSend} onActiveChange={vi.fn()} />);
    expect(getUserMedia).not.toHaveBeenCalled();
    await preview();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Escuchar nota antes de enviar')).toHaveAttribute('src', 'blob:voice-preview');
    expect(screen.getByLabelText('Escuchar nota antes de enviar')).not.toHaveAttribute('autoplay');
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar nota de voz' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    const file = onSend.mock.calls[0]![0] as File;
    expect(file.type).toBe('audio/webm'); expect(file.size).toBeGreaterThan(0);
    view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:voice-preview');
  });
  it('cancelar durante permiso libera incluso un stream que llega tarde y no inicia grabación', async () => {
    let resolve!: (stream: unknown) => void;
    getUserMedia.mockReturnValue(new Promise((done) => { resolve = done; }));
    const onSend = vi.fn(); render(<VoiceRecorder onSend={onSend} onActiveChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar nota de voz' }));
    await act(async () => { resolve({ getTracks: () => [{ stop: stopTrack }] }); });
    expect(stopTrack).toHaveBeenCalledOnce(); expect(FakeRecorder.instances).toHaveLength(0); expect(onSend).not.toHaveBeenCalled();
  });
  it('cancelar y desmontar detiene micrófono, descarta audio y nunca lo envía', async () => {
    const onSend = vi.fn(); const view = render(<VoiceRecorder onSend={onSend} onActiveChange={vi.fn()} />);
    const recording = await start();
    act(() => recording.chunk());
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar nota de voz' }));
    expect(stopTrack).toHaveBeenCalledOnce(); expect(onSend).not.toHaveBeenCalled();
    await start(); view.unmount(); expect(stopTrack).toHaveBeenCalledTimes(2);
  });
  it('muestra permiso denegado y no envía nada', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const onSend = vi.fn(); render(<VoiceRecorder onSend={onSend} onActiveChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se permitió el micrófono');
    expect(onSend).not.toHaveBeenCalled();
  });
  it('se detiene antes del máximo, libera tracks y conserva preview sin envío automático', async () => {
    vi.useFakeTimers();
    const onSend = vi.fn(); render(<VoiceRecorder onSend={onSend} onActiveChange={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' })); });
    const recording = FakeRecorder.instances[0]!;
    const started = performance.now();
    act(() => recording.chunk());
    vi.spyOn(performance, 'now').mockReturnValue(started + (MAX_CHAT_AUDIO_SECONDS - 1) * 1000);
    await act(async () => vi.advanceTimersByTime(200));
    expect(recording.state).toBe('inactive'); expect(stopTrack).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Enviar nota de voz' })).toBeInTheDocument(); expect(onSend).not.toHaveBeenCalled();
  });
  it('rechaza más de 10 MiB aunque los datos finales lleguen después de parar', async () => {
    const onSend = vi.fn(); render(<VoiceRecorder onSend={onSend} onActiveChange={vi.fn()} />);
    const recording = await start();
    await act(async () => recording.chunk(new Blob([new Uint8Array(MAX_CHAT_AUDIO_BYTES + 1)])));
    expect(screen.getByRole('alert')).toHaveTextContent('10 MiB'); expect(onSend).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledOnce();
  });
  it('compositor conserva la cita para voz, y el reproductor no arranca solo', async () => {
    const onSendAudio = vi.fn();
    render(<Composer onSend={vi.fn()} onSendAudio={onSendAudio} onTyping={vi.fn()} replyTo={{ author: 'Alexis', message: {
      id: '11111111-1111-4111-8111-111111111111', clientMessageId: '22222222-2222-4222-8222-222222222222',
      senderId: '33333333-3333-4333-8333-333333333333', sequence: 1, body: 'Hola', createdAt: '2026-10-12T12:00:00.000Z',
    } }} />);
    await preview(); fireEvent.click(screen.getByRole('button', { name: 'Enviar nota de voz' }));
    await waitFor(() => expect(onSendAudio).toHaveBeenCalledOnce());
    expect(onSendAudio.mock.calls[0]![1].message.body).toBe('Hola');
    cleanup(); render(<MessageAudio src="/api/messages/11111111-1111-4111-8111-111111111111/audio" duration={12} />);
    const audio = screen.getByLabelText('Escuchar nota de voz'); expect(audio).toHaveAttribute('controls'); expect(audio).not.toHaveAttribute('autoplay');
    fireEvent.error(audio); expect(screen.getByRole('status')).toHaveTextContent('Audio no disponible');
  });
});
