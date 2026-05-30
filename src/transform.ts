import { log } from "./logger.js";

/**
 * Transforms URL path:
 *  - /api/v1/X  →  /v1/X
 *  - /v1/X      →  /v1/X (passthrough)
 *  - /X         →  /v1/X
 */
export function patchPath(url: string): string {
  const qIndex = url.indexOf("?");
  const path = qIndex === -1 ? url : url.slice(0, qIndex);
  const suffix = qIndex === -1 ? "" : url.slice(qIndex);

  let transformed: string;
  if (path.startsWith("/api/v1/")) {
    transformed = path.replace("/api/v1/", "/v1/");
  } else if (path.startsWith("/v1/")) {
    transformed = path;
  } else {
    transformed = "/v1" + (path.startsWith("/") ? path : "/" + path);
  }

  return transformed + suffix;
}

/**
 * Strips provider prefix from model name.
 */
export function stripProvider(model: string): string {
  const i = model.indexOf("/");
  if (i === -1) return model;
  const stripped = model.slice(i + 1);
  return stripped || model;
}

/**
 * Token mix API requires message content to be non-empty, unless it's
 * an assistant message that includes tool_calls.
 */
function sanitizeMessages(body: Record<string, unknown>): void {
  const messages = body.messages;
  if (!Array.isArray(messages)) return;

  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) continue;

    const message = msg as Record<string, unknown>;
    const content = message.content;
    const role = message.role;
    const toolCalls = message.tool_calls;
    const isEmpty =
      content === null || content === undefined || content === "";

    if (!isEmpty) continue;

    if (role === "assistant" && toolCalls !== undefined) {
      message.content = null;
    } else {
      message.content = ".";
    }
  }
}

/**
 * Parses JSON body, strips model provider prefix if present,
 * and sanitizes messages (fixes empty content).
 * Returns the modified buffer, or the original buffer on parse failure.
 */
export function patchBody(buf: Buffer): Buffer {
  try {
    const json = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
    if (typeof json.model === "string") {
      const before = json.model;
      json.model = stripProvider(before);
      if (json.model !== before) {
        log(`  model: "${before}" → "${json.model}"`);
      }
    }
    sanitizeMessages(json);
    return Buffer.from(JSON.stringify(json), "utf8");
  } catch {
    return buf;
  }
}
