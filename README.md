# llmizeOFF

> **offllama** is being evolved into **llmizeOFF** — a smarter, more production-ready self-hosted LLM runtime and toolkit.
> The npm package stays `offllama` for backward compatibility. The new brand is **llmizeOFF**.

**Try it live → [zulqurnainj.com/chat](https://zulqurnainj.com/chat)** · Nayab is the hosted demo of llmizeOFF

---

Run LLM inference on **any host** — cPanel shared hosting, VPS, Raspberry Pi, Android — with zero cloud dependencies, no subscriptions, and no external lock-in.

[![npm](https://img.shields.io/npm/v/offllama?style=flat-square)](https://www.npmjs.com/package/offllama)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-orange?style=flat-square)](https://ko-fi.com/zulqurnainjj)

**Self-hosted · Offline-first · VPS & cPanel ready · Android compatible · No subscriptions**

---

## What is llmizeOFF?

llmizeOFF (packaged as `offllama`) is an open-source LLM runtime designed to run where cloud AI cannot:

- **$5/month VPS** — works on the smallest DigitalOcean or Hetzner droplets
- **cPanel shared hosting** — deploys as a Node.js app without root access
- **Android apps** — native JNI/NDK module for fully offline on-device inference
- **Local machines** — zero-config CLI for developer tools and scripts
- **Web apps** — universal HTTP client for browser, React Native, and Node.js

No GPU required. No monthly API bills. No data sent to third parties.

---

## Live demo — Nayab

**[Nayab](https://zulqurnainj.com/chat)** is the hosted demo of llmizeOFF. It runs Qwen 2.5-1.5B on a standard VPS with real token streaming. Try it free to see what llmizeOFF can do in a production environment.

---

## What's inside

| Export | Environment | Description |
|--------|-------------|-------------|
| `offllama` (default) | Node.js / cPanel | Embedded inference via `node-llama-cpp` + OpenAI-compatible HTTP server |
| `offllama/client` | Browser, RN, Node.js, Deno, Bun | Zero-dependency HTTP client for any llmizeOFF server |
| `offllama/react-native` | React Native (iOS + Android) | Offline on-device inference via `llama.rn` OR HTTP fallback |
| `offllama/nano` | Any | Zero-model regex extraction + template message builders |
| `android/` | Kotlin / Android native | Full JNI/NDK library — 100% offline, no server needed |

---

## Quick start (Node.js / VPS / cPanel)

```bash
npm install offllama

# Download recommended model (Qwen 2.5-1.5B ~1.1GB — best quality/speed on CPU)
npx offl-llama download

# Start OpenAI-compatible server with real token streaming
npx offl-llama serve --port 8080 --api-key my-secret
```

Call it from anywhere:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

---

## Recommended models for self-hosting

Tested on a 6-core AMD EPYC VPS (12GB RAM, no GPU):

| Model | Size | First token | Tokens/sec | Verdict |
|-------|------|-------------|------------|---------|
| **Qwen 2.5-1.5B Q4_K_M** | 1.1 GB | 3-5s | 4-6 | **Best for VPS** |
| Qwen 2.5-0.5B Q4_K_M | 469 MB | 2-3s | 8-12 | Fastest, limited quality |
| Qwen 2.5-3B Q4_K_M | 2.0 GB | 6-10s | 2-3 | Better quality, slower |
| Phi-3.5-mini 3.8B | 2.3 GB | 15-20s | 1-2 | Too slow for interactive chat |

Qwen 2.5-1.5B is the sweet spot: smart enough for real tasks, fast enough for streaming chat.

For **sub-1-second** responses, pair llmizeOFF with [Groq](https://groq.com) (free tier, 800+ tok/s).

---

## Embed in Next.js / Express

```ts
import { LlamaEngine } from "offllama";

const llama = new LlamaEngine({ contextSize: 2048 });
await llama.load(); // auto-downloads Qwen 2.5-1.5B on first run

const reply = await llama.chat([
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "What is the capital of France?" }
]);

console.log(reply); // "The capital of France is Paris."
```

---

## Android — fully offline on-device

```kotlin
// build.gradle
dependencies {
    implementation("com.github.Zulqurnain:llmizeoff-android:0.2.0")
}
```

```kotlin
val engine = OffLlamaEngine(context, modelPath = "models/qwen2.5-0.5b-q4_k_m.gguf")
engine.load()
val reply = engine.chat("Explain recursion in one sentence.")
```

---

## Universal HTTP client

Works in browser, React Native, Node.js, Deno, and Bun — zero dependencies:

```ts
import { OffLlamaClient } from "offllama/client";

const client = new OffLlamaClient({
  baseUrl: "https://your-server.example.com:8080",
  apiKey: "my-secret",
});

// Streaming
for await (const token of client.streamChat([
  { role: "user", content: "Write a haiku about self-hosting" }
])) {
  process.stdout.write(token);
}
```

---

## VPS deployment (PM2 + nginx)

```bash
# 1. Install
npm install offllama pm2 -g

# 2. Download model
npx offl-llama download --model qwen2.5-1.5b

# 3. Start with PM2
pm2 start node_modules/offllama/dist/server.js \
  --name llmizeoff \
  --env PORT=8080,HOSTNAME=127.0.0.1,OFFLLAMA_API_KEY=your-key

pm2 save && pm2 startup
```

Add nginx reverse proxy to expose on your domain. See the [Nayab source](https://github.com/Zulqurnain/nayab) for a complete production example.

---

## Why llmizeOFF?

| Feature | llmizeOFF | Cloud AI APIs |
|---------|-----------|---------------|
| Monthly cost | $0 (your VPS) | $20-100+/month |
| Data privacy | 100% local | Sent to cloud |
| Works offline | Yes | No |
| VPS / cPanel | Yes | No |
| Android (offline) | Yes | No |
| Vendor lock-in | None | Yes |

---

## Roadmap — llmizeOFF Pro (coming soon)

The core runtime stays open-source and free forever. The upcoming Pro edition adds:

- Visual dashboard for model management
- One-click model download and switching
- Multi-user support with rate limiting
- Android SDK (AAR package)
- Priority support and SLAs

**Support development and shape the roadmap:**

**[☕ Ko-fi: @zulqurnainjj](https://ko-fi.com/zulqurnainjj)**

---

## License

MIT © [Zulqurnain Haider](https://zulqurnainj.com)
