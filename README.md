# offLLama

Run LLM inference on **any Node.js host** — cPanel shared hosting, VPS, Raspberry Pi — with zero cloud dependencies. Also ships a universal HTTP client for **browser, React Native, Kotlin/Android**, and a **native Android module** (JNI/NDK) for fully offline on-device AI.

[![npm](https://img.shields.io/npm/v/offllama?style=flat-square)](https://www.npmjs.com/package/offllama)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

---

## What's inside

| Export | Environment | Description |
|--------|-------------|-------------|
| `offllama` (default) | Node.js / cPanel | Embedded inference via `node-llama-cpp` + OpenAI-compatible HTTP server |
| `offllama/client` | Browser, RN, Node.js, Deno, Bun | Zero-dependency HTTP client for any offLLama server |
| `offllama/react-native` | React Native (iOS + Android) | Offline on-device inference via `llama.rn` OR HTTP fallback |
| `offllama/nano` | Any | Zero-model regex extraction + template message builders |
| `android/` | Kotlin / Android native | Full JNI/NDK library — 100% offline, no server needed |

---

## Quick start (Node.js / cPanel)

```bash
npm install offllama

# Download default model (~400 MB, auto on first request)
npx offl-llama download

# Start OpenAI-compatible server
npx offl-llama serve --port 8080 --api-key my-secret
```

Call it from anywhere:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

---

## Embed in Next.js / Express (no separate server)

```ts
import { LlamaEngine } from "offllama";

const llama = new LlamaEngine({ contextSize: 2048 });
await llama.load(); // auto-downloads model on first run

const reply = await llama.chat([
  { role: "system", content: "You extract lead information from text." },
  { role: "user",   content: "Contact Sarah at sarah@acme.com or +44 7700 123456" }
]);
console.log(reply);
```

Set `serverExternalPackages: ["offllama", "node-llama-cpp"]` in `next.config.ts`.

---

## Universal HTTP client (browser / React Native / Kotlin/JS)

Zero dependencies — uses the native `fetch` API. Works everywhere.

```ts
import { createClient } from "offllama/client";

const client = createClient({
  baseUrl: "https://tools.example.com/ai",
  apiKey: "my-secret",      // optional
  timeout: 30_000,
});

// Simple ask
const reply = await client.ask("Draft a short intro email for a job application");

// Full chat
const resp = await client.chat([
  { role: "system",  content: "You are a concise assistant." },
  { role: "user",    content: "What is machine learning?" },
]);
console.log(resp.choices[0].message.content);
```

---

## React Native — offline AI (< 100 MB app)

Uses `llama.rn` for on-device inference. Falls back to HTTP if `serverUrl` is set.

**App stays under 100 MB** by bundling SmolLM2-135M (~75 MB) directly in assets.

```bash
npm install offllama llama.rn react-native-fs
cd ios && pod install
```

```ts
import { createMobileEngine, MOBILE_MODELS } from "offllama/react-native";

// Offline — model bundled in app assets (no download)
const engine = await createMobileEngine({
  modelUrl:      MOBILE_MODELS.SMOL_135M_NANO.url,
  modelFileName: MOBILE_MODELS.SMOL_135M_NANO.fileName, // 75 MB
  onDownloadProgress: (pct) => console.log(`Downloading ${pct}%`),
});

const reply = await engine.ask("Write a professional intro message");
await engine.release();

// Online — connects to your offLLama server (no model on device)
const engine = await createMobileEngine({ serverUrl: "https://tools.example.com/ai" });
```

### Bundlable models (fit inside app, no download after install)

| Constant | Size | Notes |
|----------|------|-------|
| `SMOL_135M_NANO` | ~75 MB | **Fits in < 100 MB app.** Simple tasks. |
| `QWEN_0_5B` | ~290 MB | Better quality, download at first launch |
| `QWEN_1_5B` | ~530 MB | Best mobile quality, download at first launch |

---

## Android Native (Kotlin) — 100% offline, no server

See [`android/README.md`](android/README.md) for full setup.

```kotlin
// Add to app/src/main/assets/smollm2-135m-q4.gguf (~75 MB)
val engine = OffLlamaEngine(context)
engine.loadFromAssets(OffLlamaEngine.MODEL_SMOL_135M)

val reply = engine.ask(
    userMessage  = "Write a short job application message",
    systemPrompt = "You are a helpful assistant. Be concise.",
    maxTokens    = 200,
)
engine.release()
```

For HTTP (connecting to your cPanel server):
```kotlin
val client = OffLlamaClient("https://tools.example.com/ai", apiKey = "my-secret")
val reply = client.ask("Extract emails from: john@corp.com")
```

---

## Zero-model extraction (offllama/nano)

For apps that don't need AI generation at all — extracts leads with pure regex:

```ts
import { extractLeads, buildOutreachEmail } from "offllama/nano";

const leads = extractLeads(`
  Hi, I'm Sarah Connor from Skynet. Reach me at sarah@skynet.io
  or WhatsApp +44 7700 123456 or Telegram @sarahc
`);
// { emails: ["sarah@skynet.io"], phones: ["+447700123456"],
//   telegram: ["@sarahc"], names: ["Sarah Connor"], ... }

const email = buildOutreachEmail({
  senderName: "John Smith",
  recipientName: "Sarah",
  jobTitle: "Software Engineer",
  company: "Skynet",
});
// { subject: "Application for Software Engineer at Skynet — John Smith",
//   body: "Hi Sarah, ..." }
```

---

## cPanel Deployment

offLLama is designed to run as a Passenger Node.js app on cPanel shared hosting.

```
~/your-app/
  startup.js        ← reads .env, starts server.js
  server.js         ← Next.js standalone server
  .env              ← credentials (never in webroot)
  node_modules/
    offllama/
    node-llama-cpp/
```

See the [Text To Leads Extractor](https://github.com/Zulqurnain/text-to-leads-extractor) for a production example with GitHub Actions deploy.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `HOSTNAME` | `0.0.0.0` | Server host |
| `OFFL_LLAMA_API_KEY` | — | Bearer auth key (optional) |
| `OFFL_LLAMA_MODEL_PATH` | auto | Path to custom GGUF model |
| `OFFL_LLAMA_MODEL_DIR` | `./models` | Directory for downloaded models |
| `OFFL_LLAMA_CONTEXT_SIZE` | `2048` | Context window size |

---

## Models (CLI)

```bash
npx offl-llama download              # default: qwen2.5-0.5b (~400 MB)
npx offl-llama download qwen2.5-1.5b
npx offl-llama list
npx offl-llama serve --port 8080 --api-key secret
npx offl-llama chat
```

---

## Requirements

- **Server mode**: Node.js 18+, Linux x64 (or macOS/Windows for dev), ~512 MB RAM
- **Client**: any environment with `fetch` (browser, RN, Node 18+, Deno, Bun)
- **Android module**: NDK 26+, CMake 3.22+, `minSdkVersion 24`
- **React Native**: RN 0.71+, `llama.rn ≥ 0.8.0`, `react-native-fs ≥ 2.0.0` (peer deps)

---

## License

MIT © [Zulqurnain Haider](https://zulqurnainj.com)
