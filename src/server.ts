import * as http from "node:http";

import { log } from "./logger.js";
import { PORT, TARGET_HOST, FALLBACK_API_KEY } from "./config.js";
import { handleRequest, agent } from "./handler.js";

function apiKeyStatus(): string {
  return FALLBACK_API_KEY
    ? "set via env"
    : "not set (client must provide)";
}

export function createServer(): http.Server {
  const server = http.createServer(handleRequest);

  server.requestTimeout = 120_000;
  server.headersTimeout = 10_000;
  server.timeout = 0;

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║   OpenRouter → TokenMix Proxy                    ║
╠══════════════════════════════════════════════════╣
║  Listening:  http://localhost:${String(PORT).padEnd(16)}
║  Upstream:  https://${String(TARGET_HOST).padEnd(24)}
║  API key:   ${apiKeyStatus().padEnd(32)}
║ 
║  /chat/completions  →  /v1/chat/completions
║  /api/v1/*          →  /v1/*
╚══════════════════════════════════════════════════╝
`);
  });

  return server;
}

let shuttingDown = false;

export function gracefulShutdown(server: http.Server): void {
  if (shuttingDown) return;
  shuttingDown = true;

  log("Shutting down...");
  server.close(() => {
    agent.destroy();
    log("Closed.");
  });

  setTimeout(() => {
    log("Forced shutdown after timeout");
    agent.destroy();
    process.exit(1);
  }, 6_000).unref();
}
