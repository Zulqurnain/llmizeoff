import * as path from "path";
import { Message, ChatOptions, CompletionOptions, ModelConfig } from "./types";
import { downloadModel, getModelPath, DEFAULT_MODEL } from "./downloader";

let llamaModule: typeof import("node-llama-cpp") | null = null;

async function getLlamaCpp() {
  if (!llamaModule) {
    llamaModule = await import("node-llama-cpp");
  }
  return llamaModule;
}

export class LlamaEngine {
  private config: ModelConfig;
  private model: unknown = null;
  private context: unknown = null;
  private modelPath: string | null = null;

  constructor(config: ModelConfig = {}) {
    this.config = {
      contextSize: config.contextSize ?? 2048,
      gpuLayers: config.gpuLayers ?? 0,
      modelPath: config.modelPath,
    };
  }

  async load(autoDownload = true): Promise<void> {
    const { getLlama, LlamaChatSession } = await getLlamaCpp();
    void LlamaChatSession;

    let modelPath = this.config.modelPath;
    if (!modelPath) {
      modelPath = getModelPath(DEFAULT_MODEL);
      const fs = await import("fs");
      if (!fs.existsSync(modelPath)) {
        if (!autoDownload) throw new Error(`Model not found: ${modelPath}. Run 'offl-llama download' first.`);
        console.log("Model not found. Auto-downloading...");
        await downloadModel(DEFAULT_MODEL);
      }
    }

    this.modelPath = modelPath;
    console.log(`Loading model: ${path.basename(modelPath)}`);

    const llama = await getLlama({
      gpu: false,
    });

    this.model = await (llama as { loadModel: (opts: unknown) => Promise<unknown> }).loadModel({
      modelPath,
      gpuLayers: this.config.gpuLayers ?? 0,
    });

    this.context = await (this.model as { createContext: (opts: unknown) => Promise<unknown> }).createContext({
      contextSize: this.config.contextSize ?? 2048,
    });

    console.log("Model loaded.");
  }

  async chat(messages: Message[], opts: ChatOptions = {}): Promise<string> {
    if (!this.model || !this.context) await this.load();

    const { LlamaChatSession } = await getLlamaCpp();

    const session = new LlamaChatSession({
      contextSequence: await (this.context as { getSequence: () => Promise<unknown> }).getSequence(),
    });

    const systemMsg = opts.systemPrompt ?? messages.find(m => m.role === "system")?.content;
    const userMsgs = messages.filter(m => m.role !== "system");

    if (systemMsg) {
      await (session as unknown as { setSystemPrompt: (p: string) => Promise<void> }).setSystemPrompt?.(systemMsg);
    }

    let response = "";
    for (const msg of userMsgs) {
      if (msg.role === "user") {
        response = await session.prompt(msg.content, {
          maxTokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.7,
        });
      }
    }
    return response;
  }

  async complete(prompt: string, opts: CompletionOptions = {}): Promise<string> {
    if (!this.model || !this.context) await this.load();

    const { LlamaCompletion } = await getLlamaCpp();

    const completion = new LlamaCompletion({
      contextSequence: await (this.context as { getSequence: () => Promise<unknown> }).getSequence(),
    });

    return completion.generateCompletion(prompt, {
      maxTokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.7,
    });
  }

  getModelName(): string {
    return this.modelPath ? path.basename(this.modelPath) : "not loaded";
  }

  async unload(): Promise<void> {
    if (this.context) {
      await (this.context as { dispose: () => Promise<void> }).dispose?.();
      this.context = null;
    }
    if (this.model) {
      await (this.model as { dispose: () => Promise<void> }).dispose?.();
      this.model = null;
    }
  }
}
