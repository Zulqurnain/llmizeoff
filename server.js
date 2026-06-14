/**
 * Nayab's self-hosted inference server — runs ON the llmizeOFF library.
 *
 * This is true dogfooding: instead of hand-rolling llama.cpp glue, the VPS
 * runs the published `llmizeoff` npm package (LlamaEngine + OpenAI-compatible
 * server with SSE streaming). Nayab chat → llmizeOFF library → local GGUF model,
 * all self-hosted on this VPS. No cloud, no subscriptions.
 *
 * Model and runtime config come from env (see ecosystem.config.cjs).
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { startServer } from "llmizeoff";

const PORT      = parseInt(process.env.PORT ?? "8080", 10);
const HOST      = process.env.HOSTNAME ?? "127.0.0.1";
const MODEL_DIR = process.env.OFFL_LLAMA_MODEL_DIR ?? "/root/llmizeoff-server/models";
const API_KEY   = process.env.OFFLLAMA_API_KEY || undefined;

// Model selection. Default is SmolLM2 (much faster on CPU); set MODEL_FILE to
// override with an exact filename. Otherwise prefer a SmolLM2 GGUF if present,
// then fall back to the largest available model.
function findModel(dir) {
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir).filter((f) => f.endsWith(".gguf"));
  if (files.length === 0) return undefined;

  const override = process.env.MODEL_FILE;
  if (override && files.includes(override)) return join(dir, override);

  // Preference order: Llama 3.2 1B (default) → Gemma 2 → SmolLM2 → largest.
  const preferred = [/llama-?3\.2/i, /gemma-?2/i, /smollm2/i];
  for (const re of preferred) {
    const hit = files.find((f) => re.test(f));
    if (hit) return join(dir, hit);
  }
  return join(dir, files.sort((a, b) => b.localeCompare(a))[0]);
}

const modelPath = findModel(MODEL_DIR);
console.log(`[llmizeOFF] starting with model: ${modelPath ?? "(auto-download default)"}`);

startServer({
  port: PORT,
  host: HOST,
  modelPath,            // run our local self-hosted model
  contextSize: 2048,
  apiKey: API_KEY,
}).catch((err) => {
  console.error("Failed to start llmizeOFF server:", err);
  process.exit(1);
});
