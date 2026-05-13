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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const crypto = __importStar(require("crypto"));
const engine_1 = require("./engine");
function createServer(config = {}) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "1mb" }));
    const engine = new engine_1.LlamaEngine(config);
    let engineReady = false;
    let engineError = null;
    // Load model in background on startup
    engine.load(true).then(() => {
        engineReady = true;
    }).catch((err) => {
        engineError = err;
        console.error("Failed to load model:", err.message);
    });
    // Optional Bearer auth
    if (config.apiKey) {
        app.use("/v1", (req, res, next) => {
            const auth = req.headers.authorization;
            if (!auth || auth !== `Bearer ${config.apiKey}`) {
                res.status(401).json({ error: { message: "Invalid API key", type: "authentication_error" } });
                return;
            }
            next();
        });
    }
    app.get("/health", (_req, res) => {
        res.json({
            status: engineReady ? "ok" : engineError ? "error" : "loading",
            model: engine.getModelName(),
            error: engineError?.message,
        });
    });
    // OpenAI-compatible models list
    app.get("/v1/models", (_req, res) => {
        res.json({
            object: "list",
            data: [{
                    id: engine.getModelName(),
                    object: "model",
                    created: Math.floor(Date.now() / 1000),
                    owned_by: "offl-llama",
                }],
        });
    });
    // OpenAI-compatible chat completions
    app.post("/v1/chat/completions", async (req, res) => {
        if (!engineReady) {
            if (engineError) {
                res.status(503).json({ error: { message: "Model failed to load: " + engineError.message } });
            }
            else {
                res.status(503).json({ error: { message: "Model is still loading. Try again in a moment." } });
            }
            return;
        }
        const { messages, max_tokens, temperature } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({ error: { message: "messages array is required" } });
            return;
        }
        try {
            const text = await engine.chat(messages, {
                maxTokens: max_tokens ?? 512,
                temperature: temperature ?? 0.7,
            });
            const response = {
                id: "chatcmpl-" + crypto.randomBytes(8).toString("hex"),
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: engine.getModelName(),
                choices: [{
                        index: 0,
                        message: { role: "assistant", content: text },
                        finish_reason: "stop",
                    }],
                usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            };
            res.json(response);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: { message } });
        }
    });
    // OpenAI-compatible completions
    app.post("/v1/completions", async (req, res) => {
        if (!engineReady) {
            res.status(503).json({ error: { message: "Model is still loading." } });
            return;
        }
        const { prompt, max_tokens, temperature } = req.body;
        if (!prompt) {
            res.status(400).json({ error: { message: "prompt is required" } });
            return;
        }
        try {
            const text = await engine.complete(prompt, {
                maxTokens: max_tokens ?? 256,
                temperature: temperature ?? 0.7,
            });
            res.json({
                id: "cmpl-" + crypto.randomBytes(8).toString("hex"),
                object: "text_completion",
                created: Math.floor(Date.now() / 1000),
                model: engine.getModelName(),
                choices: [{ text, index: 0, finish_reason: "stop" }],
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: { message } });
        }
    });
    return app;
}
/** Start the server directly (used as cPanel startup file) */
async function startServer(config = {}) {
    const port = config.port ?? parseInt(process.env.PORT ?? "8080", 10);
    const host = config.host ?? process.env.HOSTNAME ?? "0.0.0.0";
    const app = createServer(config);
    app.listen(port, host, () => {
        console.log(`offl-llama server running on http://${host}:${port}`);
        console.log(`Health check: http://${host}:${port}/health`);
        console.log(`Chat API:     POST http://${host}:${port}/v1/chat/completions`);
    });
}
//# sourceMappingURL=server.js.map