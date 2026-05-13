/**
 * offLLama Client — zero-dependency HTTP client for the offLLama server.
 *
 * Works in any JavaScript environment: browser, React Native, Node.js,
 * Bun, Deno, Electron, Kotlin/JS, etc.
 *
 * Use this to connect your app to a self-hosted offLLama server on
 * cPanel / shared hosting / VPS without exposing credentials client-side.
 */
export interface ClientConfig {
    /** Base URL of your offLLama server, e.g. "https://tools.example.com/ai" */
    baseUrl: string;
    /** Optional API key (set OFFL_LLAMA_API_KEY on the server) */
    apiKey?: string;
    /** Request timeout in ms (default: 60 000). Pass 0 to disable. */
    timeout?: number;
}
export interface ClientMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatRequest {
    messages: ClientMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: false;
}
export interface CompletionRequest {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
    stop?: string[];
}
export interface ChatResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ClientMessage;
        finish_reason: "stop" | "length";
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface CompletionResponse {
    id: string;
    object: "text_completion";
    choices: Array<{
        index: number;
        text: string;
        finish_reason: "stop" | "length";
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface ModelList {
    data: Array<{
        id: string;
        object: "model";
    }>;
}
export declare class OffLlamaClient {
    private readonly base;
    private readonly headers;
    private readonly timeout;
    constructor(config: ClientConfig);
    /** Check if the server is reachable. Returns true on success. */
    ping(): Promise<boolean>;
    /** List available models. */
    models(): Promise<ModelList>;
    /**
     * Send a chat conversation and get the assistant reply.
     *
     * @example
     * const reply = await client.chat([
     *   { role: "user", content: "What is 2 + 2?" }
     * ]);
     * console.log(reply.choices[0].message.content);
     */
    chat(messages: ClientMessage[], opts?: Omit<ChatRequest, "messages">): Promise<ChatResponse>;
    /**
     * Convenience wrapper: returns just the text content of the assistant reply.
     *
     * @example
     * const text = await client.ask("Translate 'hello' to French");
     */
    ask(userMessage: string, opts?: {
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    /**
     * Text completion (legacy-style).
     *
     * @example
     * const resp = await client.complete("The capital of France is");
     * console.log(resp.choices[0].text);
     */
    complete(prompt: string, opts?: Omit<CompletionRequest, "prompt">): Promise<CompletionResponse>;
    private _fetch;
}
export declare class OffLlamaError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/** Convenience factory */
export declare function createClient(config: ClientConfig): OffLlamaClient;
//# sourceMappingURL=client.d.ts.map