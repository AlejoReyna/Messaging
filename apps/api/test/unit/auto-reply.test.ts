import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import type { Message } from "@private-chat/contracts";
import { AutoReply, ASSISTANT_LABEL, ASSISTANT_TEST_LABEL, assistantMessageKey, type AutoReplyStore, type ReplySnapshot } from "../../src/auto-reply.js";
import type { AssistantConfig, AssistantFetch } from "../../src/assistant.js";

const config: AssistantConfig = { enabled: true, provider: "moonshot", apiKey: "unit-test-key", privateContext: "Synthetic context" };
const message = (sequence = 1): Message => ({ id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  clientMessageId: "00000000-0000-4000-8000-000000000100", senderId: "00000000-0000-4000-8000-000000000200",
  sequence, body: "hola", createdAt: "2026-01-01T00:00:00.000Z" });
const snapshot = (trigger: Message, version: number): ReplySnapshot => ({ triggerId: trigger.id, version,
  sequence: trigger.sequence, adminId: "00000000-0000-4000-8000-000000000300", turns: [{ role: "user", content: trigger.body }] });
const response = () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "qué onda" } }] }));

test("groups a burst, creates one labelled reply and uses the newest trigger version", async () => {
  let calls = 0; const created: Message[] = [];
  const store: AutoReplyStore = { snapshot: async (trigger, version) => {
    assert.equal(trigger.sequence, 2); assert.equal(version, 7); return snapshot(trigger, version);
  }, commit: async (state, body) => {
    assert.equal(state.triggerId, message(2).id); assert.equal(body, ASSISTANT_LABEL + "qué onda");
    return { ...message(3), body };
  } };
  const worker = new AutoReply(config, store, value => created.push(value), () => assert.fail("unexpected failure"),
    (async () => { calls++; return response(); }) as AssistantFetch, 5);
  try {
    worker.notify(message(1), 6); worker.notify(message(2), 7);
    await delay(30); assert.equal(calls, 1); assert.equal(created.length, 1);
  } finally { await worker.close(); }
});

test("an ineligible or already handled trigger never invokes Kimi", async () => {
  const worker = new AutoReply(config, { snapshot: async () => null, commit: async () => assert.fail("commit") },
    () => assert.fail("created"), () => assert.fail("failure"), (async () => assert.fail("provider")) as AssistantFetch, 1);
  try { worker.notify(message(), 1); await delay(20); } finally { await worker.close(); }
});

test("a test snapshot produces a visibly labelled test answer", async () => {
  let published = false;
  const worker = new AutoReply(config, {
    snapshot: async (trigger, version) => ({ ...snapshot(trigger, version), testing: true }),
    commit: async (_state, body) => {
      assert.equal(body, ASSISTANT_TEST_LABEL + "qué onda"); return { ...message(2), body };
    },
  }, () => { published = true; }, () => assert.fail("failure"), (async () => response()) as AssistantFetch, 1);
  try { worker.notify(message(), 1); await delay(20); assert.equal(published, true); }
  finally { await worker.close(); }
});

test("a new manual message cancels in-flight generation before it can commit", async () => {
  let calls = 0; let cancelled = false;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const worker = new AutoReply(config, {
    snapshot: async (trigger, version) => trigger.sequence === 1 ? snapshot(trigger, version) : null,
    commit: async () => assert.fail("cancelled response cannot commit"),
  }, () => assert.fail("created"), () => assert.fail("cancelled request should be silent"),
  (async (_url, init) => {
    calls++; started();
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => { cancelled = true; reject(new Error("aborted")); }, { once: true });
    });
  }) as AssistantFetch, 1);
  try {
    worker.notify(message(1), 1); await ready;
    worker.notify(message(2), 1); await delay(20);
    assert.equal(cancelled, true); assert.equal(calls, 1);
  } finally { await worker.close(); }
});

test("a store invalidated by deletion or clear does not publish a late response", async () => {
  let commits = 0;
  const worker = new AutoReply(config, { snapshot: async (trigger, version) => snapshot(trigger, version),
    commit: async () => { commits++; return null; } }, () => assert.fail("stale reply published"),
    () => assert.fail("failure"), (async () => response()) as AssistantFetch, 1);
  try { worker.notify(message(), 1); await delay(20); assert.equal(commits, 1); } finally { await worker.close(); }
});

test("provider failure is reported once, without retries or fabricated messages", async () => {
  let calls = 0; let failures = 0;
  const worker = new AutoReply(config, { snapshot: async (trigger, version) => snapshot(trigger, version),
    commit: async () => assert.fail("commit") }, () => assert.fail("created"), () => { failures++; },
    (async () => { calls++; return new Response("provider private error", { status: 429 }); }) as AssistantFetch, 1);
  try { worker.notify(message(), 1); await delay(30); assert.equal(calls, 1); assert.equal(failures, 1); }
  finally { await worker.close(); }
});

test("close cancels pending work and ignores later messages", async () => {
  const worker = new AutoReply(config, { snapshot: async () => assert.fail("snapshot"), commit: async () => assert.fail("commit") },
    () => assert.fail("created"), () => assert.fail("failure"), (async () => assert.fail("provider")) as AssistantFetch, 10);
  worker.notify(message(), 1); await worker.close(); worker.notify(message(2), 1); await delay(20);
});

test("reply idempotency keys are valid deterministic UUIDs, different for different triggers", () => {
  assert.equal(assistantMessageKey(message().id), assistantMessageKey(message().id));
  assert.notEqual(assistantMessageKey(message().id), assistantMessageKey(message(2).id));
  assert.match(assistantMessageKey(message().id), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});
