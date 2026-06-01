package com.llmizeoff

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Downloads GGUF model files to app-private storage.
 *
 * Models are stored in context.filesDir/llmizeoff_models/ and persist
 * across app restarts. Call [isDownloaded] first to avoid re-downloading.
 *
 * Usage:
 * ```kotlin
 * val downloader = ModelDownloader(context)
 *
 * if (!downloader.isDownloaded(LlmizeOffEngine.MODEL_SMOL_135M)) {
 *     downloader.download(
 *         url      = LlmizeOffEngine.MODEL_SMOL_135M_URL,
 *         fileName = LlmizeOffEngine.MODEL_SMOL_135M,
 *     ) { percent -> updateProgressBar(percent) }
 * }
 *
 * val engine = LlmizeOffEngine(context)
 * engine.load(downloader.modelPath(LlmizeOffEngine.MODEL_SMOL_135M))
 * ```
 */
class ModelDownloader(context: Context) {

    private val modelsDir = File(context.filesDir, "llmizeoff_models").also { it.mkdirs() }

    /** Absolute path to a downloaded model file. */
    fun modelPath(fileName: String): String = File(modelsDir, fileName).absolutePath

    /** True if the model has already been downloaded and the file is non-empty. */
    fun isDownloaded(fileName: String): Boolean {
        val f = File(modelsDir, fileName)
        return f.exists() && f.length() > 0
    }

    /**
     * Download a GGUF model.
     *
     * @param url       Direct download URL (HuggingFace, GitHub Releases, etc.)
     * @param fileName  Local file name, e.g. "smollm2-135m-q4.gguf"
     * @param onProgress  Called with 0–100 during download. May not be called
     *                    if the server doesn't send Content-Length.
     * @return Absolute path to the downloaded file.
     */
    suspend fun download(
        url: String,
        fileName: String,
        onProgress: ((percent: Int) -> Unit)? = null,
    ): String = withContext(Dispatchers.IO) {
        val dest = File(modelsDir, fileName)
        val tmp  = File(modelsDir, "$fileName.tmp")

        // Resume partial download if possible
        val startByte = if (tmp.exists()) tmp.length() else 0L

        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 30_000
        conn.readTimeout    = 60_000
        conn.setRequestProperty("Accept", "application/octet-stream")
        if (startByte > 0) conn.setRequestProperty("Range", "bytes=$startByte-")
        conn.connect()

        val code = conn.responseCode
        // 206 = partial content (resume), 200 = full file
        check(code == 200 || code == 206) { "Download failed: HTTP $code for $url" }

        val totalBytes = conn.contentLengthLong.takeIf { it > 0 }
            ?.let { it + startByte }

        tmp.outputStream().also { out ->
            if (startByte > 0 && code == 200) {
                // Server didn't support range — restart
                tmp.delete()
            }
        }.close()

        var written = startByte
        tmp.outputStream().let { out ->
            conn.inputStream.use { input ->
                val buf = ByteArray(64 * 1024)
                var n: Int
                while (input.read(buf).also { n = it } >= 0) {
                    out.write(buf, 0, n)
                    written += n
                    if (onProgress != null && totalBytes != null && totalBytes > 0) {
                        onProgress((written * 100 / totalBytes).toInt().coerceIn(0, 100))
                    }
                }
            }
        }

        tmp.renameTo(dest)
        onProgress?.invoke(100)
        dest.absolutePath
    }

    /** Delete a cached model to free storage. */
    fun delete(fileName: String) {
        File(modelsDir, fileName).delete()
        File(modelsDir, "$fileName.tmp").delete()
    }

    /** Total bytes used by all downloaded models. */
    fun totalStorageUsed(): Long = modelsDir.listFiles()
        ?.filterNot { it.name.endsWith(".tmp") }
        ?.sumOf { it.length() } ?: 0L
}
