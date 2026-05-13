# offLLama

Run llama.cpp inference on **any Node.js host** — including cPanel shared hosting. No VPS, no GPU, no cloud API key required.

offLLama wraps [`node-llama-cpp`](https://github.com/withcatai/node-llama-cpp) and exposes:
- An **OpenAI-compatible HTTP API** (`/v1/chat/completions`, `/v1/completions`)
- An **embeddable JS module** (`LlamaEngine`) you can import directly in your app
- A **CLI** for downloading models and chatting in the terminal

---

## Quick start

```bash
npm install offllama

# Download the default model (~400MB, fits in 512MB RAM)
npx offllama download

# Start the OpenAI-compatible server
npx offllama serve --port 8080
```

Then call it like any OpenAI-compatible API:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

---

## Models

| Key | Name | Size | RAM needed |
|-----|------|------|------------|
| `qwen2.5-0.5b` (default) | Qwen2.5-0.5B Instruct Q4_K_M | ~400MB | ~512MB |
| `qwen2.5-1.5b` | Qwen2.5-1.5B Instruct Q4_K_M | ~1GB | ~1.5GB |
| `tinyllama` | TinyLlama-1.1B Chat Q4_K_M | ~670MB | ~1GB |

```bash
npx offllama list              # list all available models
npx offllama download qwen2.5-1.5b  # download a specific model
```

Set `OFFL_LLAMA_MODEL_PATH` env var to use your own GGUF file.

---

## cPanel deployment

offLLama is designed to run as a **second cPanel Node.js App** alongside your main app. The main app calls it on localhost.

### 1. Create a new Node.js App in cPanel

1. cPanel → **Software** → **Setup Node.js App**
2. Click **Create Application**
3. Set:
   - **Node.js version**: 18+ (or latest available)
   - **Application mode**: Production
   - **Application root**: `offllama` (creates `~/offllama/`)
   - **Application URL**: `offllama.yourdomain.com` (or a path)
   - **Application startup file**: `startup.js`
4. Click **Create**

### 2. Install and configure

```bash
# SSH into your server (or use cPanel Terminal)
cd ~/offllama
npm install offllama
node node_modules/offllama/src/startup.js  # or copy startup.js here
```

Or FTP/upload these files to `~/offllama/`:
```
~/offllama/
  package.json      {"name":"app","dependencies":{"offllama":"^0.1.0"}}
  startup.js        (copy from node_modules/offllama/src/startup.js)
  .env              OFFL_LLAMA_API_KEY=your_secret_key
  models/           (auto-created when model downloads)
```

### 3. Download the model

The model auto-downloads on first request. To pre-download:

```bash
cd ~/offllama
OFFL_LLAMA_MODEL_DIR=./models node -e "require('offllama').downloadModel()"
```

### 4. Call it from your main app

```javascript
// In your Next.js API route or Express handler:
const response = await fetch("http://localhost:8080/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer your_secret_key" },
  body: JSON.stringify({
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Extract emails from this text: ..." }
    ]
  })
});
const data = await response.json();
console.log(data.choices[0].message.content);
```

---

## Embed directly (no HTTP server)

If your app and the model are in the same process:

```javascript
import { LlamaEngine } from "offllama";

const llama = new LlamaEngine();
await llama.load(); // auto-downloads model on first run

const reply = await llama.chat([
  { role: "system", content: "You extract email addresses from text." },
  { role: "user", content: "Contact: john@example.com or jane@corp.io" }
]);
console.log(reply);
```

---

## CLI reference

```
offllama download [model]     Download a model (default: qwen2.5-0.5b)
offllama list                 List available models
offllama serve [options]      Start OpenAI-compatible HTTP server
offllama chat [options]       Interactive terminal chat
```

Options for `serve`:
```
-p, --port <port>       Port (default: 8080)
--host <host>           Host (default: 0.0.0.0)
--api-key <key>         Bearer token for auth (optional)
--model <path>          Path to GGUF model file
--context-size <size>   Context window size (default: 2048)
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `HOSTNAME` | `0.0.0.0` | Server host |
| `OFFL_LLAMA_API_KEY` | (none) | Bearer auth key |
| `OFFL_LLAMA_MODEL_PATH` | auto | Path to GGUF model |
| `OFFL_LLAMA_MODEL_DIR` | `./models` | Directory for downloaded models |
| `OFFL_LLAMA_CONTEXT_SIZE` | `2048` | Context window size |

---

## Requirements

- Node.js 18+
- Linux x64 (cPanel shared hosting) or macOS/Windows (dev)
- ~512MB free RAM for the default model
- ~400MB disk for the model file

---

## License

MIT © [Zulqurnain Haider](https://zulqurnainj.com)
