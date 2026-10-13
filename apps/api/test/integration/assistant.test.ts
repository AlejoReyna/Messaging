import { beforeEach, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { MessageSchema, type Message } from "@private-chat/contracts";
import { ASSISTANT_LABEL, ASSISTANT_TEST_LABEL } from "../../src/auto-reply.js";
import type { AssistantFetch } from "../../src/assistant.js";
import { startTestServer, TestClient, type TestServer } from "./helpers.js";

describe("Alexis AI: real PostgreSQL, authenticated permissions and message consistency", () => {
  let server: TestServer; let admin: TestClient; let member: TestClient;
  let calls: number; let providerStarted: Promise<void>; let signalStart: () => void;
  let releaseProvider: (() => void) | null; let deferProvider: boolean;
  let lastProviderMessages: { role: string; content: string }[];
  beforeEach(async () => {
    calls = 0; releaseProvider = null; deferProvider = false;
    lastProviderMessages = [];
    providerStarted = new Promise(resolve => { signalStart = resolve; });
    server = await startTestServer({ assistant: { enabled: true, provider: "moonshot",
      apiKey: "synthetic-integration-key", privateContext: "Synthetic integration context" },
    assistantFetchFn: (async (_url, init) => {
      lastProviderMessages = JSON.parse(String(init?.body)).messages;
      calls++; signalStart();
      if (deferProvider) await new Promise<void>(resolve => { releaseProvider = resolve; });
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "hola, qué onda" } }] }));
    }) as AssistantFetch });
    admin = new TestClient(server.baseUrl); member = new TestClient(server.baseUrl);
    for (const [client, username, password] of [[admin, "admin", server.users.adminPassword],
      [member, "member", server.users.memberPassword]] as const) {
      assert.equal((await client.login(username, password)).status, 200);
      const changed = await client.request("POST", "/api/auth/change-password", {
        body: { currentPassword: password, newPassword: `Updated-${username}-password-2026` },
      });
      assert.equal(changed.status, 200); client.csrf = (changed.json as { csrfToken: string }).csrfToken;
    }
  });
  afterEach(async () => { releaseProvider?.(); await server.close(); });

  async function send(client: TestClient, body: string, clientMessageId = randomUUID()) {
    return client.request("POST", "/api/messages", { body: { body, clientMessageId, conversationVersion: 1 } });
  }
  async function until(check: () => Promise<boolean>): Promise<void> {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) { if (await check()) return; await delay(30); }
    assert.fail("Timed out waiting for assistant state");
  }
  async function startDeferred() {
    deferProvider = true;
    const sent = await send(member, "hola"); assert.equal(sent.status, 201);
    await Promise.race([providerStarted, delay(6000).then(() => assert.fail("provider did not start"))]);
    return MessageSchema.parse((sent.json as { message: unknown }).message);
  }

  it("persists one labelled answer for both accounts, without fabricating read receipts; delete permissions remain real", async () => {
    const key = randomUUID();
    assert.equal((await send(member, "hola", key)).status, 201);
    await until(async () => await server.db.message.count() === 2);
    const replies = await server.db.message.findMany({ orderBy: { sequence: "asc" } });
    assert.equal(replies[1]?.senderId, server.users.adminId);
    assert.equal(replies[1]?.body, ASSISTANT_LABEL + "hola, qué onda");
    assert.equal(replies[1]?.replyToMessageId, replies[0]?.id);
    for (const client of [admin, member]) {
      const result = await client.request("GET", "/api/messages"); assert.equal(result.status, 200);
      const messages = (result.json as { messages: Message[] }).messages;
      assert.equal(messages.length, 2); assert.equal(MessageSchema.parse(messages[1]).body, replies[1]?.body);
    }
    assert.equal((await server.db.readReceipt.findUnique({ where: { userId: server.users.adminId } }))?.lastReadSequence, 0);
    assert.equal((await send(member, "hola", key)).status, 200);
    await delay(1700); assert.equal(calls, 1); assert.equal(await server.db.message.count(), 2);
    const target = `/api/messages/${replies[1]!.id}`;
    assert.equal((await member.request("DELETE", target, { body: { conversationVersion: 1 } })).status, 403);
    assert.equal((await admin.request("DELETE", target, { body: { conversationVersion: 1 } })).status, 200);
    assert.equal(await server.db.message.count(), 1);
    assert.ok(await server.db.messageTombstone.findUnique({ where: { messageId: replies[1]!.id } }));
  });

  it("rejects anonymous input and does not respond to the administrator", async () => {
    const anonymous = new TestClient(server.baseUrl);
    const session = await anonymous.request("GET", "/api/auth/session");
    anonymous.csrf = (session.json as { csrfToken: string }).csrfToken;
    assert.equal((await send(anonymous, "unauthorized")).status, 401);
    assert.equal((await send(admin, "manual admin message")).status, 201);
    await delay(1800); assert.equal(calls, 0); assert.equal(await server.db.message.count(), 1);
  });

  it("a manual reply while Kimi is generating suppresses its stale answer", async () => {
    await startDeferred(); assert.equal((await send(admin, "manual reply")).status, 201);
    releaseProvider?.(); await delay(1800);
    assert.equal(await server.db.message.count(), 2); assert.equal(calls, 1);
  });

  it("clearing during generation cannot resurrect the conversation", async () => {
    await startDeferred();
    assert.equal((await member.request("DELETE", "/api/conversation/messages", { body: { conversationVersion: 1 } })).status, 200);
    releaseProvider?.(); await delay(150);
    assert.equal(await server.db.message.count(), 0);
    assert.equal((await server.db.conversation.findUnique({ where: { id: 1 } }))?.version, 2);
  });

  it("editing the source while Kimi is generating invalidates its snapshot", async () => {
    const source = await startDeferred();
    assert.equal((await member.request("PATCH", `/api/messages/${source.id}`, {
      body: { body: "edited input", conversationVersion: 1 },
    })).status, 200);
    releaseProvider?.(); await delay(150);
    assert.equal(await server.db.message.count(), 1);
    assert.equal((await server.db.message.findUnique({ where: { id: source.id } }))?.body, "edited input");
  });

  it("admin can test a quoted user prompt while ordinary auto replies are disabled", async () => {
    server.config.assistant!.autoReplyEnabled = false;
    assert.equal((await send(member, "ordinary message")).status, 201);
    await delay(1800); assert.equal(calls, 0);
    const command = "--test 'Hola quién soy yo'";
    assert.equal((await send(admin, command)).status, 201);
    await until(async () => await server.db.message.count() === 3);
    assert.deepEqual(lastProviderMessages.at(-1), { role: "user", content: "Hola quién soy yo" });
    const rows = await server.db.message.findMany({ orderBy: { sequence: "asc" } });
    assert.equal(rows[1]?.body, command);
    assert.equal(rows[2]?.body, ASSISTANT_TEST_LABEL + "hola, qué onda");
    assert.equal(rows[2]?.replyToMessageId, rows[1]?.id);
    assert.equal(server.config.assistant!.autoReplyEnabled, false);
  });

  it("member can also submit a double-quoted test prompt", async () => {
    assert.equal((await send(member, '--test "hola"')).status, 201);
    await until(async () => await server.db.message.count() === 2);
    assert.deepEqual(lastProviderMessages.at(-1), { role: "user", content: "hola" });
    assert.equal((await server.db.message.findFirst({ orderBy: { sequence: "desc" } }))?.body,
      ASSISTANT_TEST_LABEL + "hola, qué onda");
  });

  it("invalid or unavailable tests do not persist messages or invoke the provider", async () => {
    for (const command of ["--test hola", "--test ''", "--test 'hola", "--test 'hola' extra"]) {
      const sent = await send(admin, command); assert.equal(sent.status, 400);
      assert.match((sent.json as { error: { message: string } }).error.message, /entre comillas/);
    }
    server.config.assistant!.enabled = false;
    assert.equal((await send(admin, "--test 'hola'")).status, 503);
    assert.equal(await server.db.message.count(), 0); assert.equal(calls, 0);
  });
});
