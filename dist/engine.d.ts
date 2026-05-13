import { Message, ChatOptions, CompletionOptions, ModelConfig } from "./types";
export declare class LlamaEngine {
    private config;
    private llama;
    private model;
    private ctx;
    private session;
    private resolvedModelPath;
    constructor(config?: ModelConfig);
    load(autoDownload?: boolean): Promise<void>;
    private ensureLoaded;
    chat(messages: Message[], opts?: ChatOptions): Promise<string>;
    complete(prompt: string, opts?: CompletionOptions): Promise<string>;
    getModelName(): string;
    unload(): Promise<void>;
}
//# sourceMappingURL=engine.d.ts.map