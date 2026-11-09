// The only texts the chat stream ever sends as an error. The server picks one (never raw provider
// text, which can echo prompt content or account details) and the browser shows it as is.
export const STREAM_ERRORS = {
  generic:
    "The assistant ran into a problem. Your credits were charged only for what was used. Try again.",
  unavailable:
    "The assistant is unavailable right now because Buildr's AI provider limit was reached. Nothing was charged for this message. Try again later.",
  busy: "The AI provider is busy right now. Nothing was charged for this message. Try again in a minute.",
} as const;

const KNOWN = new Set<string>(Object.values(STREAM_ERRORS));

export function isKnownStreamError(text: string): boolean {
  return KNOWN.has(text);
}
