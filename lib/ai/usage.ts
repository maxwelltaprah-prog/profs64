export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface MaybeUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

const clean = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export function addUsage(total: TokenUsage, step: MaybeUsage | undefined): TokenUsage {
  return {
    inputTokens: total.inputTokens + clean(step?.inputTokens),
    outputTokens: total.outputTokens + clean(step?.outputTokens),
  };
}

// True when the provider reported at least one token count; used to decide whether to estimate.
export function hasReportedUsage(usage: TokenUsage): boolean {
  return usage.inputTokens > 0 || usage.outputTokens > 0;
}
