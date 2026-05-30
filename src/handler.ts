import * as http from "node:http";
import * as https from "node:https";

import { TARGET_HOST, FALLBACK_API_KEY } from "./config.js";
import { log } from "./logger.js";
import { patchPath, patchBody } from "./transform.js";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, X-Requested-With, Accept, Origin",
  "access-control-max-age": "86400",
};

function addCors(headers: http.OutgoingHttpHeaders): http.OutgoingHttpHeaders {
  return { ...CORS_HEADERS, ...headers };
}

const NOT_SUPPORTED = [
  "/api/v1/generation",
  "/api/v1/keys",
  "/api/v1/responses",
  "/api/v1/messages",
  "/v1/generation",
  "/v1/keys",
];

export const agent = new https.Agent({ keepAlive: true, maxSockets: 64 });

function isUnsupported(pathname: string): boolean {
  return NOT_SUPPORTED.some((prefix) => pathname.startsWith(prefix));
}

export function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  if (!req.url) {
    res.writeHead(400, addCors({ "content-type": "application/json" }));
    res.end(JSON.stringify({ error: "Bad Request", detail: "Missing request URL" }));
    return;
  }

  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const pathname = req.url.split("?")[0];

  if (isUnsupported(pathname)) {
    log(`501 ${method} ${req.url}`);
    res.writeHead(501, addCors({ "content-type": "application/json" }));
    res.end(
      JSON.stringify({
        error: "OpenRouter-specific endpoint, not available on TokenMix.",
      }),
    );
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const bodyBuf = Buffer.concat(chunks) as Buffer;
      let body = bodyBuf;

      const contentType = (Array.isArray(req.headers["content-type"])
        ? req.headers["content-type"][0]
        : req.headers["content-type"] ?? "").toLowerCase();
      if (contentType.includes("application/json") && body.length > 0) {
        body = patchBody(body);
      }

      const targetPath = patchPath(req.url!);

      const headers: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers[key] = value;
        }
      }

      headers["host"] = TARGET_HOST;
      headers["content-length"] = String(body.length);

      const hopByHop = [
        "connection",
        "keep-alive",
        "transfer-encoding",
        "te",
        "upgrade",
        "proxy-connection",
      ];
      for (const h of hopByHop) {
        delete headers[h];
      }

      if (!headers["authorization"] && FALLBACK_API_KEY) {
        headers["authorization"] = `Bearer ${FALLBACK_API_KEY}`;
      }

      log(`→ ${method} ${req.url}  (→ ${targetPath})`);

      const upstream = https.request(
        {
          hostname: TARGET_HOST,
          path: targetPath,
          method,
          headers,
          agent,
        },
        (upRes) => {
          const statusCode = upRes.statusCode ?? 502;
          log(`← ${statusCode} ${method} ${targetPath}`);
          if (statusCode >= 400) {
            const errChunks: Buffer[] = [];
            upRes.on("data", (c: Buffer) => errChunks.push(c));
            upRes.on("end", () => {
              const errBody = Buffer.concat(errChunks).toString("utf8");
              log(`ERR body: ${errBody.slice(0, 1000)}`);
              res.writeHead(statusCode, addCors(upRes.headers));
              res.end(errBody);
            });
          } else {
            res.writeHead(statusCode, addCors(upRes.headers));
            upRes.pipe(res);
          }
        },
      );

      upstream.setTimeout(30_000, () => {
        upstream.destroy();
        log(`TIMEOUT upstream: ${method} ${targetPath}`);
        if (!res.headersSent) {
          res.writeHead(504, addCors({ "content-type": "application/json" }));
          res.end(JSON.stringify({ error: "Gateway Timeout" }));
        } else {
          res.destroy();
        }
      });

      upstream.on("error", (err) => {
        log(`ERR upstream: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, addCors({ "content-type": "application/json" }));
          res.end(JSON.stringify({ error: "Bad Gateway", detail: err.message }));
        } else {
          res.destroy();
        }
      });

      upstream.write(body);
      upstream.end();
    } catch (err) {
      log(`ERR handler: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.writeHead(500, addCors({ "content-type": "application/json" }));
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      } else {
        res.destroy();
      }
    }
  });

  req.on("error", (err) => {
    log(`ERR client: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(400, addCors({ "content-type": "application/json" }));
      res.end(JSON.stringify({ error: "Bad Request", detail: err.message }));
    } else {
      res.destroy();
    }
  });
}
