export function log(...args: unknown[]): void {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}]`, ...args);
}
