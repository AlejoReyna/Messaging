import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { MessageSchema, type Message } from '@private-chat/contracts';
import { startTestServer, TestClient, type TestServer } from './helpers.js';

function event<T>(socket: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Sin evento ${name}`)), 5000);
    socket.once(name, (value: T) => { clearTimeout(timeout); resolve(value); });
  });
}

describe('Edición de mensajes propios (contrato v8, PostgreSQL real)', () => {
  let server: TestServer;
  let admin: TestClient;
  let member: TestClient;
  before(async () => { server = await startTestServer(); });
  after(async () => { await server.close(); });
  beforeEach(async () => {
    server.hub.disconnectAll();
    server.users = await server.reset();
    admin = new TestClient(server.baseUrl);
    member = new TestClient(server.baseUrl);
    for (const [client, username, password] of [[admin, 'admin', server.users.adminPassword], [member, 'member', server.users.memberPassword]] as const) {
      assert.equal((await client.login(username, password)).status, 200);
      const result = await client.request('POST', '/api/auth/change-password', { body: {
        currentPassword: password, newPassword: `Nueva-${username}-contraseña-2026`,
      } });
      assert.equal(result.status, 200);
      client.csrf = (result.json as { csrfToken: string }).csrfToken;
    }
  });

  async function send(client: TestClient, body: string, version = 1, key = randomUUID()) {
    return client.request('POST', '/api/messages', {
      body: { clientMessageId: key, body, conversationVersion: version },
    });
  }

  it('el autor edita su texto: cambia body, marca editedAt y sube versión', async () => {
    const created = await send(member, 'Hola original');
    assert.equal(created.status, 201);
    const first = MessageSchema.parse((created.json as { message: unknown }).message);
    assert.equal(first.editedAt ?? null, null);
    const edited = await member.request('PATCH', `/api/messages/${first.id}`, {
      body: { body: 'Hola editado', conversationVersion: 1 },
    });
    assert.equal(edited.status, 200);
    const payload = edited.json as { message: unknown; conversationVersion: number };
    assert.equal(payload.conversationVersion, 2);
    const message = MessageSchema.parse(payload.message);
    assert.equal(message.body, 'Hola editado');
    assert.ok(typeof message.editedAt === 'string' && message.editedAt.length > 0);
    assert.equal(message.sequence, first.sequence);
    // Ambas cuentas ven el texto editado en el historial.
    for (const client of [admin, member]) {
      const history = await client.request('GET', '/api/messages');
      assert.equal(history.status, 200);
      const found = (history.json as { messages: Message[] }).messages.find((m) => m.id === first.id);
      assert.equal(found?.body, 'Hola editado');
      assert.ok(found?.editedAt);
    }
    // Enviar con versión obsoleta tras la edición da 409.
    const stale = await send(admin, 'tardío', 1);
    assert.equal(stale.status, 409);
    assert.equal((stale.json as { error: { code: string } }).error.code, 'CONVERSATION_CHANGED');
  });

  it('nadie edita mensajes ajenos: member no toca admin y admin no toca member (403)', async () => {
    const fromAdmin = MessageSchema.parse(((await send(admin, 'de admin')).json as { message: unknown }).message);
    const attemptByMember = await member.request('PATCH', `/api/messages/${fromAdmin.id}`, {
      body: { body: 'hack', conversationVersion: 1 },
    });
    assert.equal(attemptByMember.status, 403);
    assert.equal((attemptByMember.json as { error: { code: string } }).error.code, 'FORBIDDEN');
    const fromMember = MessageSchema.parse(((await send(member, 'de member', 1)).json as { message: unknown }).message);
    const attemptByAdmin = await admin.request('PATCH', `/api/messages/${fromMember.id}`, {
      body: { body: 'hack admin', conversationVersion: 1 },
    });
    assert.equal(attemptByAdmin.status, 403);
    // Sin cambios en body ni versión.
    const history = await admin.request('GET', '/api/messages');
    const messages = (history.json as { messages: Message[] }).messages;
    assert.ok(messages.find((m) => m.id === fromAdmin.id && m.body === 'de admin'));
    assert.ok(messages.find((m) => m.id === fromMember.id && m.body === 'de member'));
  });

  it('rechaza inexistente (404), borrado (410), vacío y versión obsoleta', async () => {
    assert.equal((await member.request('PATCH', `/api/messages/${randomUUID()}`, {
      body: { body: 'x', conversationVersion: 1 },
    })).status, 404);
    const created = MessageSchema.parse(((await send(member, 'temporal')).json as { message: unknown }).message);
    assert.equal((await member.request('DELETE', `/api/messages/${created.id}`, { body: { conversationVersion: 1 } })).status, 200);
    const gone = await member.request('PATCH', `/api/messages/${created.id}`, {
      body: { body: 'tarde', conversationVersion: 2 },
    });
    assert.equal(gone.status, 410);
    const second = MessageSchema.parse(((await send(admin, 'segundo', 2)).json as { message: unknown }).message);
    assert.equal((await admin.request('PATCH', `/api/messages/${second.id}`, {
      body: { body: '   ', conversationVersion: 2 },
    })).status, 400);
    assert.equal((await admin.request('PATCH', `/api/messages/${second.id}`, {
      body: { body: 'nuevo', conversationVersion: 1 },
    })).status, 409);
  });

  it('mismo texto no sube versión; message:edited llega a ambas cuentas', async () => {
    const created = MessageSchema.parse(((await send(member, 'fijo')).json as { message: unknown }).message);
    const same = await member.request('PATCH', `/api/messages/${created.id}`, {
      body: { body: 'fijo', conversationVersion: 1 },
    });
    assert.equal(same.status, 200);
    assert.equal((same.json as { conversationVersion: number }).conversationVersion, 1);
    const socket = io(server.baseUrl, { transports: ['websocket'], auth: { csrfToken: admin.csrf },
      extraHeaders: { Cookie: admin.cookies, Origin: server.config.appOrigin }, autoConnect: false });
    try {
      const connected = event(socket, 'connect'); socket.connect(); await connected;
      const incoming = event<{ message: Message; conversationVersion: number }>(socket, 'message:edited');
      const edited = await member.request('PATCH', `/api/messages/${created.id}`, {
        body: { body: 'fijo editado', conversationVersion: 1 },
      });
      assert.equal(edited.status, 200);
      const evt = await incoming;
      assert.equal(evt.message.id, created.id);
      assert.equal(evt.message.body, 'fijo editado');
      assert.equal(evt.conversationVersion, 2);
    } finally { socket.disconnect(); }
  });
});
