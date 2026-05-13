"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = exports.OffLlamaError = exports.OffLlamaClient = exports.DEFAULT_MODEL = exports.BUNDLED_MODELS = exports.getDefaultModelDir = exports.getModelPath = exports.downloadModel = exports.startServer = exports.createServer = exports.LlamaEngine = void 0;
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
// Universal client — works in browser, React Native, Kotlin/JS, Node.js, Deno, Bun
var client_1 = require("./client");
Object.defineProperty(exports, "OffLlamaClient", { enumerable: true, get: function () { return client_1.OffLlamaClient; } });
Object.defineProperty(exports, "OffLlamaError", { enumerable: true, get: function () { return client_1.OffLlamaError; } });
Object.defineProperty(exports, "createClient", { enumerable: true, get: function () { return client_1.createClient; } });
//# sourceMappingURL=index.js.map