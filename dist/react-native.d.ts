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
    ask(userMessage: string, opts?: {
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    /**
     * Full chat with message history.
     */
    chat(messages: ClientMessage[], opts?: {
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    /**
     * Release native resources (local mode only).
     * Always call this when done to free memory.
     */
    release(): Promise<void>;
    /** "local" (llama.rn) | "remote" (HTTP) */
    readonly mode: "local" | "remote";
}
/**
 * Create a mobile engine. Automatically picks local (llama.rn) or remote (HTTP).
 *
 * - If `serverUrl` is provided → uses HTTP, no model download needed.
 * - If `modelUrl` is provided  → downloads model once, runs offline forever.
 */
export declare function createMobileEngine(config: MobileEngineConfig): Promise<MobileEngine>;
/**
 * Check if the model file already exists on device.
 * Use this to show a "download required" prompt before calling createMobileEngine.
 */
export declare function isModelDownloaded(config: Pick<MobileEngineConfig, "modelDir" | "modelFileName" | "modelUrl">): Promise<boolean>;
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
export declare const MOBILE_MODELS: {
    /**
     * ~75 MB — BUNDLABLE in app assets. Fits in < 100 MB total.
     * Best for simple extraction, classification, short generation.
     * 135M parameters, Q4_K_M quantization.
     */
    readonly SMOL_135M_NANO: {
        readonly url: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q4_k_m.gguf";
        readonly fileName: "smollm2-135m-q4.gguf";
        readonly sizeMb: 75;
        readonly bundlable: true;
    };
    /** ~290 MB — downloaded post-install. Best balance for mobile. */
    readonly QWEN_0_5B: {
        readonly url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";
        readonly fileName: "qwen2.5-0.5b-q4.gguf";
        readonly sizeMb: 290;
        readonly bundlable: false;
    };
    /** ~530 MB — downloaded post-install. Good quality. */
    readonly QWEN_1_5B: {
        readonly url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
        readonly fileName: "qwen2.5-1.5b-q4.gguf";
        readonly sizeMb: 530;
        readonly bundlable: false;
    };
};
//# sourceMappingURL=react-native.d.ts.map