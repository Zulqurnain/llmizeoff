export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatOptions {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    /** Penalise repetition (default 1.1). */
    repeatPenalty?: number;
    /** Top-p nucleus sampling (default 0.9). */
    topP?: number;
    /** Called with each decoded text chunk as it streams. */
    onToken?: (text: string) => void;
}
export interface CompletionOptions {
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
}
export interface ModelConfig {
    /** Path to GGUF model file. Defaults to auto-downloaded Qwen2.5-0.5B. */
    modelPath?: string;
    /** Max RAM to use for model context (MB). Default: 512 */
    gpuLayers?: number;
    /** Context size. Default: 2048 */
    contextSize?: number;
}
export interface ServerConfig extends ModelConfig {
    port?: number;
    host?: string;
    /** Secret token for Bearer auth (optional) */
    apiKey?: string;
}
/** OpenAI-compatible response shape */
export interface OpenAIChatResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: Message;
        finish_reason: "stop" | "length";
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
//# sourceMappingURL=types.d.ts.map