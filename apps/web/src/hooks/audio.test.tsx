import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { AUDIO_MESSAGE_BODY, type PublicUser } from '@private-chat/contracts';
import { getConversation, getMessages, sendAudio } from '../lib/api';
import { useChat } from './useChat';

vi.mock('../lib/api', () => ({
  getConversation: vi.fn(), getMessages: vi.fn(), sendAudio: vi.fn(), sendMessage: vi.fn(),
  markRead: vi.fn(), deleteMessage: vi.fn(), clearConversation: vi.fn(),
}));
vi.mock('./useSocket', () => ({ useChatSocket: () => null }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const me: PublicUser = {
  id: '11111111-1111-4111-8111-111111111111', username: 'admin', displayName: 'Admin', role: 'admin',
  avatarUrl: null, avatarVersion: 0, mustChangePassword: false, updatedAt: '2026-10-11T12:00:00.000Z',
};
function conversation(version = 1) {
  return { conversation: { id: 1 as const, version, lastSequence: 0, readState: [] }, partner: { ...me, id: '22222222-2222-4222-8222-222222222222', role: 'member' as const } };
}
async function setup() {
  vi.mocked(getConversation).mockResolvedValue(conversation());
  vi.mocked(getMessages).mockResolvedValue({ messages: [], hasMore: false, nextCursor: null, conversationVersion: 1 });
  const hook = renderHook(() => useChat(me, 'csrf', 1, vi.fn()));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('pendientes con audio', () => {
  it('fallo de red conserva audio y reintento manual usa la misma clave sin duplicar', async () => {
    const { result } = await setup();
    vi.mocked(sendAudio).mockRejectedValueOnce(new Error('Sin red'));
    const file = new File(['audio'], 'qa.webm', { type: 'audio/webm' });
    await act(() => result.current.sendAudio(file));
    expect(result.current.pending).toHaveLength(1);
    const item = result.current.pending[0]!;
    expect(item.audio).toBe(file);
    expect(item.status).toBe('failed');
    expect(item.body).toBe(AUDIO_MESSAGE_BODY);
    expect(sendAudio).toHaveBeenCalledTimes(1);
    const message = { id: '33333333-3333-4333-8333-333333333333', clientMessageId: item.clientMessageId,
      senderId: me.id, sequence: 1, body: item.body, createdAt: me.updatedAt,
      audioDurationSeconds: 2, audioUrl: '/api/messages/33333333-3333-4333-8333-333333333333/audio' };
    vi.mocked(sendAudio).mockResolvedValueOnce({ message, repeated: true });
    await act(() => result.current.retry(item.clientMessageId));
    expect(sendAudio).toHaveBeenLastCalledWith(file, { clientMessageId: item.clientMessageId, body: AUDIO_MESSAGE_BODY, conversationVersion: 1 }, 'csrf', undefined);
    expect(result.current.pending).toEqual([]);
    expect(result.current.messages).toEqual([message]);
  });
  it('una versión nueva impide reenviar audio antiguo automáticamente y al reintentar', async () => {
    const { result } = await setup();
    vi.mocked(getConversation).mockResolvedValue(conversation(2));
    vi.mocked(getMessages).mockResolvedValue({ messages: [], hasMore: false, nextCursor: null, conversationVersion: 2 });
    vi.mocked(sendAudio).mockRejectedValueOnce(Object.assign(new Error('Cambió'), { code: 'CONVERSATION_CHANGED' }));
    await act(() => result.current.sendAudio(new File(['audio'], 'qa.webm', { type: 'audio/webm' })));
    expect(result.current.version).toBe(2);
    expect(sendAudio).toHaveBeenCalledTimes(1);
    const key = result.current.pending[0]!.clientMessageId;
    await act(() => result.current.retry(key));
    expect(sendAudio).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toEqual([]);
  });
});
