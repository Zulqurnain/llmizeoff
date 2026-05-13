package com.offllama

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * offLLama HTTP client for Android (Kotlin).
 *
 * Zero dependencies — uses Android's built-in HttpURLConnection.
 * Use this to connect your Android app to a self-hosted offLLama server
 * running on cPanel / shared hosting.
 *
 * For fully offline inference (no server), use [OffLlamaEngine] instead.
 *
 * Usage:
 * ```kotlin
 * val client = OffLlamaClient("https://tools.example.com/ai", apiKey = "optional")
 * val reply = client.ask("What is 2 + 2?")
 * println(reply) // "4"
 * ```
 */
class OffLlamaClient(
    private val baseUrl: String,
    private val apiKey: String? = null,
    private val timeoutMs: Int = 60_000,
) {
    data class Message(val role: String, val content: String)

    data class ChatResponse(
        val content: String,
        val promptTokens: Int,
        val completionTokens: Int,
    )

    /** Check if the server is reachable. */
    suspend fun ping(): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = openConnection("/health", "GET")
            conn.connect()
            conn.responseCode == 200
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Ask a single question and get a text reply.
     *
     * @param userMessage   The user's message.
     * @param systemPrompt  Optional system instruction.
     * @param maxTokens     Max tokens in the response (default 512).
     * @param temperature   Sampling temperature 0–1 (default 0.7).
     */
    suspend fun ask(
        userMessage: String,
        systemPrompt: String? = null,
        maxTokens: Int = 512,
        temperature: Double = 0.7,
    ): String = withContext(Dispatchers.IO) {
        val messages = buildList {
            if (systemPrompt != null) add(Message("system", systemPrompt))
            add(Message("user", userMessage))
        }
        chat(messages, maxTokens, temperature).content
    }

    /**
     * Full chat with message history.
     */
    suspend fun chat(
        messages: List<Message>,
        maxTokens: Int = 512,
        temperature: Double = 0.7,
    ): ChatResponse = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("messages", JSONArray().apply {
                messages.forEach { m ->
                    put(JSONObject().apply {
                        put("role", m.role)
                        put("content", m.content)
                    })
                }
            })
            put("max_tokens", maxTokens)
            put("temperature", temperature)
            put("stream", false)
        }.toString()

        val conn = openConnection("/v1/chat/completions", "POST")
        conn.doOutput = true
        OutputStreamWriter(conn.outputStream).use { it.write(body) }

        val code = conn.responseCode
        val raw = BufferedReader(InputStreamReader(
            if (code < 400) conn.inputStream else conn.errorStream
        )).use { it.readText() }

        if (code >= 400) throw OffLlamaException(code, raw)

        val json = JSONObject(raw)
        val choice = json.getJSONArray("choices").getJSONObject(0)
        val usage = json.optJSONObject("usage")

        ChatResponse(
            content = choice.getJSONObject("message").getString("content"),
            promptTokens = usage?.optInt("prompt_tokens", 0) ?: 0,
            completionTokens = usage?.optInt("completion_tokens", 0) ?: 0,
        )
    }

    private fun openConnection(path: String, method: String): HttpURLConnection {
        val conn = URL("${baseUrl.trimEnd('/')}$path").openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        if (apiKey != null) conn.setRequestProperty("Authorization", "Bearer $apiKey")
        return conn
    }
}

class OffLlamaException(val status: Int, message: String) :
    Exception("offLLama HTTP $status: $message")
