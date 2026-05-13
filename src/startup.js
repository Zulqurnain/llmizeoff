/**
 * cPanel startup file for offl-llama server.
 *
 * Set this as the startup file in cPanel → Setup Node.js App.
 * Reads env from .env file if present, then starts the server.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Load .env
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
}

const { startServer } = require('./dist/server');

startServer({
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOSTNAME || '0.0.0.0',
  apiKey: process.env.OFFL_LLAMA_API_KEY || undefined,
  modelPath: process.env.OFFL_LLAMA_MODEL_PATH || undefined,
  contextSize: parseInt(process.env.OFFL_LLAMA_CONTEXT_SIZE || '2048', 10),
});
