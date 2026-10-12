import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { MessageSchema, AUDIO_MESSAGE_BODY, MAX_CHAT_AUDIO_BYTES, type Message } from "@private-chat/contracts";
import { startTestServer, TestClient, type TestServer } from "./helpers.js";
import { makeAudioFixture, makeVideoFixture } from "../audio-fixtures.js";
import { reconcileDeletions } from "../../src/reconciliation.js";

function form(audio: Buffer, key = randomUUID(), version = 1, caption = "", replyToMessageId?: string) {
  const data = new FormData();
  data.append("clientMessageId", key);
  data.append("conversationVersion", String(version));
  data.append("body", caption);
  if (replyToMessageId) data.append("replyToMessageId", replyToMessageId);
  data.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/webm;codecs=opus" }), "recording.webm");
  return data;
}
function event<T>(socket: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Sin evento ${name}`)), 5000);
    socket.once(name, (value: T) => { clearTimeout(timeout); resolve(value); });
  });
}

describe("Notas de voz privadas (PostgreSQL y sockets reales)", () => {
  let server: TestServer;
  let admin: TestClient;
  let member: TestClient;
  let recording: Buffer;
  before(async () => { server = await startTestServer(); recording = makeAudioFixture("webm"); });
  after(async () => { await server.close(); });
  beforeEach(async () => {
    server.hub.disconnectAll();
    server.users = await server.reset();
    admin = new TestClient(server.baseUrl); member = new TestClient(server.baseUrl);
    for (const [client, username, password] of [[admin, "admin", server.users.adminPassword], [member, "member", server.users.memberPassword]] as const) {
      assert.equal((await client.login(username, password)).status, 200);
      const result = await client.request("POST", "/api/auth/change-password", { body: {
        currentPassword: password, newPassword: `Nueva-${username}-contraseña-2026`,
      } });
      assert.equal(result.status, 200); client.csrf = (result.json as { csrfToken: string }).csrfToken;
    }
  });
  const messageOf = (json: unknown): Message => MessageSchema.parse((json as { message: unknown }).message);
  async function upload(client: TestClient, audio = recording, key = randomUUID(), version = 1, caption = "", replyToMessageId?: string) {
    return client.request("POST", "/api/messages/audio", { rawBody: form(audio, key, version, caption, replyToMessageId) });
  }
  async function send(client: TestClient, body: string, replyToMessageId?: string) {
    return client.request("POST", "/api/messages", { body: {
      clientMessageId: randomUUID(), conversationVersion: 1, body, ...(replyToMessageId ? { replyToMessageId } : {}),
    } });
  }

  it("invitado graba/envía; admin recibe, descarga, reproduce rangos y marca lectura", async () => {
    const socket = io(server.baseUrl, { transports: ["websocket"], auth: { csrfToken: admin.csrf },
      extraHeaders: { Cookie: admin.cookies, Origin: server.config.appOrigin }, autoConnect: false });
    try {
      const connected = event(socket, "connect"); socket.connect(); await connected;
      const incoming = event<{ message: Message }>(socket, "message:created");
      const created = await upload(member);
      assert.equal(created.status, 201);
      const message = messageOf(created.json);
      assert.equal(message.body, AUDIO_MESSAGE_BODY);
      assert.ok(message.audioUrl); assert.ok(message.audioDurationSeconds! > 0);
      assert.deepEqual((await incoming).message, message);
      assert.equal("audioData" in message, false); assert.equal("audioHash" in message, false);
      const history = await admin.request("GET", "/api/messages");
      assert.deepEqual((history.json as { messages: Message[] }).messages, [message]);
      const response = await fetch(`${server.baseUrl}${message.audioUrl}`, { headers: { cookie: admin.cookies } });
      assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "audio/mp4");
      assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("accept-ranges"), "bytes");
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.subarray(4, 8).toString("ascii"), "ftyp");
      const partial = await fetch(`${server.baseUrl}${message.audioUrl}`, { headers: { cookie: admin.cookies, range: "bytes=0-31" } });
      assert.equal(partial.status, 206); assert.equal(partial.headers.get("content-range"), `bytes 0-31/${bytes.length}`);
      assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(0, 32));
      const invalid = await fetch(`${server.baseUrl}${message.audioUrl}`, { headers: { cookie: admin.cookies, range: `bytes=${bytes.length}-` } });
      assert.equal(invalid.status, 416);
      const read = event<{ userId: string; lastReadSequence: number }>(socket, "read:updated");
      assert.equal((await admin.request("POST", "/api/conversation/read", { body: { lastReadSequence: message.sequence, conversationVersion: 1 } })).status, 200);
      assert.equal((await read).lastReadSequence, message.sequence);
      assert.equal((await fetch(`${server.baseUrl}${message.audioUrl}`)).status, 401);
      const revokedCookie = admin.cookies;
      await admin.request("POST", "/api/auth/logout", { body: {} });
      assert.equal((await fetch(`${server.baseUrl}${message.audioUrl}`, { headers: { cookie: revokedCookie } })).status, 401);
    } finally { socket.disconnect(); }
  });

  it("retry conserva identidad; cambiar bytes, tipo, texto o cita devuelve 409", async () => {
    const original = messageOf((await send(member, "Pregunta")).json);
    const key = randomUUID();
    const first = await upload(admin, recording, key, 1, "", original.id);
    assert.equal(first.status, 201);
    const retry = await upload(admin, recording, key, 1, "", original.id);
    assert.equal(retry.status, 200); assert.deepEqual(retry.json, first.json);
    assert.equal((await upload(admin, makeAudioFixture("webm", 0.4, 880), key, 1, "", original.id)).status, 409);
    assert.equal((await upload(admin, recording, key, 1, "Distinto", original.id)).status, 409);
    assert.equal((await upload(admin, recording, key)).status, 409);
    assert.equal((await admin.request("POST", "/api/messages", { body: {
      clientMessageId: key, body: AUDIO_MESSAGE_BODY, conversationVersion: 1, replyToMessageId: original.id,
    } })).status, 409);
    assert.equal(await server.db.message.count(), 2);
    const textReply = messageOf((await send(member, "Ya lo escuché", messageOf(first.json).id)).json);
    assert.equal(textReply.replyTo?.audioUrl, messageOf(first.json).audioUrl);
    assert.equal(textReply.replyTo?.audioDurationSeconds, messageOf(first.json).audioDurationSeconds);
    assert.equal(messageOf(first.json).replyTo?.body, "Pregunta");
  });

  it("rechaza anónimo, CSRF/Origin ajeno, metadata arbitraria y cualquier segundo adjunto", async () => {
    const anonymous = new TestClient(server.baseUrl); await anonymous.session();
    assert.equal((await upload(anonymous)).status, 401);
    assert.equal((await member.request("POST", "/api/messages/audio", { rawBody: form(recording), csrf: false })).status, 403);
    assert.equal((await member.request("POST", "/api/messages/audio", { rawBody: form(recording), origin: "https://evil.test" })).status, 403);
    const metadata = form(recording); metadata.append("durationSeconds", "1");
    assert.equal((await member.request("POST", "/api/messages/audio", { rawBody: metadata })).status, 400);
    const second = form(recording); second.append("video", new Blob([new Uint8Array(recording)], { type: "video/webm" }), "movie.webm");
    assert.equal((await member.request("POST", "/api/messages/audio", { rawBody: second })).status, 400);
    for (const invalid of [Buffer.from("invalid bytes"), makeVideoFixture(), Buffer.alloc(MAX_CHAT_AUDIO_BYTES + 1)]) {
      assert.equal((await upload(member, invalid)).status, 400);
    }
    assert.equal(await server.db.message.count(), 0);
  });

  it("borrado propio/admin elimina bytes y cita; journal, tombstones y vaciado impiden resurrección", async () => {
    const key = randomUUID();
    const voice = messageOf((await upload(member, recording, key)).json);
    const saved = await server.db.message.findUniqueOrThrow({ where: { id: voice.id } });
    assert.ok(saved.audioData); assert.ok(saved.audioHash);
    const response = messageOf((await send(admin, "Respuesta", voice.id)).json);
    const adminVoice = messageOf((await upload(admin)).json);
    assert.equal((await member.request("DELETE", `/api/messages/${adminVoice.id}`, { body: { conversationVersion: 1 } })).status, 403);
    assert.equal((await member.request("DELETE", "/api/conversation/messages", { body: { conversationVersion: 1 } })).status, 403);
    assert.equal((await member.request("DELETE", `/api/messages/${voice.id}`, { body: { conversationVersion: 1 } })).status, 200);
    assert.equal((await member.request("GET", voice.audioUrl!)).status, 404);
    const history = (await admin.request("GET", "/api/messages")).json as { messages: Message[] };
    assert.equal(history.messages.find(item => item.id === response.id)?.replyTo, undefined);
    assert.equal((await upload(member, recording, key, 2)).status, 410);
    await server.db.message.create({ data: saved });
    await reconcileDeletions(server.db, server.journalPath);
    assert.equal(await server.db.message.findUnique({ where: { id: voice.id } }), null);
    const version = (await server.db.conversation.findUniqueOrThrow({ where: { id: 1 } })).version;
    assert.equal((await admin.request("DELETE", "/api/conversation/messages", { body: { conversationVersion: version } })).status, 200);
    assert.equal(await server.db.message.count(), 0);
    assert.equal((await admin.request("GET", adminVoice.audioUrl!)).status, 404);
    assert.equal((await upload(member, recording, randomUUID(), version)).status, 409);
  });
});
