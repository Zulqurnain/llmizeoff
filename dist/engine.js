"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaEngine = void 0;
const path = __importStar(require("path"));
const downloader_1 = require("./downloader");
let cachedModule = null;
// node-llama-cpp is ESM with top-level await. When this package is built to
// CommonJS, TypeScript down-levels `import()` into a require()-based helper,
// which throws on ESM-TLA modules. Using the Function constructor keeps a
// genuine dynamic import() in the emitted JS, so it works from CJS and ESM alike.
const nativeDynamicImport = new Function("specifier", "return import(specifier);");
async function getLlamaCpp() {
    if (cachedModule)
        return cachedModule;
    cachedModule = await nativeDynamicImport("node-llama-cpp");
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
class LlamaEngine {
    constructor(config = {}) {
        this.llama = null;
        this.model = null;
        this.ctx = null;
        this.seq = null;
        this.session = null;
        this.resolvedModelPath = null;
        // Serialise inference — one request at a time
        this.queue = Promise.resolve();
        this.config = {
            contextSize: config.contextSize ?? 2048,
            gpuLayers: config.gpuLayers ?? 0,
            modelPath: config.modelPath,
        };
    }
    enqueue(fn) {
        const task = this.queue.then(fn);
        this.queue = task.catch(() => { });
        return task;
    }
    async load(autoDownload = true) {
        const { getLlama, LlamaChatSession } = await getLlamaCpp();
        let modelPath = this.config.modelPath;
        if (!modelPath) {
            modelPath = (0, downloader_1.getModelPath)(downloader_1.DEFAULT_MODEL);
            const fs = await Promise.resolve().then(() => __importStar(require("fs")));
            if (!fs.existsSync(modelPath)) {
                if (!autoDownload) {
                    throw new Error(`Model not found at ${modelPath}. Run: npx llmizeoff download`);
                }
                console.log("Model not found locally. Auto-downloading (this happens once)...");
                await (0, downloader_1.downloadModel)(downloader_1.DEFAULT_MODEL);
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
    async warmup() {
        await this.ensureLoaded();
        await this.enqueue(() => this.session.prompt("Hi", { maxTokens: 4, temperature: 0 }));
    }
    async ensureLoaded() {
        if (!this.session)
            await this.load(true);
    }
    /**
     * Compose the final prompt fed to the session.
     * The system message (live context + instructions) is prepended to the last
     * user turn so the model has it without polluting the chat template.
     */
    composePrompt(messages) {
        const system = messages.find((m) => m.role === "system")?.content;
        const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
        return system
            ? `[Context for this reply only]\n${system}\n\n---\n\n${lastUser}`
            : lastUser;
    }
    /** Non-streaming chat. Returns the full reply. */
    async chat(messages, opts = {}) {
        await this.ensureLoaded();
        const prompt = this.composePrompt(opts.systemPrompt
            ? [{ role: "system", content: opts.systemPrompt }, ...messages]
            : messages);
        return this.enqueue(() => this.session.prompt(prompt, {
            maxTokens: opts.maxTokens ?? 512,
            temperature: opts.temperature ?? 0.7,
            topP: opts.topP ?? 0.9,
            repeatPenalty: { penalty: opts.repeatPenalty ?? 1.1, frequencyPenalty: 0.05, presencePenalty: 0.05 },
            ...(opts.onToken
                ? { onTextChunk: (chunk) => opts.onToken(chunk) }
                : {}),
        }));
    }
    /**
     * Streaming chat. Each text chunk is delivered through onToken as it is
     * generated; the resolved promise contains the full concatenated reply.
     */
    async chatStream(messages, onToken, opts = {}) {
        return this.chat(messages, { ...opts, onToken });
    }
    async complete(prompt, opts = {}) {
        await this.ensureLoaded();
        const { LlamaCompletion } = await getLlamaCpp();
        return this.enqueue(async () => {
            const completion = new LlamaCompletion({ contextSequence: this.ctx.getSequence() });
            const result = await completion.generateCompletion(prompt, {
                maxTokens: opts.maxTokens ?? 256,
                temperature: opts.temperature ?? 0.7,
                customStopTriggers: opts.stopSequences,
            });
            await completion.dispose();
            return result;
        });
    }
    getModelName() {
        return this.resolvedModelPath ? path.basename(this.resolvedModelPath) : "not loaded";
    }
    isReady() {
        return this.session !== null;
    }
    async unload() {
        if (this.session) {
            this.session = null;
        }
        if (this.seq) {
            this.seq = null;
        }
        if (this.ctx) {
            await this.ctx.dispose();
            this.ctx = null;
        }
        if (this.model) {
            await this.model.dispose();
            this.model = null;
        }
        if (this.llama) {
            await this.llama.dispose();
            this.llama = null;
        }
    }
}
exports.LlamaEngine = LlamaEngine;
//# sourceMappingURL=engine.js.map