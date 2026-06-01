#include <jni.h>
#include <string>
#include <memory>
#include <android/log.h>

// llama.cpp public header — included via CMake (see CMakeLists.txt)
#include "llama.h"
#include "common/common.h"

#define LOG_TAG "llmizeoff"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

struct LlmizeOffContext {
    llama_model*   model   = nullptr;
    llama_context* ctx     = nullptr;
    llama_sampler* sampler = nullptr;
};

static std::string jstring_to_string(JNIEnv* env, jstring s) {
    const char* chars = env->GetStringUTFChars(s, nullptr);
    std::string result(chars);
    env->ReleaseStringUTFChars(s, chars);
    return result;
}

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_llmizeoff_LlmizeOffEngine_nativeLoad(
        JNIEnv* env, jobject /*obj*/,
        jstring modelPathJ, jint contextSize, jint threads)
{
    auto path = jstring_to_string(env, modelPathJ);
    LOGI("Loading model: %s  ctx=%d  threads=%d", path.c_str(), contextSize, threads);

    llama_backend_init();

    auto* ctx_obj = new LlmizeOffContext();

    // Model params
    auto mparams = llama_model_default_params();
    mparams.n_gpu_layers = 0; // CPU-only on Android

    ctx_obj->model = llama_model_load_from_file(path.c_str(), mparams);
    if (!ctx_obj->model) {
        LOGE("Failed to load model from %s", path.c_str());
        delete ctx_obj;
        return 0L;
    }

    // Context params
    auto cparams = llama_context_default_params();
    cparams.n_ctx     = static_cast<uint32_t>(contextSize);
    cparams.n_threads = static_cast<int32_t>(threads);

    ctx_obj->ctx = llama_new_context_with_model(ctx_obj->model, cparams);
    if (!ctx_obj->ctx) {
        LOGE("Failed to create context");
        llama_model_free(ctx_obj->model);
        delete ctx_obj;
        return 0L;
    }

    // Sampler chain
    auto sparams = llama_sampler_chain_default_params();
    ctx_obj->sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(ctx_obj->sampler, llama_sampler_init_min_p(0.05f, 1));
    llama_sampler_chain_add(ctx_obj->sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(ctx_obj->sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    LOGI("Model loaded OK");
    return reinterpret_cast<jlong>(ctx_obj);
}

JNIEXPORT jstring JNICALL
Java_com_llmizeoff_LlmizeOffEngine_nativeGenerate(
        JNIEnv* env, jobject /*obj*/,
        jlong handle, jstring promptJ, jint maxTokens, jfloat temperature)
{
    if (!handle) {
        return env->NewStringUTF("[error: model not loaded]");
    }

    auto* c = reinterpret_cast<LlmizeOffContext*>(handle);
    auto prompt = jstring_to_string(env, promptJ);

    // Tokenise
    auto vocab = llama_model_get_vocab(c->model);
    const int n_prompt = -llama_tokenize(
        vocab, prompt.c_str(), (int32_t)prompt.size(),
        nullptr, 0, /*add_special=*/true, /*parse_special=*/true);

    std::vector<llama_token> tokens_list(n_prompt);
    llama_tokenize(vocab, prompt.c_str(), (int32_t)prompt.size(),
                   tokens_list.data(), (int32_t)tokens_list.size(),
                   /*add_special=*/true, /*parse_special=*/true);

    // Adjust temperature in sampler
    // (rebuild sampler chain with new temperature)
    llama_sampler_free(c->sampler);
    auto sparams = llama_sampler_chain_default_params();
    c->sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(c->sampler, llama_sampler_init_min_p(0.05f, 1));
    llama_sampler_chain_add(c->sampler, llama_sampler_init_temp(temperature));
    llama_sampler_chain_add(c->sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    // Build batch
    llama_batch batch = llama_batch_get_one(tokens_list.data(), (int32_t)tokens_list.size());

    std::string result;
    result.reserve(512);

    llama_context_clear_kv_cache(c->ctx);

    for (int i = 0; i < maxTokens; ++i) {
        if (llama_decode(c->ctx, batch) != 0) {
            LOGE("llama_decode failed at token %d", i);
            break;
        }

        llama_token new_token = llama_sampler_sample(c->sampler, c->ctx, -1);

        if (llama_vocab_is_eog(vocab, new_token)) break;

        char buf[256];
        int n = llama_token_to_piece(vocab, new_token, buf, sizeof(buf), 0, true);
        if (n > 0) result.append(buf, n);

        batch = llama_batch_get_one(&new_token, 1);
    }

    // Trim ChatML end token if present
    const std::string eot = "<|im_end|>";
    if (result.size() >= eot.size() &&
        result.compare(result.size() - eot.size(), eot.size(), eot) == 0) {
        result.erase(result.size() - eot.size());
    }

    // Trim trailing whitespace
    while (!result.empty() && std::isspace((unsigned char)result.back()))
        result.pop_back();

    return env->NewStringUTF(result.c_str());
}

JNIEXPORT void JNICALL
Java_com_llmizeoff_LlmizeOffEngine_nativeFree(
        JNIEnv* /*env*/, jobject /*obj*/, jlong handle)
{
    if (!handle) return;
    auto* c = reinterpret_cast<LlmizeOffContext*>(handle);
    if (c->sampler) llama_sampler_free(c->sampler);
    if (c->ctx)     llama_free(c->ctx);
    if (c->model)   llama_model_free(c->model);
    delete c;
    llama_backend_free();
    LOGI("Model released");
}

} // extern "C"
