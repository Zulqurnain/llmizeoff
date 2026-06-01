import express, { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { LlamaEngine } from "./engine";
import { ServerConfig, OpenAIChatResponse, Message } from "./types";

export function createServer(config: ServerConfig = {}): express.Application {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const engine = new LlamaEngine(config);
  let engineReady = false;
  let engineError: Error | null = null;

  // Load model in background on startup
  engine.load(true).then(() => {
    engineReady = true;
  }).catch((err: Error) => {
    engineError = err;
    console.error("Failed to load model:", err.message);
  });

  // Optional Bearer auth
  if (config.apiKey) {
    app.use("/v1", (req: Request, res: Response, next: NextFunction) => {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${config.apiKey}`) {
        res.status(401).json({ error: { message: "Invalid API key", type: "authentication_error" } });
        return;
      }
      next();
    });
  }

  app.get("/health", (_req, res) => {
    res.json({
      status: engineReady ? "ok" : engineError ? "error" : "loading",
      model: engine.getModelName(),
      error: engineError?.message,
    });
  });

  // OpenAI-compatible models list
  app.get("/v1/models", (_req, res) => {
    res.json({
      object: "list",
      data: [{
        id: engine.getModelName(),
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "llmizeoff",
      }],
    });
  });

  // OpenAI-compatible chat completions
  app.post("/v1/chat/completions", async (req: Request, res: Response) => {
    if (!engineReady) {
      if (engineError) {
        res.status(503).json({ error: { message: "Model failed to load: " + engineError.message } });
      } else {
        res.status(503).json({ error: { message: "Model is still loading. Try again in a moment." } });
      }
      return;
    }

    const { messages, max_tokens, temperature } = req.body as {
      messages: Message[];
      max_tokens?: number;
      temperature?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: { message: "messages array is required" } });
      return;
    }

    try {
      const text = await engine.chat(messages, {
        maxTokens: max_tokens ?? 512,
        temperature: temperature ?? 0.7,
      });

      const response: OpenAIChatResponse = {
        id: "chatcmpl-" + crypto.randomBytes(8).toString("hex"),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: engine.getModelName(),
        choices: [{
          index: 0,
          message: { role: "assistant", content: text },
          finish_reason: "stop",
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: { message } });
    }
  });

  // OpenAI-compatible completions
  app.post("/v1/completions", async (req: Request, res: Response) => {
    if (!engineReady) {
      res.status(503).json({ error: { message: "Model is still loading." } });
      return;
    }

    const { prompt, max_tokens, temperature } = req.body as {
      prompt: string;
      max_tokens?: number;
      temperature?: number;
    };

    if (!prompt) {
      res.status(400).json({ error: { message: "prompt is required" } });
      return;
    }

    try {
      const text = await engine.complete(prompt, {
        maxTokens: max_tokens ?? 256,
        temperature: temperature ?? 0.7,
      });

      res.json({
        id: "cmpl-" + crypto.randomBytes(8).toString("hex"),
        object: "text_completion",
        created: Math.floor(Date.now() / 1000),
        model: engine.getModelName(),
        choices: [{ text, index: 0, finish_reason: "stop" }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: { message } });
    }
  });

  return app;
}

/** Start the server directly (used as cPanel startup file) */
export async function startServer(config: ServerConfig = {}): Promise<void> {
  const port = config.port ?? parseInt(process.env.PORT ?? "8080", 10);
  const host = config.host ?? process.env.HOSTNAME ?? "0.0.0.0";

  const app = createServer(config);
  app.listen(port, host, () => {
    console.log(`llmizeOFF server running on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`Chat API:     POST http://${host}:${port}/v1/chat/completions`);
  });
}
