import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface ModelInfo {
  name: string;
  url: string;
  sizeBytes: number;
  description: string;
}

export const BUNDLED_MODELS: Record<string, ModelInfo> = {
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

export const DEFAULT_MODEL = "qwen2.5-0.5b";

export function getDefaultModelDir(): string {
  return path.join(process.env.OFFL_LLAMA_MODEL_DIR || path.join(process.cwd(), "models"));
}

export function getModelPath(modelKey: string = DEFAULT_MODEL): string {
  const info = BUNDLED_MODELS[modelKey];
  if (!info) throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(BUNDLED_MODELS).join(", ")}`);
  const filename = info.url.split("/").pop()!;
  return path.join(getDefaultModelDir(), filename);
}

export async function downloadModel(
  modelKey: string = DEFAULT_MODEL,
  onProgress?: (downloaded: number, total: number) => void
): Promise<string> {
  const info = BUNDLED_MODELS[modelKey];
  if (!info) throw new Error(`Unknown model: ${modelKey}`);

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

function downloadFile(
  url: string,
  dest: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let downloaded = 0;

    function get(u: string) {
      const client = u.startsWith("https") ? https : http;
      client.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${u}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          if (onProgress) onProgress(downloaded, total);
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
