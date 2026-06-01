/**
 * llmizeOFF Client — zero-dependency HTTP client for the llmizeOFF server.
 *
 * Works in any JavaScript environment: browser, React Native, Node.js,
 * Bun, Deno, Electron, Kotlin/JS, etc.
 *
 * Use this to connect your app to a self-hosted llmizeOFF server on
 * cPanel / shared hosting / VPS without exposing credentials client-side.
 */

export interface ClientConfig {
  /** Base URL of your llmizeOFF server, e.g. "https://tools.example.com/ai" */
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
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface CompletionResponse {
  id: string;
  object: "text_completion";
  choices: Array<{ index: number; text: string; finish_reason: "stop" | "length" }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ModelList {
  data: Array<{ id: string; object: "model" }>;
}

export class LlmizeOffClient {
  private readonly base: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(config: ClientConfig) {
    this.base = config.baseUrl.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    this.timeout = config.timeout ?? 60_000;
  }

  /** Check if the server is reachable. Returns true on success. */
  async ping(): Promise<boolean> {
    try {
      const r = await this._fetch("/health");
      return r.ok;
    } catch {
      return false;
    }
  }

  /** List available models. */
  async models(): Promise<ModelList> {
    const r = await this._fetch("/v1/models");
    return r.json() as Promise<ModelList>;
  }

  /**
   * Send a chat conversation and get the assistant reply.
   *
   * @example
   * const reply = await client.chat([
   *   { role: "user", content: "What is 2 + 2?" }
   * ]);
   * console.log(reply.choices[0].message.content);
   */
  async chat(messages: ClientMessage[], opts: Omit<ChatRequest, "messages"> = {}): Promise<ChatResponse> {
    const r = await this._fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ ...opts, messages, stream: false }),
    });
    if (!r.ok) throw new LlmizeOffError(r.status, await r.text());
    return r.json() as Promise<ChatResponse>;
  }

  /**
   * Convenience wrapper: returns just the text content of the assistant reply.
   *
   * @example
   * const text = await client.ask("Translate 'hello' to French");
   */
  async ask(
    userMessage: string,
    opts: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    const messages: ClientMessage[] = [];
    if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
    messages.push({ role: "user", content: userMessage });
    const resp = await this.chat(messages, {
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    });
    return resp.choices[0]?.message?.content ?? "";
  }

  /**
   * Text completion (legacy-style).
   *
   * @example
   * const resp = await client.complete("The capital of France is");
   * console.log(resp.choices[0].text);
   */
  async complete(prompt: string, opts: Omit<CompletionRequest, "prompt"> = {}): Promise<CompletionResponse> {
    const r = await this._fetch("/v1/completions", {
      method: "POST",
      body: JSON.stringify({ ...opts, prompt }),
    });
    if (!r.ok) throw new LlmizeOffError(r.status, await r.text());
    return r.json() as Promise<CompletionResponse>;
  }

  private _fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.base}${path}`;
    const options: RequestInit = {
      ...init,
      headers: { ...this.headers, ...(init.headers ?? {}) },
    };

    if (this.timeout > 0 && typeof AbortController !== "undefined") {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeout);
      options.signal = ctrl.signal;
      return fetch(url, options).finally(() => clearTimeout(timer));
    }

    return fetch(url, options);
  }
}

export class LlmizeOffError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`llmizeOFF HTTP ${status}: ${message}`);
    this.name = "LlmizeOffError";
  }
}

/** Convenience factory */
export function createClient(config: ClientConfig): LlmizeOffClient {
  return new LlmizeOffClient(config);
}

// Backward-compatible aliases (pre-0.3.0 names)
export const OffLlamaError = LlmizeOffError;
export const OffLlamaClient = LlmizeOffClient;
