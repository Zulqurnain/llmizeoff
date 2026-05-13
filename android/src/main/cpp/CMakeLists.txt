cmake_minimum_required(VERSION 3.22)
project(offllama)

# ── llama.cpp source ──────────────────────────────────────────────────────────
# Clone llama.cpp into android/llama.cpp/ once:
#   git clone --depth 1 https://github.com/ggerganov/llama.cpp \
#       android/src/main/cpp/llama.cpp
set(LLAMA_CPP_DIR ${CMAKE_SOURCE_DIR}/llama.cpp)

# Build options — keep size + compile time small
set(LLAMA_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL           OFF CACHE BOOL "" FORCE)

# Android ABI-specific tuning
if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(GGML_NEON ON CACHE BOOL "" FORCE)
endif()
if(ANDROID_ABI STREQUAL "x86_64")
    set(GGML_AVX  OFF CACHE BOOL "" FORCE)
    set(GGML_AVX2 OFF CACHE BOOL "" FORCE)
endif()

add_subdirectory(${LLAMA_CPP_DIR} ${CMAKE_BINARY_DIR}/llama.cpp)

# ── offllama JNI shared library ───────────────────────────────────────────────
add_library(offllama SHARED offllama_jni.cpp)

target_include_directories(offllama PRIVATE
    ${LLAMA_CPP_DIR}/include
    ${LLAMA_CPP_DIR}/common
    ${LLAMA_CPP_DIR}/ggml/include
)

target_link_libraries(offllama
    llama
    common
    android
    log
)

# Strip debug symbols in release for smaller .so
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_compile_options(offllama PRIVATE -O2 -fvisibility=hidden)
    set_target_properties(offllama PROPERTIES
        LINK_FLAGS "-Wl,--strip-all"
    )
endif()
