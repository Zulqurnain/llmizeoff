#!/usr/bin/env node
import { Command } from "commander";
import { downloadModel, BUNDLED_MODELS, DEFAULT_MODEL } from "./downloader";
import { LlamaEngine } from "./engine";
import { startServer } from "./server";

const program = new Command();
program.name("llmizeoff").description("Run llama.cpp on any Node.js host — no VPS required").version("0.1.0");

program
  .command("download [model]")
  .description(`Download a GGUF model. Available: ${Object.keys(BUNDLED_MODELS).join(", ")}`)
  .action(async (model: string = DEFAULT_MODEL) => {
    try {
      await downloadModel(model);
    } catch (err) {
      console.error("Download failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List available models")
  .action(() => {
    console.log("\nAvailable models:\n");
    for (const [key, info] of Object.entries(BUNDLED_MODELS)) {
      const marker = key === DEFAULT_MODEL ? " (default)" : "";
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
  .action(async (opts: Record<string, string>) => {
    await startServer({
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
  .action(async (opts: Record<string, string>) => {
    const engine = new LlamaEngine({ modelPath: opts.model });
    await engine.load(true);

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];

    console.log(`\nllmizeoff chat — model: ${engine.getModelName()}`);
    console.log("Type 'exit' to quit.\n");

    const ask = () => {
      rl.question("You: ", async (input) => {
        input = input.trim();
        if (!input || input === "exit") { rl.close(); await engine.unload(); return; }
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
