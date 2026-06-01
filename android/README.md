# llmizeOFF Android

Run LLM inference **natively on Android** (Kotlin) — no server, no internet, 100% offline.

Uses llama.cpp via JNI/NDK. Works on ARM64 phones and x86_64 emulators.

---

## Two modes

| Mode | Class | Internet needed? | Use case |
|------|-------|-----------------|----------|
| **Offline (on-device)** | `LlmizeOffEngine` | No | Truly offline, private |
| **Online (HTTP server)** | `LlmizeOffClient` | Yes | Larger models on cPanel |

---

## App size < 100 MB

Use `SmolLM2-135M-Q4` (~75 MB) **bundled inside your APK**:

```
app/src/main/assets/smollm2-135m-q4.gguf   ← download once, commit to repo
```

Total APK: `~95 MB` (75 MB model + ~20 MB framework).

---

## Setup

### 1. Clone llama.cpp into the module

```bash
git clone --depth 1 https://github.com/ggerganov/llama.cpp \
    android/src/main/cpp/llama.cpp
```

### 2. Add to your app's `settings.gradle`

```groovy
include ':llmizeoff-android'
project(':llmizeoff-android').projectDir = new File('../llmizeoff/android')
```

### 3. Add dependency in `app/build.gradle`

```groovy
dependencies {
    implementation project(':llmizeoff-android')
}
```

### 4. Download the model

**Option A — Bundle in APK (< 100 MB total, no download needed):**
```bash
# Download once and commit to your repo
curl -L https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q4_k_m.gguf \
     -o app/src/main/assets/smollm2-135m-q4.gguf
```

**Option B — Download at first launch (for larger models):**
```kotlin
val downloader = ModelDownloader(context)
if (!downloader.isDownloaded(LlmizeOffEngine.MODEL_QWEN_0_5B)) {
    downloader.download(
        url      = LlmizeOffEngine.MODEL_QWEN_0_5B_URL,
        fileName = LlmizeOffEngine.MODEL_QWEN_0_5B,
    ) { percent -> showProgress(percent) }
}
```

---

## Offline usage (Kotlin)

```kotlin
import com.llmizeoff.LlmizeOffEngine
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private val engine = LlmizeOffEngine(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        lifecycleScope.launch {
            // Load from bundled assets/ — no download needed
            engine.loadFromAssets(LlmizeOffEngine.MODEL_SMOL_135M)

            // Ask anything
            val reply = engine.ask(
                userMessage  = "Write a short professional introduction for a software engineer",
                systemPrompt = "You are a helpful assistant. Be concise.",
                maxTokens    = 200,
            )
            textView.text = reply
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        engine.release()  // always release native memory
    }
}
```

## Online usage (Kotlin) — connects to llmizeOFF server on cPanel

```kotlin
import com.llmizeoff.LlmizeOffClient
import kotlinx.coroutines.launch

val client = LlmizeOffClient(
    baseUrl = "https://tools.yourdomain.com/ai",
    apiKey  = "your-api-key",  // optional
)

lifecycleScope.launch {
    if (client.ping()) {
        val reply = client.ask("Extract all emails from: hello@example.com contact me")
        println(reply)
    }
}
```

---

## Available models

| Constant | Size | Bundlable | Notes |
|----------|------|-----------|-------|
| `MODEL_SMOL_135M` | ~75 MB | ✅ Yes | Fits in < 100 MB app. Simple tasks. |
| `MODEL_QWEN_0_5B` | ~290 MB | ❌ Download | Better quality. Download at launch. |

---

## Build requirements

- Android Studio Hedgehog (2023.1) or newer
- NDK 26+
- CMake 3.22+
- `minSdkVersion 24` (Android 7.0)

---

## Supported ABIs

| ABI | Devices |
|-----|---------|
| `arm64-v8a` | All modern Android phones |
| `x86_64` | Emulators, Chromebooks |
