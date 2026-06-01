"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOBILE_MODELS = void 0;
exports.createMobileEngine = createMobileEngine;
exports.isModelDownloaded = isModelDownloaded;
const client_1 = require("./client");
// ─── Remote engine (HTTP) ────────────────────────────────────────────────────
class RemoteMobileEngine {
    constructor(config) {
        this.mode = "remote";
        this.client = new client_1.LlmizeOffClient({
            baseUrl: config.serverUrl,
            apiKey: config.apiKey,
        });
    }
    async ask(userMessage, opts = {}) {
        return this.client.ask(userMessage, opts);
    }
    async chat(messages, opts = {}) {
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
class LocalMobileEngine {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(ctx) {
        this.mode = "local";
        this.ctx = ctx;
    }
    async ask(userMessage, opts = {}) {
        const messages = [];
        if (opts.systemPrompt)
            messages.push({ role: "system", content: opts.systemPrompt });
        messages.push({ role: "user", content: userMessage });
        return this.chat(messages, opts);
    }
    async chat(messages, opts = {}) {
        // llama.rn completion API
        const result = await this.ctx.completion({
            messages,
            n_predict: opts.maxTokens ?? 512,
            temperature: opts.temperature ?? 0.7,
            stop: ["</s>", "<|end|>", "<|im_end|>"],
        });
        return result.text.trim();
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
async function createMobileEngine(config) {
    if (config.serverUrl) {
        return new RemoteMobileEngine(config);
    }
    if (!config.modelUrl) {
        throw new Error("llmizeOFF: provide either serverUrl (HTTP mode) or modelUrl (offline mode)");
    }
    // Try to load llama.rn dynamically so this file doesn't crash in non-RN envs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let llamaRn;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        llamaRn = await eval('import("llama.rn")');
    }
    catch {
        throw new Error("llmizeOFF: offline mode requires 'llama.rn'. Run: npm install llama.rn\n" +
            "iOS: cd ios && pod install\n" +
            "Or switch to HTTP mode by providing serverUrl instead.");
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
async function ensureModel(config, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_llamaRn) {
    const fileName = config.modelFileName ??
        (config.modelUrl.split("/").pop()?.split("?")[0] ?? "model.gguf");
    // Resolve storage dir via react-native-fs (optional peer dep) or fall back
    let dir = config.modelDir;
    if (!dir) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const RNFS = await eval('import("react-native-fs")');
            dir = RNFS.DocumentDirectoryPath;
        }
        catch {
            throw new Error("llmizeOFF: install react-native-fs to auto-resolve model dir, " +
                "or pass modelDir explicitly.");
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RNFS = await eval('import("react-native-fs")');
    const modelPath = `${dir}/${fileName}`;
    const exists = await RNFS.exists(modelPath);
    if (!exists) {
        await RNFS.downloadFile({
            fromUrl: config.modelUrl,
            toFile: modelPath,
            progress: (res) => {
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
async function isModelDownloaded(config) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RNFS = await eval('import("react-native-fs")');
        const fileName = config.modelFileName ??
            (config.modelUrl?.split("/").pop()?.split("?")[0] ?? "model.gguf");
        const dir = config.modelDir ?? RNFS.DocumentDirectoryPath;
        return RNFS.exists(`${dir}/${fileName}`);
    }
    catch {
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
exports.MOBILE_MODELS = {
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
};
//# sourceMappingURL=react-native.js.map