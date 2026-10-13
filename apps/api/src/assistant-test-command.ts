export type AssistantTestCommand =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "test"; prompt: string };

/** Parse a whole chat message, never a shell command. */
export function parseAssistantTestCommand(body: string): AssistantTestCommand {
  const input = body.trim();
  if (!/^--test(?:\s|$)/u.test(input)) return { kind: "none" };
  const argument = input.slice(6).trim();
  const quote = argument[0];
  if (quote !== "'" && quote !== '"') return { kind: "invalid" };
  let prompt = "";
  for (let index = 1; index < argument.length; index++) {
    const char = argument[index]!;
    if (char === quote) {
      if (argument.slice(index + 1).trim() || !prompt.trim()) return { kind: "invalid" };
      return { kind: "test", prompt: prompt.trim() };
    }
    if (char === "\\" && (argument[index + 1] === quote || argument[index + 1] === "\\")) {
      prompt += argument[++index];
    } else {
      prompt += char;
    }
  }
  return { kind: "invalid" };
}

export const ASSISTANT_TEST_USAGE = "Usa --test 'tu prompt' o --test \"tu prompt\", con el prompt completo entre comillas.";
