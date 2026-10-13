import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAssistantTestCommand } from "../../src/assistant-test-command.js";
import { assistantHistoryTurn, ASSISTANT_LABEL, ASSISTANT_TEST_LABEL } from "../../src/auto-reply.js";

test("recognizes --test with a single whole quoted prompt", () => {
  for (const input of ["--test 'Hola quién soy yo'", '--test "Hola quién soy yo"', "  --test   'Hola quién soy yo'  "]) {
    assert.deepEqual(parseAssistantTestCommand(input), { kind: "test", prompt: "Hola quién soy yo" });
  }
  assert.deepEqual(parseAssistantTestCommand("--test 'primera línea\nsegunda línea'"), {
    kind: "test", prompt: "primera línea\nsegunda línea",
  });
});

test("rejects missing, mismatched, empty, repeated or trailing arguments", () => {
  for (const input of ["--test", "--test hola", "--test ''", '--test "  "', "--test 'hola", '--test "hola\'',
    "--test 'hola' extra", "--test 'hola' 'otro prompt'", "--test ‘hola’"]) {
    assert.deepEqual(parseAssistantTestCommand(input), { kind: "invalid" }, input);
  }
});

test("preserves interior quotes and explicitly escaped delimiters without executing text", () => {
  assert.deepEqual(parseAssistantTestCommand('--test "me dijo \\"hola\\""'), { kind: "test", prompt: 'me dijo "hola"' });
  assert.deepEqual(parseAssistantTestCommand("--test 'me dijo \"hola\"'"), { kind: "test", prompt: 'me dijo "hola"' });
  assert.deepEqual(parseAssistantTestCommand("--test '$(echo hola); `echo hola`'"), { kind: "test", prompt: "$(echo hola); `echo hola`" });
});

test("ordinary text and similar flags are not commands", () => {
  for (const input of ["hola", "--testing 'hola'", "explica --test 'hola'", "--testigo", ""]) {
    assert.deepEqual(parseAssistantTestCommand(input), { kind: "none" });
  }
});

test("tests from either account become user prompts, with syntax removed", () => {
  for (const fromMember of [true, false]) {
    assert.deepEqual(assistantHistoryTurn("--test 'Hola quién soy yo'", fromMember), { role: "user", content: "Hola quién soy yo" });
  }
  assert.deepEqual(assistantHistoryTurn("hola", false), { role: "assistant", content: "hola" });
  assert.deepEqual(assistantHistoryTurn("hola", true), { role: "user", content: "hola" });
  for (const label of [ASSISTANT_LABEL, ASSISTANT_TEST_LABEL]) {
    assert.deepEqual(assistantHistoryTurn(label + "qué onda", false), { role: "assistant", content: "qué onda" });
  }
});
