import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAssistantConfig, generateAssistantReply, assistantSystemPrompt, type AssistantConfig, type AssistantFetch } from "../../src/assistant.js";

const config: AssistantConfig = { enabled: true, autoReplyEnabled: true, provider: "moonshot", apiKey: "synthetic-unit-test-key", privateContext: "Synthetic private preference for unit testing." };
const turns = [{ role: "user" as const, content: "hola" }];
const completion = (content: unknown, finish_reason = "stop") => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason }] }));

test("disabled assistant does not read secret files; invalid settings fail closed", () => {
  assert.equal(loadAssistantConfig({}).enabled, false);
  assert.equal(loadAssistantConfig({ ASSISTANT_ENABLED: "false", ASSISTANT_API_KEY_FILE: "/missing" }).apiKey, "");
  assert.throws(() => loadAssistantConfig({ ASSISTANT_ENABLED: "yes" }), /ASSISTANT_ENABLED/);
  assert.throws(() => loadAssistantConfig({ ASSISTANT_AUTO_REPLY_ENABLED: "yes" }), /ASSISTANT_AUTO_REPLY_ENABLED/);
  assert.throws(() => loadAssistantConfig({ ASSISTANT_PROVIDER: "other" }), /ASSISTANT_PROVIDER/);
  assert.throws(() => loadAssistantConfig({ ASSISTANT_ENABLED: "true" }), /ASSISTANT_API_KEY_FILE/);
});

test("enabled assistant loads server-owned files and never exposes their path or contents in errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "assistant-unit-"));
  try {
    const key = join(dir, "key"); const context = join(dir, "context");
    writeFileSync(key, config.apiKey); writeFileSync(context, config.privateContext);
    const env = { ASSISTANT_ENABLED: "true", ASSISTANT_API_KEY_FILE: key, ASSISTANT_CONTEXT_FILE: context };
    assert.deepEqual(loadAssistantConfig(env), config);
    assert.equal(loadAssistantConfig({ ...env, ASSISTANT_AUTO_REPLY_ENABLED: "false" }).autoReplyEnabled, false);
    writeFileSync(context, "x".repeat(32769));
    assert.throws(() => loadAssistantConfig(env), { message: "ASSISTANT_CONTEXT_FILE no disponible o no válido" });
  } finally { rmSync(dir, { recursive: true }); }
});

test("Moonshot protocol uses bounded history and tokens, server persona, disabled thinking and no redirects", async () => {
  const result = await generateAssistantReply(config, Array.from({ length: 30 }, () => ({ role: "user" as const, content: "x".repeat(5000) })), undefined,
    (async (url, init) => {
      assert.equal(url, "https://api.moonshot.ai/v1/chat/completions");
      assert.equal(init?.redirect, "error");
      assert.equal((init?.headers as Record<string, string>)["authorization"], `Bearer ${config.apiKey}`);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "kimi-k2.6"); assert.equal(body.max_tokens, 800);
      assert.deepEqual(body.thinking, { type: "disabled" });
      assert.equal(body.messages.length, 25); assert.equal(body.messages[1].content.length, 4000);
      assert.equal(body.messages[0].role, "system");
      assert.ok(body.messages[0].content.includes(config.privateContext));
      assert.equal(body.temperature, undefined);
      return completion(" hola, qué onda ");
    }) as AssistantFetch);
  assert.equal(result, "hola, qué onda");
  assert.ok(assistantSystemPrompt(config, new Date("2026-01-01")).includes("2026-01-01"));
});

test("OpenRouter uses the selected provider only", async () => {
  await generateAssistantReply({ ...config, provider: "openrouter" }, turns, undefined, (async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "moonshotai/kimi-k2.6");
    assert.deepEqual(body.reasoning, { enabled: false }); assert.equal(body.thinking, undefined);
    return completion("hola");
  }) as AssistantFetch);
});

test("provider failures never propagate private provider error bodies", async () => {
  await assert.rejects(generateAssistantReply(config, turns, undefined,
    (async () => new Response("private provider failure payload", { status: 401 })) as AssistantFetch),
    { message: "ASSISTANT_PROVIDER_FAILED" });
});

test("rejects empty, truncated, oversized or malformed replies and does not publish reasoning", async () => {
  for (const response of [completion(""), completion("partial", "length"), completion("x".repeat(3901)),
    completion(null), new Response("bad JSON"), new Response("x".repeat(65537)),
    new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { reasoning_content: "hidden" } }] }))]) {
    await assert.rejects(generateAssistantReply(config, turns, undefined, (async () => response) as AssistantFetch),
      { message: "ASSISTANT_INVALID_RESPONSE" });
  }
});

test("disabled configuration cannot invoke a provider", async () => {
  let invoked = false;
  await assert.rejects(generateAssistantReply({ ...config, enabled: false }, turns, undefined,
    (async () => { invoked = true; return completion("hola"); }) as AssistantFetch), /ASSISTANT_UNAVAILABLE/);
  assert.equal(invoked, false);
});
