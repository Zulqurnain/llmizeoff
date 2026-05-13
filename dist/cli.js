#!/usr/bin/env node
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
const commander_1 = require("commander");
const downloader_1 = require("./downloader");
const engine_1 = require("./engine");
const server_1 = require("./server");
const program = new commander_1.Command();
program.name("offl-llama").description("Run llama.cpp on any Node.js host — no VPS required").version("0.1.0");
program
    .command("download [model]")
    .description(`Download a GGUF model. Available: ${Object.keys(downloader_1.BUNDLED_MODELS).join(", ")}`)
    .action(async (model = downloader_1.DEFAULT_MODEL) => {
    try {
        await (0, downloader_1.downloadModel)(model);
    }
    catch (err) {
        console.error("Download failed:", err instanceof Error ? err.message : err);
        process.exit(1);
    }
});
program
    .command("list")
    .description("List available models")
    .action(() => {
    console.log("\nAvailable models:\n");
    for (const [key, info] of Object.entries(downloader_1.BUNDLED_MODELS)) {
        const marker = key === downloader_1.DEFAULT_MODEL ? " (default)" : "";
        console.log(`  ${key}${marker}`);
        console.log(`    ${info.description}`);
        console.log(`    ${Math.round(info.sizeBytes / 1e6)}MB — ${info.url}\n`);
    }
});
program
    .command("serve")
    .description("Start the OpenAI-compatible inference server")
    .option("-p, --port <port>", "Port to listen on", "8080")
    .option("--host <host>", "Host to bind to", "0.0.0.0")
    .option("--api-key <key>", "Optional Bearer token for API authentication")
    .option("--model <path>", "Path to GGUF model file")
    .option("--context-size <size>", "Context window size", "2048")
    .action(async (opts) => {
    await (0, server_1.startServer)({
        port: parseInt(opts.port, 10),
        host: opts.host,
        apiKey: opts.apiKey,
        modelPath: opts.model,
        contextSize: parseInt(opts.contextSize, 10),
    });
});
program
    .command("chat")
    .description("Interactive chat in the terminal")
    .option("--model <path>", "Path to GGUF model file")
    .action(async (opts) => {
    const engine = new engine_1.LlamaEngine({ modelPath: opts.model });
    await engine.load(true);
    const readline = await Promise.resolve().then(() => __importStar(require("readline")));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const history = [];
    console.log(`\noffl-llama chat — model: ${engine.getModelName()}`);
    console.log("Type 'exit' to quit.\n");
    const ask = () => {
        rl.question("You: ", async (input) => {
            input = input.trim();
            if (!input || input === "exit") {
                rl.close();
                await engine.unload();
                return;
            }
            history.push({ role: "user", content: input });
            const reply = await engine.chat(history);
            history.push({ role: "assistant", content: reply });
            console.log(`\nAssistant: ${reply}\n`);
            ask();
        });
    };
    ask();
});
program.parse();
//# sourceMappingURL=cli.js.map