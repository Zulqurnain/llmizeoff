// Server-side (Node.js / cPanel) — runs llama.cpp inference embedded
export { LlamaEngine } from "./engine";
export { createServer, startServer } from "./server";
export { downloadModel, getModelPath, getDefaultModelDir, BUNDLED_MODELS, DEFAULT_MODEL } from "./downloader";
export type { Message, ChatOptions, CompletionOptions, ModelConfig, ServerConfig, OpenAIChatResponse } from "./types";

// Universal HTTP client — works in browser, Kotlin/JS, Node.js, Deno, Bun
// LlmizeOff* are the canonical names; OffLlama* kept as aliases for compatibility.
export { LlmizeOffClient, LlmizeOffError, OffLlamaClient, OffLlamaError, createClient } from "./client";
export type { ClientConfig, ClientMessage, ChatRequest, CompletionRequest, ChatResponse, CompletionResponse, ModelList } from "./client";

// React Native adapter — offline on-device inference via llama.rn + HTTP fallback
export { createMobileEngine, isModelDownloaded, MOBILE_MODELS } from "./react-native";
export type { MobileEngine, MobileEngineConfig } from "./react-native";

// NanoExtractor — zero-model regex extraction + template generation (< 100 MB apps)
export { extractLeads, buildOutreachEmail, buildOutreachMessage } from "./nano-extractor";
export type { ExtractedLeads, MessageTemplate, TemplateVars } from "./nano-extractor";
