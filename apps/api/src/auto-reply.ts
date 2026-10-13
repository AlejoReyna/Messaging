import { createHash } from "node:crypto";
import type { Message } from "@private-chat/contracts";
import { generateAssistantReply, type AssistantConfig, type AssistantTurn, type AssistantFetch } from "./assistant.js";
import { parseAssistantTestCommand } from "./assistant-test-command.js";

export const ASSISTANT_LABEL = "🤖 Alexis AI\n";
export const ASSISTANT_TEST_LABEL = "🧪 Alexis AI · prueba\n";

export function assistantHistoryTurn(body: string, fromMember: boolean): AssistantTurn {
  const command = parseAssistantTestCommand(body);
  if (command.kind === "test") return { role: "user", content: command.prompt };
  return { role: fromMember ? "user" : "assistant", content: body.startsWith(ASSISTANT_LABEL)
    ? body.slice(ASSISTANT_LABEL.length) : body.startsWith(ASSISTANT_TEST_LABEL)
      ? body.slice(ASSISTANT_TEST_LABEL.length) : body };
}

export function assistantMessageKey(triggerId: string): string {
  const hash = createHash("sha256").update(`private-chat:assistant:v1:${triggerId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export interface ReplySnapshot {
  triggerId: string;
  version: number;
  sequence: number;
  adminId: string;
  turns: AssistantTurn[];
  testing?: boolean;
}

export interface AutoReplyStore {
  snapshot(trigger: Message, version: number): Promise<ReplySnapshot | null>;
  commit(snapshot: ReplySnapshot, body: string): Promise<Message | null>;
}

/** One bounded generation at a time; a new message cancels the old turn. */
export class AutoReply {
  private pending: { message: Message; version: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private closed = false;

  constructor(
    private config: AssistantConfig,
    private store: AutoReplyStore,
    private onCreated: (message: Message) => void,
    private onFailure: () => void,
    private fetchFn: AssistantFetch = fetch,
    private debounceMs = 1500,
  ) {}

  notify(message: Message, version: number): void {
    if (this.closed || !this.config.enabled) return;
    this.pending = { message, version };
    this.controller?.abort();
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.running || !this.pending || this.closed) return;
      const { message, version } = this.pending;
      this.pending = null;
      this.controller = new AbortController();
      this.running = this.respond(message, version, this.controller.signal).finally(() => {
        this.running = null;
        this.controller = null;
        if (this.pending && !this.closed) this.schedule();
      });
    }, this.debounceMs);
    this.timer.unref();
  }

  private async respond(trigger: Message, version: number, signal: AbortSignal): Promise<void> {
    try {
      const snapshot = await this.store.snapshot(trigger, version);
      if (!snapshot || signal.aborted) return;
      const text = await generateAssistantReply(this.config, snapshot.turns, signal, this.fetchFn);
      if (signal.aborted) return;
      const message = await this.store.commit(snapshot, (snapshot.testing ? ASSISTANT_TEST_LABEL : ASSISTANT_LABEL) + text);
      if (message) this.onCreated(message);
    } catch {
      // Never log provider payloads, personal context or generated text.
      if (!signal.aborted) this.onFailure();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.controller?.abort();
    await this.running;
  }
}
