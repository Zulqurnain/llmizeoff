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
    "qwen2.5-0.5b": {
        name: "Qwen2.5-0.5B-Instruct Q4_K_M",
        url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        sizeBytes: 397_000_000,
        description: "Tiny but capable. ~400MB. Fits in 512MB RAM. Best for cPanel shared hosting.",
    },
    "qwen2.5-1.5b": {
        name: "Qwen2.5-1.5B-Instruct Q4_K_M",
        url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        sizeBytes: 986_000_000,
        description: "Better quality. ~1GB. Needs 1.5GB RAM.",
    },
    "tinyllama": {
        name: "TinyLlama-1.1B Chat Q4_K_M",
        url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.q4_k_m.gguf",
        sizeBytes: 668_000_000,
        description: "~670MB. Good balance of size and quality.",
    },
};
exports.DEFAULT_MODEL = "qwen2.5-0.5b";
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