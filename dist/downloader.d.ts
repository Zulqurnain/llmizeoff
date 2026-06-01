export interface ModelInfo {
    name: string;
    url: string;
    sizeBytes: number;
    description: string;
}
export declare const BUNDLED_MODELS: Record<string, ModelInfo>;
export declare const DEFAULT_MODEL = "smollm2-360m";
export declare function getDefaultModelDir(): string;
export declare function getModelPath(modelKey?: string): string;
export declare function downloadModel(modelKey?: string, onProgress?: (downloaded: number, total: number) => void): Promise<string>;
//# sourceMappingURL=downloader.d.ts.map