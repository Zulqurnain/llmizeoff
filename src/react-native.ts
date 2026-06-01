/**
 * llmizeOFF React Native adapter — offline AI on Android & iOS.
 *
 * Wraps `llama.rn` for on-device inference (no server needed).
 * Falls back to LlmizeOffClient (HTTP) when a server URL is configured.
 *
 * App bundle stays < 100 MB because the model is downloaded at runtime
 * to the device's documents/cache directory — NOT bundled with the app.
 *
 * SETUP
 * -----
 * 1. Install peer dependency:  npm install llama.rn
 * 2. iOS:  cd ios && pod install
 * 3. Android: auto-linked (React Native ≥ 0.71)
 *
 * USAGE
 * -----
 * import { createMobileEngine } from 'llmizeoff/react-native';
 *
 * // Offline (on-device) — downloads ~300 MB on first use
 * const engine = await createMobileEngine({
 *   modelUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
 *   modelFileName: 'qwen2.5-0.5b-q4.gguf',
 *   onDownloadProgress: (pct) => console.log(`Downloading ${pct}%`),
 * });
 *
 * const reply = await engine.ask('What is 2 + 2?');
 * await engine.release();
 *
 * // Online (server) — zero model download on device
 * const engine = await createMobileEngine({
 *   serverUrl: 'https://tools.example.com/ai',
 *   apiKey: 'optional-key',
 * });
 */

import { LlmizeOffClient } from "./client";
import type { ClientMessage } from "./client";

export interface MobileEngineConfig {
  /**
   * Remote llmizeOFF server URL. When set, uses HTTP (no local model needed).
   * Example: "https://tools.example.com/ai"
   */
  serverUrl?: string;

  /** API key for the remote server (optional). */
  apiKey?: string;

  /**
   * GGUF model download URL (HuggingFace, etc).
   * Required when NOT using serverUrl (offline mode).
   */
  modelUrl?: string;

  /**
   * File name to save the model as on device storage.
   * Default: last segment of modelUrl.
   */
  modelFileName?: string;

  /**
   * Custom directory to store the model.
   * Defaults to the app's documents directory via react-native-fs.
   */
  modelDir?: string;

  /**
   * Called during model download (0–100).
   */
  onDownloadProgress?: (percent: number) => void;

  /** Context size (tokens). Default: 2048. */
  contextSize?: number;
}

export interface MobileEngine {
  /**
   * Send a message and get a reply.
   * Equivalent to LlmizeOffClient.ask().
   */
  ask(
    userMessage: string,
    opts?: { systemPrompt?: string; maxTokens?: number; temperature?: number }
  ): Promise<string>;

  /**
   * Full chat with message history.
   */
  chat(messages: ClientMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string>;

  /**
   * Release native resources (local mode only).
   * Always call this when done to free memory.
   */
  release(): Promise<void>;

  /** "local" (llama.rn) | "remote" (HTTP) */
  readonly mode: "local" | "remote";
}

// ─── Remote engine (HTTP) ────────────────────────────────────────────────────

class RemoteMobileEngine implements MobileEngine {
  readonly mode = "remote" as const;
  private client: LlmizeOffClient;

  constructor(config: MobileEngineConfig) {
    this.client = new LlmizeOffClient({
      baseUrl: config.serverUrl!,
      apiKey: config.apiKey,
    });
  }

  async ask(userMessage: string, opts: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}) {
    return this.client.ask(userMessage, opts);
  }

  async chat(messages: ClientMessage[], opts: { maxTokens?: number; temperature?: number } = {}) {
    const resp = await this.client.chat(messages, {
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    });
    return resp.choices[0]?.message?.content ?? "";
  }

  async release() {
    // no-op for HTTP mode
  }
}

// ─── Local engine (llama.rn) ─────────────────────────────────────────────────

class LocalMobileEngine implements MobileEngine {
  readonly mode = "local" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ctx: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(ctx: any) {
    this.ctx = ctx;
  }

