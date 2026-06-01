import * as path from "path";
import type {
  Llama,
  LlamaModel,
  LlamaContext,
  LlamaContextSequence,
  LlamaChatSession,
} from "node-llama-cpp";
import { Message, ChatOptions, CompletionOptions, ModelConfig } from "./types";
import { downloadModel, getModelPath, DEFAULT_MODEL } from "./downloader";

type LlamaModule = typeof import("node-llama-cpp");

let cachedModule: LlamaModule | null = null;

async function getLlamaCpp(): Promise<LlamaModule> {
  if (cachedModule) return cachedModule;
  cachedModule = (await import("node-llama-cpp")) as LlamaModule;
  return cachedModule;
}

/**
 * LlamaEngine — the core llmizeOFF inference engine.
 *
 * Design notes (hard-won on real CPU-only VPS hosting):
 *  - ONE context + ONE sequence + ONE persistent LlamaChatSession, created at
 *    load() and reused for every request. Re-creating a context per request
 *    costs 10-20s on CPU; recreating sequences leaks slots ("No sequences left").
 *  - Requests are serialised through an internal queue so the single KV-cache
 *    is never written concurrently.
 *  - Streaming is first-class via the onToken callback — the first token reaches
 *    the caller as soon as it is generated, instead of after the full response.
 */
export class LlamaEngine {
  private config: ModelConfig;
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private ctx: LlamaContext | null = null;
  private seq: LlamaContextSequence | null = null;
  private session: LlamaChatSession | null = null;
  private resolvedModelPath: string | null = null;

  // Serialise inference — one request at a time
  private queue: Promise<unknown> = Promise.resolve();

  constructor(config: ModelConfig = {}) {
    this.config = {
      contextSize: config.contextSize ?? 2048,
      gpuLayers: config.gpuLayers ?? 0,
      modelPath: config.modelPath,
    };
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn);
    this.queue = task.catch(() => {});
    return task;
  }

  async load(autoDownload = true): Promise<void> {
    const { getLlama, LlamaChatSession } = await getLlamaCpp();

    let modelPath = this.config.modelPath;
    if (!modelPath) {
      modelPath = getModelPath(DEFAULT_MODEL);
      const fs = await import("fs");
      if (!fs.existsSync(modelPath)) {
        if (!autoDownload) {
          throw new Error(`Model not found at ${modelPath}. Run: npx llmizeoff download`);
        }
        console.log("Model not found locally. Auto-downloading (this happens once)...");
        await downloadModel(DEFAULT_MODEL);
      }
    }

    this.resolvedModelPath = modelPath;
    console.log(`Loading model: ${path.basename(modelPath)}`);

    this.llama = await getLlama({ gpu: this.config.gpuLayers ? "auto" : false });
    this.model = await this.llama.loadModel({ modelPath });
    this.ctx = await this.model.createContext({ contextSize: this.config.contextSize ?? 2048 });
    this.seq = this.ctx.getSequence();
    this.session = new LlamaChatSession({ contextSequence: this.seq });

    console.log("Model loaded and ready.");
  }

  /** Pre-warm the session so the first real request doesn't pay cold-start cost. */
  async warmup(): Promise<void> {
    await this.ensureLoaded();
    await this.enqueue(() =>
      this.session!.prompt("Hi", { maxTokens: 4, temperature: 0 })
    );
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.session) await this.load(true);
  }

  /**
   * Compose the final prompt fed to the session.
   * The system message (live context + instructions) is prepended to the last
   * user turn so the model has it without polluting the chat template.
   */
  private composePrompt(messages: Message[]): string {
    const system = messages.find((m) => m.role === "system")?.content;
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return system
      ? `[Context for this reply only]\n${system}\n\n---\n\n${lastUser}`
      : lastUser;
  }

  /** Non-streaming chat. Returns the full reply. */
  async chat(messages: Message[], opts: ChatOptions = {}): Promise<string> {
    await this.ensureLoaded();
    const prompt = this.composePrompt(
      opts.systemPrompt
        ? [{ role: "system", content: opts.systemPrompt }, ...messages]
        : messages
    );
    return this.enqueue(() =>
      this.session!.prompt(prompt, {
        maxTokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.7,
        topP: opts.topP ?? 0.9,
        repeatPenalty: { penalty: opts.repeatPenalty ?? 1.1, frequencyPenalty: 0.05, presencePenalty: 0.05 },
        ...(opts.onToken
          ? { onTextChunk: (chunk: string) => opts.onToken!(chunk) }
          : {}),
      })
    );
  }

  /**
   * Streaming chat. Each text chunk is delivered through onToken as it is
   * generated; the resolved promise contains the full concatenated reply.
   */
  async chatStream(
    messages: Message[],
    onToken: (text: string) => void,
    opts: Omit<ChatOptions, "onToken"> = {}
  ): Promise<string> {
    return this.chat(messages, { ...opts, onToken });
  }

  async complete(prompt: string, opts: CompletionOptions = {}): Promise<string> {
    await this.ensureLoaded();
    const { LlamaCompletion } = await getLlamaCpp();
    return this.enqueue(async () => {
      const completion = new LlamaCompletion({ contextSequence: this.ctx!.getSequence() });
      const result = await completion.generateCompletion(prompt, {
        maxTokens: opts.maxTokens ?? 256,
        temperature: opts.temperature ?? 0.7,
        customStopTriggers: opts.stopSequences,
      });
      await completion.dispose();
      return result;
    });
  }

  getModelName(): string {
    return this.resolvedModelPath ? path.basename(this.resolvedModelPath) : "not loaded";
  }

  isReady(): boolean {
    return this.session !== null;
  }

  async unload(): Promise<void> {
    if (this.session) { this.session = null; }
    if (this.seq) { this.seq = null; }
    if (this.ctx) { await this.ctx.dispose(); this.ctx = null; }
    if (this.model) { await this.model.dispose(); this.model = null; }
    if (this.llama) { await this.llama.dispose(); this.llama = null; }
  }
}
