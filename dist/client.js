"use strict";
/**
 * llmizeOFF Client — zero-dependency HTTP client for the llmizeOFF server.
 *
 * Works in any JavaScript environment: browser, React Native, Node.js,
 * Bun, Deno, Electron, Kotlin/JS, etc.
 *
 * Use this to connect your app to a self-hosted llmizeOFF server on
 * cPanel / shared hosting / VPS without exposing credentials client-side.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffLlamaClient = exports.OffLlamaError = exports.LlmizeOffError = exports.LlmizeOffClient = void 0;
exports.createClient = createClient;
class LlmizeOffClient {
    constructor(config) {
        this.base = config.baseUrl.replace(/\/$/, "");
        this.headers = { "Content-Type": "application/json" };
        if (config.apiKey)
            this.headers["Authorization"] = `Bearer ${config.apiKey}`;
        this.timeout = config.timeout ?? 60_000;
    }
    /** Check if the server is reachable. Returns true on success. */
    async ping() {
        try {
            const r = await this._fetch("/health");
            return r.ok;
        }
        catch {
            return false;
        }
    }
    /** List available models. */
    async models() {
        const r = await this._fetch("/v1/models");
        return r.json();
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
    async chat(messages, opts = {}) {
        const r = await this._fetch("/v1/chat/completions", {
            method: "POST",
            body: JSON.stringify({ ...opts, messages, stream: false }),
        });
        if (!r.ok)
            throw new LlmizeOffError(r.status, await r.text());
        return r.json();
    }
    /**
     * Convenience wrapper: returns just the text content of the assistant reply.
     *
     * @example
     * const text = await client.ask("Translate 'hello' to French");
     */
    async ask(userMessage, opts = {}) {
        const messages = [];
        if (opts.systemPrompt)
            messages.push({ role: "system", content: opts.systemPrompt });
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
    async complete(prompt, opts = {}) {
        const r = await this._fetch("/v1/completions", {
            method: "POST",
            body: JSON.stringify({ ...opts, prompt }),
        });
        if (!r.ok)
            throw new LlmizeOffError(r.status, await r.text());
        return r.json();
    }
    _fetch(path, init = {}) {
        const url = `${this.base}${path}`;
        const options = {
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
exports.LlmizeOffClient = LlmizeOffClient;
class LlmizeOffError extends Error {
    constructor(status, message) {
        super(`llmizeOFF HTTP ${status}: ${message}`);
        this.status = status;
        this.name = "LlmizeOffError";
    }
}
exports.LlmizeOffError = LlmizeOffError;
/** Convenience factory */
function createClient(config) {
    return new LlmizeOffClient(config);
}
// Backward-compatible aliases (pre-0.3.0 names)
exports.OffLlamaError = LlmizeOffError;
exports.OffLlamaClient = LlmizeOffClient;
//# sourceMappingURL=client.js.map