  async ask(userMessage: string, opts: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}) {
    const messages: ClientMessage[] = [];
    if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
    messages.push({ role: "user", content: userMessage });
    return this.chat(messages, opts);
  }

  async chat(messages: ClientMessage[], opts: { maxTokens?: number; temperature?: number } = {}) {
    // llama.rn completion API
    const result = await this.ctx.completion({
      messages,
      n_predict: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.7,
      stop: ["</s>", "<|end|>", "<|im_end|>"],
    });
    return (result.text as string).trim();
  }

  async release() {
    await this.ctx.release();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a mobile engine. Automatically picks local (llama.rn) or remote (HTTP).
 *
 * - If `serverUrl` is provided → uses HTTP, no model download needed.
 * - If `modelUrl` is provided  → downloads model once, runs offline forever.
 */
export async function createMobileEngine(config: MobileEngineConfig): Promise<MobileEngine> {
  if (config.serverUrl) {
    return new RemoteMobileEngine(config);
  }

  if (!config.modelUrl) {
    throw new Error(
      "llmizeOFF: provide either serverUrl (HTTP mode) or modelUrl (offline mode)"
    );
  }

  // Try to load llama.rn dynamically so this file doesn't crash in non-RN envs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let llamaRn: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    llamaRn = await (eval('import("llama.rn")') as Promise<any>);
  } catch {
    throw new Error(
      "llmizeOFF: offline mode requires 'llama.rn'. Run: npm install llama.rn\n" +
      "iOS: cd ios && pod install\n" +
      "Or switch to HTTP mode by providing serverUrl instead."
    );
  }

  const modelPath = await ensureModel(config, llamaRn);

  const ctx = await llamaRn.initLlama({
    model: modelPath,
    n_ctx: config.contextSize ?? 2048,
    n_threads: 4,
    use_mlock: false,
  });

  return new LocalMobileEngine(ctx);
}

// ─── Model download helper ────────────────────────────────────────────────────

async function ensureModel(
  config: MobileEngineConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _llamaRn: any
): Promise<string> {
  const fileName =
    config.modelFileName ??
    (config.modelUrl!.split("/").pop()?.split("?")[0] ?? "model.gguf");

  // Resolve storage dir via react-native-fs (optional peer dep) or fall back
  let dir = config.modelDir;
  if (!dir) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RNFS = await (eval('import("react-native-fs")') as Promise<any>);
      dir = RNFS.DocumentDirectoryPath;
    } catch {
      throw new Error(
        "llmizeOFF: install react-native-fs to auto-resolve model dir, " +
        "or pass modelDir explicitly."
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RNFS = await (eval('import("react-native-fs")') as Promise<any>);
  const modelPath = `${dir}/${fileName}`;
  const exists = await RNFS.exists(modelPath);

  if (!exists) {
    await RNFS.downloadFile({
      fromUrl: config.modelUrl!,
      toFile: modelPath,
      progress: (res: { contentLength: number; bytesWritten: number }) => {
        if (config.onDownloadProgress && res.contentLength > 0) {
          const pct = Math.round((res.bytesWritten / res.contentLength) * 100);
          config.onDownloadProgress(pct);
        }
      },
    }).promise;
  }

  return modelPath;
}

/**
 * Check if the model file already exists on device.
 * Use this to show a "download required" prompt before calling createMobileEngine.
 */
export async function isModelDownloaded(config: Pick<MobileEngineConfig, "modelDir" | "modelFileName" | "modelUrl">): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RNFS = await (eval('import("react-native-fs")') as Promise<any>);
    const fileName =
      config.modelFileName ??
      (config.modelUrl?.split("/").pop()?.split("?")[0] ?? "model.gguf");
    const dir = config.modelDir ?? RNFS.DocumentDirectoryPath;
    return RNFS.exists(`${dir}/${fileName}`);
  } catch {
    return false;
  }
}

/**
 * Recommended models for mobile.
 *
 * BUNDLABLE models (< 80 MB) can be shipped INSIDE your app so users never
 * download anything. Add the .gguf file to android/app/src/main/assets/ and
 * ios/<AppName>/ then pass `modelDir` pointing to the assets path.
 *
 * Total app size = RN framework (~20 MB) + model. SMOL_135M_NANO fits
 * comfortably under 100 MB.
 */
export const MOBILE_MODELS = {
  /**
   * ~75 MB — BUNDLABLE in app assets. Fits in < 100 MB total.
   * Best for simple extraction, classification, short generation.
   * 135M parameters, Q4_K_M quantization.
   */
  SMOL_135M_NANO: {
    url: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q4_k_m.gguf",
    fileName: "smollm2-135m-q4.gguf",
    sizeMb: 75,
    bundlable: true,
  },
  /** ~290 MB — downloaded post-install. Best balance for mobile. */
  QWEN_0_5B: {
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    fileName: "qwen2.5-0.5b-q4.gguf",
    sizeMb: 290,
    bundlable: false,
  },
  /** ~530 MB — downloaded post-install. Good quality. */
  QWEN_1_5B: {
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    fileName: "qwen2.5-1.5b-q4.gguf",
    sizeMb: 530,
    bundlable: false,
  },
} as const;
