import { Message, ChatOptions, CompletionOptions, ModelConfig } from "./types";
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
export declare class LlamaEngine {
    private config;
    private llama;
    private model;
    private ctx;
    private seq;
    private session;
    private resolvedModelPath;
    private queue;
    constructor(config?: ModelConfig);
    private enqueue;
    load(autoDownload?: boolean): Promise<void>;
    /** Pre-warm the session so the first real request doesn't pay cold-start cost. */
    warmup(): Promise<void>;
    private ensureLoaded;
    /** Non-streaming chat. Returns the full reply. */
    chat(messages: Message[], opts?: ChatOptions): Promise<string>;
    /**
     * Streaming chat. Each text chunk is delivered through onToken as it is
     * generated; the resolved promise contains the full concatenated reply.
     */
    chatStream(messages: Message[], onToken: (text: string) => void, opts?: Omit<ChatOptions, "onToken">): Promise<string>;
    complete(prompt: string, opts?: CompletionOptions): Promise<string>;
    getModelName(): string;
    isReady(): boolean;
    unload(): Promise<void>;
}
//# sourceMappingURL=engine.d.ts.map