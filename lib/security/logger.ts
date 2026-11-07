import { redact } from "./redact";

type Level = "debug" | "info" | "warn" | "error";

const ORDER = new Map<string, number>([
  ["debug", 10],
  ["info", 20],
  ["warn", 30],
  ["error", 40],
]);

// LOG_LEVEL: debug | info | warn | error | silent. Defaults to info; tests run silent.
function threshold(): number {
  const configured = process.env["LOG_LEVEL"];
  if (configured === "silent") return Number.POSITIVE_INFINITY;
  return (configured ? ORDER.get(configured) : undefined) ?? 20;
}

export interface LogFields {
  requestId?: string;
  [key: string]: unknown;
}

// One JSON object per line. Every field passes through redact() so prompts, file contents,
// tokens and emails cannot leak even if a caller passes them by mistake.
export function log(level: Level, event: string, fields: LogFields = {}): void {
  if ((ORDER.get(level) ?? 20) < threshold()) return;
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...(redact(fields) as Record<string, unknown>),
  });
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => log("debug", event, fields),
  info: (event: string, fields?: LogFields) => log("info", event, fields),
  warn: (event: string, fields?: LogFields) => log("warn", event, fields),
  error: (event: string, fields?: LogFields) => log("error", event, fields),
};
