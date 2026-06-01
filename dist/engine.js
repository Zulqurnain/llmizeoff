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
async function getLlamaCpp() {
    if (cachedModule)
        return cachedModule;
    cachedModule = await Promise.resolve().then(() => __importStar(require("node-llama-cpp")));
    return cachedModule;
}
class LlamaEngine {
    constructor(config = {}) {
        this.llama = null;
        this.model = null;
        this.ctx = null;
        this.session = null;
        this.resolvedModelPath = null;
        this.config = {
            contextSize: config.contextSize ?? 2048,
            gpuLayers: config.gpuLayers ?? 0,
            modelPath: config.modelPath,
        };
    }
    async load(autoDownload = true) {
        const { getLlama } = await getLlamaCpp();
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
        this.llama = await getLlama({ gpu: false });
        this.model = await this.llama.loadModel({ modelPath });
        this.ctx = await this.model.createContext({ contextSize: this.config.contextSize ?? 2048 });
        const { LlamaChatSession } = await getLlamaCpp();
        this.session = new LlamaChatSession({ contextSequence: this.ctx.getSequence() });
        console.log("Model loaded and ready.");
    }
    async ensureLoaded() {
        if (!this.session)
            await this.load(true);
    }
    async chat(messages, opts = {}) {
        await this.ensureLoaded();
        // Re-create session for each chat to avoid accumulated context blowing up memory
        const { LlamaChatSession } = await getLlamaCpp();
        const session = new LlamaChatSession({ contextSequence: this.ctx.getSequence() });
        const system = opts.systemPrompt ?? messages.find(m => m.role === "system")?.content;
        const turns = messages.filter(m => m.role === "user" || m.role === "assistant");
        if (system) {
            // Seed the session with a system message via a priming exchange
            await session.prompt(`[system]: ${system}\n[user]: OK\n`, { maxTokens: 5, temperature: 0 });
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
    async complete(prompt, opts = {}) {
        await this.ensureLoaded();
        const { LlamaCompletion } = await getLlamaCpp();
        const completion = new LlamaCompletion({ contextSequence: this.ctx.getSequence() });
        const result = await completion.generateCompletion(prompt, {
            maxTokens: opts.maxTokens ?? 256,
            temperature: opts.temperature ?? 0.7,
            customStopTriggers: opts.stopSequences,
        });
        await completion.dispose();
        return result;
    }
    getModelName() {
        return this.resolvedModelPath ? path.basename(this.resolvedModelPath) : "not loaded";
    }
    async unload() {
        if (this.session) {
            await this.session.dispose();
            this.session = null;
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