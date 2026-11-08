import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

// A deterministic stand-in for the real model, used by tests and e2e (AI_MODEL_MODE=fake). It
// reads the last person message and plays a fixed script, so no test ever spends money or
// depends on a provider.

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

const HERO = `export function Hero() {
  return (
    <section className="px-6 py-24">
      <h1 className="text-4xl font-semibold">Small batch coffee, roasted weekly</h1>
      <p className="mt-4 max-w-xl text-lg">Visit us for espresso, filter coffee and fresh pastries.</p>
    </section>
  );
}
`;

const APP = `import { Hero } from "./components/Hero";

export default function App() {
  return (
    <main>
      <Hero />
    </main>
  );
}
`;

type Prompt = Array<{ role: string; content: unknown }>;

function lastUserText(prompt: Prompt): string {
  for (const message of [...prompt].reverse()) {
    if (message.role !== "user" || !Array.isArray(message.content)) continue;
    const text = message.content
      .map((part: unknown) =>
        typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("");
    // The first user message of every request is the project snapshot; skip it.
    if (!text.startsWith("Project snapshot.")) return text.toLowerCase();
  }
  return "";
}

const toolCall = (id: string, name: string, input: unknown) => ({
  type: "tool-call" as const,
  toolCallId: id,
  toolName: name,
  input: JSON.stringify(input),
});

const textChunks = (id: string, text: string) => [
  { type: "text-start" as const, id },
  { type: "text-delta" as const, id, delta: text },
  { type: "text-end" as const, id },
];

export interface FakeModelOptions {
  /** Delay between streamed chunks, for tests that press Stop. */
  chunkDelayMs?: number;
  /** When true, the provider reports no token usage at all. */
  omitUsage?: boolean;
}

// A real provider's HTTP stream ends with an error when the request is aborted; the simulated
// stream does not look at the signal, so this wrapper does, which lets tests press Stop.
function endWhenAborted<T>(source: ReadableStream<T>, signal: AbortSignal | undefined) {
  if (!signal) return source;
  const reader = source.getReader();
  return new ReadableStream<T>({
    start(controller) {
      const fail = () => {
        controller.error(signal.reason ?? new DOMException("Aborted", "AbortError"));
        void reader.cancel().catch(() => undefined);
      };
      if (signal.aborted) fail();
      else signal.addEventListener("abort", fail, { once: true });
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
}

export function createFakeModel(options: FakeModelOptions = {}) {
  return new MockLanguageModelV4({
    provider: "fake",
    modelId: "fake-model",
    doStream: async ({ prompt, abortSignal }) => {
      const messages = prompt as Prompt;
      const afterTools = messages[messages.length - 1]?.role === "tool";
      const request = lastUserText(messages);
      const reported = (input: number, output: number) =>
        options.omitUsage
          ? {
              inputTokens: {
                total: undefined,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: undefined, text: undefined, reasoning: undefined },
            }
          : usage(input, output);

      let chunks: unknown[];
      if (afterTools) {
        chunks = [
          ...textChunks("t1", "Done. I updated the project files."),
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: reported(1800, 40),
          },
        ];
      } else if (request.includes("traversal")) {
        chunks = [
          toolCall("c1", "write_file", { path: "../evil.ts", content: "x" }),
          toolCall("c2", "write_file", { path: "/etc/passwd.txt", content: "x" }),
          toolCall("c3", "read_file", { path: "%2e%2e/secret.ts" }),
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: reported(1500, 90),
          },
        ];
      } else if (request.includes("coffee")) {
        chunks = [
          ...textChunks("t0", "I will add a hero section."),
          toolCall("c1", "write_file", { path: "src/components/Hero.tsx", content: HERO }),
          toolCall("c2", "write_file", { path: "src/App.tsx", content: APP }),
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: reported(1500, 420),
          },
        ];
      } else if (request.includes("long")) {
        const words = Array.from({ length: 60 }, (_, i) => `word${i} `);
        chunks = [
          { type: "text-start", id: "t1" },
          ...words.map((delta) => ({ type: "text-delta", id: "t1", delta })),
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: reported(1500, 200),
          },
        ];
      } else {
        chunks = [
          ...textChunks("t1", "Tell me what you would like to build and I will create the files."),
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: reported(1400, 25),
          },
        ];
      }

      return {
        stream: endWhenAborted(
          simulateReadableStream({
            chunks: chunks as never[],
            chunkDelayInMs: options.chunkDelayMs ?? null,
          }),
          abortSignal,
        ),
      };
    },
  });
}
