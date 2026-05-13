"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOutreachMessage = exports.buildOutreachEmail = exports.extractLeads = exports.MOBILE_MODELS = exports.isModelDownloaded = exports.createMobileEngine = exports.createClient = exports.OffLlamaError = exports.OffLlamaClient = exports.DEFAULT_MODEL = exports.BUNDLED_MODELS = exports.getDefaultModelDir = exports.getModelPath = exports.downloadModel = exports.startServer = exports.createServer = exports.LlamaEngine = void 0;
// Server-side (Node.js / cPanel) — runs llama.cpp inference embedded
var engine_1 = require("./engine");
Object.defineProperty(exports, "LlamaEngine", { enumerable: true, get: function () { return engine_1.LlamaEngine; } });
var server_1 = require("./server");
Object.defineProperty(exports, "createServer", { enumerable: true, get: function () { return server_1.createServer; } });
Object.defineProperty(exports, "startServer", { enumerable: true, get: function () { return server_1.startServer; } });
var downloader_1 = require("./downloader");
Object.defineProperty(exports, "downloadModel", { enumerable: true, get: function () { return downloader_1.downloadModel; } });
Object.defineProperty(exports, "getModelPath", { enumerable: true, get: function () { return downloader_1.getModelPath; } });
Object.defineProperty(exports, "getDefaultModelDir", { enumerable: true, get: function () { return downloader_1.getDefaultModelDir; } });
Object.defineProperty(exports, "BUNDLED_MODELS", { enumerable: true, get: function () { return downloader_1.BUNDLED_MODELS; } });
Object.defineProperty(exports, "DEFAULT_MODEL", { enumerable: true, get: function () { return downloader_1.DEFAULT_MODEL; } });
// Universal HTTP client — works in browser, Kotlin/JS, Node.js, Deno, Bun
var client_1 = require("./client");
Object.defineProperty(exports, "OffLlamaClient", { enumerable: true, get: function () { return client_1.OffLlamaClient; } });
Object.defineProperty(exports, "OffLlamaError", { enumerable: true, get: function () { return client_1.OffLlamaError; } });
Object.defineProperty(exports, "createClient", { enumerable: true, get: function () { return client_1.createClient; } });
// React Native adapter — offline on-device inference via llama.rn + HTTP fallback
var react_native_1 = require("./react-native");
Object.defineProperty(exports, "createMobileEngine", { enumerable: true, get: function () { return react_native_1.createMobileEngine; } });
Object.defineProperty(exports, "isModelDownloaded", { enumerable: true, get: function () { return react_native_1.isModelDownloaded; } });
Object.defineProperty(exports, "MOBILE_MODELS", { enumerable: true, get: function () { return react_native_1.MOBILE_MODELS; } });
// NanoExtractor — zero-model regex extraction + template generation (< 100 MB apps)
var nano_extractor_1 = require("./nano-extractor");
Object.defineProperty(exports, "extractLeads", { enumerable: true, get: function () { return nano_extractor_1.extractLeads; } });
Object.defineProperty(exports, "buildOutreachEmail", { enumerable: true, get: function () { return nano_extractor_1.buildOutreachEmail; } });
Object.defineProperty(exports, "buildOutreachMessage", { enumerable: true, get: function () { return nano_extractor_1.buildOutreachMessage; } });
//# sourceMappingURL=index.js.map