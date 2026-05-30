export const PORT = parseInt(process.env.PORT ?? "8080", 10);
export const TARGET_HOST = process.env.TOKENMIX_HOST ?? "api.tokenmix.ai";
export const FALLBACK_API_KEY = process.env.TOKENMIX_API_KEY ?? "";
