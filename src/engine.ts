import * as path from "path";
import type {
  Llama,
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
} from "node-llama-cpp";
import { Message, ChatOptions, CompletionOptions, ModelConfig } from "./types";
import { downloadModel, getModelPath, DEFAULT_MODEL } from "./downloader";

type LlamaModule = typeof import("node-llama-cpp");

let cachedModule: LlamaModule | null = null;

async function getLlamaCpp(): Promise<LlamaModule> {
  if (cachedModule) return cachedModule;
  cachedModule = await import("node-llama-cpp") as LlamaModule;
  return cachedModule;
}

export class LlamaEngine {
  private config: ModelConfig;
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private ctx: LlamaContext | null = null;
  private session: LlamaChatSession | null = null;
  private resolvedModelPath: string | null = null;

  constructor(config: ModelConfig = {}) {
    this.config = {
      contextSize: config.contextSize ?? 2048,
      gpuLayers: config.gpuLayers ?? 0,
      modelPath: config.modelPath,
    };
  }

  async load(autoDownload = true): Promise<void> {
    const { getLlama } = await getLlamaCpp();

    let modelPath = this.config.modelPath;
    if (!modelPath) {
      modelPath = getModelPath(DEFAULT_MODEL);
      const fs = await import("fs");
      if (!fs.existsSync(modelPath)) {
        if (!autoDownload) {
          throw new Error(`Model not found at ${modelPath}. Run: npx offllama download`);
        }
        console.log("Model not found locally. Auto-downloading (this happens once)...");
        await downloadModel(DEFAULT_MODEL);
      }
    }

    this.resolvedModelPath = modelPath;
    console.log(`Loading model: ${path.basename(modelPath)}`);

    this.llama = await getLlama({ gpu: false });
    this.model = await this.llama.loadModel({ modelPath });
    this.ctx = await this.model.createContext({ contextSize: this.config.contextSize ?? 2048 });

    const { LlamaChatSession } = await getLlamaCpp();
    this.session = new LlamaChatSession({ contextSequence: this.ctx.getSequence() });

    console.log("Model loaded and ready.");
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.session) await this.load(true);
  }

  async chat(messages: Message[], opts: ChatOptions = {}): Promise<string> {
    await this.ensureLoaded();

    // Re-create session for each chat to avoid accumulated context blowing up memory
    const { LlamaChatSession } = await getLlamaCpp();
    const session = new LlamaChatSession({ contextSequence: this.ctx!.getSequence() });

    const system = opts.systemPrompt ?? messages.find(m => m.role === "system")?.content;
    const turns = messages.filter(m => m.role === "user" || m.role === "assistant");

    if (system) {
      // Seed the session with a system message via a priming exchange
      await session.prompt(
        `[system]: ${system}\n[user]: OK\n`,
        { maxTokens: 5, temperature: 0 }
      );
    }

    let response = "";
    for (const msg of turns) {
      if (msg.role === "user") {
        response = await session.prompt(msg.content, {
          maxTokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.7,
        });
      }
    }

    await session.dispose();
    return response;
  }

  async complete(prompt: string, opts: CompletionOptions = {}): Promise<string> {
    await this.ensureLoaded();

    const { LlamaCompletion } = await getLlamaCpp();
    const completion = new LlamaCompletion({ contextSequence: this.ctx!.getSequence() });
    const result = await completion.generateCompletion(prompt, {
      maxTokens: opts.maxTokens ?? 256,
      temperature: opts.temperature ?? 0.7,
      customStopTriggers: opts.stopSequences,
    });
    await completion.dispose();
    return result;
  }

  getModelName(): string {
    return this.resolvedModelPath ? path.basename(this.resolvedModelPath) : "not loaded";
  }

  async unload(): Promise<void> {
    if (this.session) { await this.session.dispose(); this.session = null; }
    if (this.ctx)     { await this.ctx.dispose(); this.ctx = null; }
    if (this.model)   { await this.model.dispose(); this.model = null; }
    if (this.llama)   { await this.llama.dispose(); this.llama = null; }
  }
}
