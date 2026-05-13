package com.offllama

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * offLLama offline engine for Android.
 *
 * Runs llama.cpp natively on-device via JNI — no server, no internet needed.
 * The GGUF model file is loaded from the device's local storage.
 *
 * For apps that want to stay under 100 MB:
 *  - Bundle SmolLM2-135M-Q4 (~75 MB) in your app's assets/
 *  - Or let the user download it once on first launch
 *
 * SETUP
 * -----
 * 1. Add the offllama AAR to your app (see build.gradle below)
 * 2. Place the .gguf model file in assets/ or download it at runtime
 *
 * build.gradle (app):
 * ```groovy
 * android {
 *     defaultConfig {
 *         ndk { abiFilters 'arm64-v8a', 'x86_64' }
 *     }
 * }
 * dependencies {
 *     implementation 'com.github.Zulqurnain:offllama-android:0.2.1'
 * }
 * ```
 *
 * Usage:
 * ```kotlin
 * val engine = OffLlamaEngine(context)
 * engine.load("smollm2-135m-q4.gguf")   // from assets/
 * val reply = engine.ask("Write a short intro email for a job application")
 * engine.release()
 * ```
 */
class OffLlamaEngine(private val context: Context) {

    private var nativeHandle: Long = 0L
    private var loaded = false

    /**
     * Load a GGUF model from the app's assets/ directory.
     *
     * @param assetFileName  File name inside assets/, e.g. "smollm2-135m-q4.gguf"
     * @param contextSize    Token context window (default 2048)
     * @param threads        CPU threads to use (default: half of available cores)
     */
    suspend fun loadFromAssets(
        assetFileName: String,
        contextSize: Int = 2048,
        threads: Int = Runtime.getRuntime().availableProcessors() / 2,
    ) = withContext(Dispatchers.IO) {
        // Copy from assets to internal cache so llama.cpp can mmap it
        val cacheFile = File(context.cacheDir, assetFileName)
        if (!cacheFile.exists()) {
            context.assets.open(assetFileName).use { input ->
                cacheFile.outputStream().use { output -> input.copyTo(output) }
            }
        }
        load(cacheFile.absolutePath, contextSize, threads)
    }

    /**
     * Load a GGUF model from an absolute file path on device storage.
     *
     * @param modelPath    Absolute path to the .gguf file
     * @param contextSize  Token context window (default 2048)
     * @param threads      CPU threads (default: half of available cores)
     */
    suspend fun load(
        modelPath: String,
        contextSize: Int = 2048,
        threads: Int = Runtime.getRuntime().availableProcessors() / 2,
    ) = withContext(Dispatchers.IO) {
        check(!loaded) { "Model already loaded. Call release() first." }
        nativeHandle = nativeLoad(modelPath, contextSize, threads)
        if (nativeHandle == 0L) throw IllegalStateException("Failed to load model: $modelPath")
        loaded = true
    }

    /**
     * Ask a single question and get a text reply (offline, on-device).
     */
    suspend fun ask(
        userMessage: String,
        systemPrompt: String? = null,
        maxTokens: Int = 512,
        temperature: Float = 0.7f,
    ): String = withContext(Dispatchers.IO) {
        checkLoaded()
        val prompt = buildPrompt(systemPrompt, userMessage)
        nativeGenerate(nativeHandle, prompt, maxTokens, temperature)
    }

    /**
     * Chat with message history.
     */
    suspend fun chat(
        messages: List<OffLlamaClient.Message>,
        maxTokens: Int = 512,
        temperature: Float = 0.7f,
    ): String = withContext(Dispatchers.IO) {
        checkLoaded()
        val prompt = buildChatPrompt(messages)
        nativeGenerate(nativeHandle, prompt, maxTokens, temperature)
    }

    /** Release native resources. Always call when done. */
    fun release() {
        if (loaded && nativeHandle != 0L) {
            nativeFree(nativeHandle)
            nativeHandle = 0L
            loaded = false
        }
    }

    private fun checkLoaded() = check(loaded) { "Model not loaded. Call load() or loadFromAssets() first." }

    // ChatML / SmolLM2 prompt format
    private fun buildPrompt(system: String?, user: String): String {
        val sb = StringBuilder()
        if (system != null) sb.append("<|im_start|>system\n$system<|im_end|>\n")
        sb.append("<|im_start|>user\n$user<|im_end|>\n<|im_start|>assistant\n")
        return sb.toString()
    }

    private fun buildChatPrompt(messages: List<OffLlamaClient.Message>): String {
        val sb = StringBuilder()
        messages.forEach { m ->
            sb.append("<|im_start|>${m.role}\n${m.content}<|im_end|>\n")
        }
        sb.append("<|im_start|>assistant\n")
        return sb.toString()
    }

    // ─── JNI declarations ────────────────────────────────────────────────────
    private external fun nativeLoad(modelPath: String, contextSize: Int, threads: Int): Long
    private external fun nativeGenerate(handle: Long, prompt: String, maxTokens: Int, temperature: Float): String
    private external fun nativeFree(handle: Long)

    companion object {
        init {
            System.loadLibrary("offllama")
        }

        /**
         * Recommended bundlable model (~75 MB, fits in < 100 MB total app).
         * Download from HuggingFace and place in assets/.
         */
        const val MODEL_SMOL_135M = "smollm2-135m-q4.gguf"
        const val MODEL_SMOL_135M_URL =
            "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q4_k_m.gguf"

        const val MODEL_QWEN_0_5B = "qwen2.5-0.5b-q4.gguf"
        const val MODEL_QWEN_0_5B_URL =
            "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
    }
}
