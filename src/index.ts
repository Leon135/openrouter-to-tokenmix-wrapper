import { createServer, gracefulShutdown } from "./server.js";

const server = createServer();

process.on("SIGTERM", () => gracefulShutdown(server));
process.on("SIGINT", () => gracefulShutdown(server));
