"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL = exports.BUNDLED_MODELS = void 0;
exports.getDefaultModelDir = getDefaultModelDir;
exports.getModelPath = getModelPath;
exports.downloadModel = downloadModel;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
exports.BUNDLED_MODELS = {
    "llama3.2-1b": {
        name: "Llama 3.2 1B Instruct Q4_K_M",
        url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        sizeBytes: 808_000_000,
        description: "Default. ~770MB. Meta's Llama 3.2 1B — good quality, fast on CPU (first token ~2-3s). Best speed/quality balance for a CPU VPS.",
    },
    "gemma2-2b": {
        name: "Gemma 2 2B Instruct Q4_K_M",
        url: "https://huggingface.co/lmstudio-community/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
        sizeBytes: 1_708_000_000,
        description: "Higher quality, slower. ~1.6GB. Google's Gemma 2 2B. Needs ~2.5GB RAM.",
    },
    "smollm2-360m": {
        name: "SmolLM2-360M-Instruct Q8_0",
        url: "https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf",
        sizeBytes: 386_000_000,
        description: "~370MB, extremely fast on CPU (first token ~1-2s) but weaker quality. Best for the snappiest chat.",
    },
    "smollm2-1.7b": {
        name: "SmolLM2-1.7B-Instruct Q4_K_M",
        url: "https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf",
        sizeBytes: 1_060_000_000,
        description: "Higher quality. ~1GB. Needs ~1.5GB RAM. Slower than 360M but stronger reasoning.",
    },
    "qwen2.5-0.5b": {
        name: "Qwen2.5-0.5B-Instruct Q4_K_M",
        url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        sizeBytes: 397_000_000,
        description: "Tiny but capable. ~400MB. Fits in 512MB RAM.",
    },
    "qwen2.5-1.5b": {
        name: "Qwen2.5-1.5B-Instruct Q4_K_M",
        url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        sizeBytes: 986_000_000,
        description: "Better quality. ~1GB. Needs 1.5GB RAM.",
    },
};
exports.DEFAULT_MODEL = "llama3.2-1b";
function getDefaultModelDir() {
    return path.join(process.env.OFFL_LLAMA_MODEL_DIR || path.join(process.cwd(), "models"));
}
function getModelPath(modelKey = exports.DEFAULT_MODEL) {
    const info = exports.BUNDLED_MODELS[modelKey];
    if (!info)
        throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(exports.BUNDLED_MODELS).join(", ")}`);
    const filename = info.url.split("/").pop();
    return path.join(getDefaultModelDir(), filename);
}
async function downloadModel(modelKey = exports.DEFAULT_MODEL, onProgress) {
    const info = exports.BUNDLED_MODELS[modelKey];
    if (!info)
        throw new Error(`Unknown model: ${modelKey}`);
    const destPath = getModelPath(modelKey);
    const modelDir = path.dirname(destPath);
    if (fs.existsSync(destPath)) {
        const stat = fs.statSync(destPath);
        if (stat.size > info.sizeBytes * 0.95) {
            console.log(`Model already downloaded: ${destPath}`);
            return destPath;
        }
        fs.unlinkSync(destPath); // remove incomplete download
    }
    fs.mkdirSync(modelDir, { recursive: true });
    console.log(`Downloading ${info.name} (~${Math.round(info.sizeBytes / 1e6)}MB)...`);
    console.log(`URL: ${info.url}`);
    await downloadFile(info.url, destPath, onProgress);
    console.log(`\nDownloaded to: ${destPath}`);
    return destPath;
}
function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        let downloaded = 0;
        function get(u) {
            const client = u.startsWith("https") ? https : http;
            client.get(u, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    get(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} from ${u}`));
                    return;
                }
                const total = parseInt(res.headers["content-length"] || "0", 10);
                res.on("data", (chunk) => {
                    downloaded += chunk.length;
                    if (onProgress)
                        onProgress(downloaded, total);
                    else {
                        const pct = total ? Math.round((downloaded / total) * 100) : "?";
                        process.stdout.write(`\r${pct}% (${Math.round(downloaded / 1e6)}MB)`);
                    }
                });
                res.pipe(file);
                file.on("finish", () => { file.close(); resolve(); });
            }).on("error", (err) => { fs.unlinkSync(dest); reject(err); });
        }
        get(url);
    });
}
//# sourceMappingURL=downloader.js.map