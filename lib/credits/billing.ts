import { costUsd } from "@/lib/ai/models";
import { addUsage, hasReportedUsage, type TokenUsage } from "@/lib/ai/usage";
import { logger } from "@/lib/security/logger";

import { creditsForCost, estimateTokensFromChars } from "./math";

export type SettleReason = "finish" | "error" | "abort" | "cancel";

/** What one request was charged, or null when nothing was (no usage, or the charge failed). */
export interface SettleResult {
  credits: number;
  inputTokens: number;
  outputTokens: number;
}

export interface DeductInput {
  userId: string;
  amount: number;
  projectId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface BillerOptions {
  userId: string;
  /** The project the work was for; null for the chat agent, which has no project. */
  projectId: string | null;
  requestId: string;
  /** Characters sent to the model on each step; used only if usage is never reported. */
  inputChars: number;
  getModelId: () => string;
  deduct: (
    input: DeductInput,
  ) => Promise<{ charged: number; balanceAfter: number; shortfall: number }>;
}

// Tracks what one chat request has used and bills it exactly once, whichever way it ends:
// normal finish, provider error, the person pressing Stop, or the client disconnecting. The
// first call to settle() wins; later calls do nothing.
export function createBiller(options: BillerOptions) {
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let stepsStarted = 0;
  let stepsEnded = 0;
  let outputChars = 0;
  let stepOutputChars = 0;
  let activity = false;
  let settlement: Promise<SettleResult | null> | null = null;

  return {
    stepStarted() {
      stepsStarted += 1;
      stepOutputChars = 0;
    },
    /** Any content-bearing output from the provider: proof the model call really ran. */
    activitySeen() {
      activity = true;
    },
    textSeen(chars: number) {
      activity = true;
      outputChars += chars;
      stepOutputChars += chars;
    },
    stepEnded(
      stepUsage:
        { inputTokens?: number | undefined; outputTokens?: number | undefined } | undefined,
    ) {
      stepsEnded += 1;
      usage = addUsage(usage, stepUsage);
    },

    settle(
      reason: SettleReason,
      reported?: { inputTokens?: number | undefined; outputTokens?: number | undefined },
    ): Promise<SettleResult | null> {
      settlement ??= (async (): Promise<SettleResult | null> => {
        const authoritative = reported
          ? addUsage({ inputTokens: 0, outputTokens: 0 }, reported)
          : undefined;
        let counted: TokenUsage =
          authoritative && hasReportedUsage(authoritative) ? authoritative : usage;
        let estimated = false;

        if (!hasReportedUsage(counted)) {
          // Nothing reported. If the model call ran (or was cut off by Stop, when the prompt has
          // already been sent), estimate from characters and say so. A provider error before any
          // output is not billed.
          const reached = activity || reason === "abort" || reason === "cancel";
          if (stepsStarted > 0 && reached) {
            counted = {
              inputTokens: estimateTokensFromChars(options.inputChars) * stepsStarted,
              outputTokens: estimateTokensFromChars(outputChars),
            };
            estimated = true;
          }
        } else if (
          stepsStarted > stepsEnded &&
          (activity || reason === "abort" || reason === "cancel")
        ) {
          // A step was cut off (Stop pressed, disconnect, error). Its usage never arrived, so
          // add an estimate for just that step.
          counted = {
            inputTokens: counted.inputTokens + estimateTokensFromChars(options.inputChars),
            outputTokens: counted.outputTokens + estimateTokensFromChars(stepOutputChars),
          };
          estimated = true;
        }

        // A request that never reached the model costs nothing (for example a provider outage).
        if (!hasReportedUsage(counted)) {
          logger.info("billing_skipped_no_usage", { requestId: options.requestId, reason });
          return null;
        }

        if (estimated) logger.warn("usage_estimated", { requestId: options.requestId, reason });

        const model = options.getModelId();
        const usd = costUsd(model, counted.inputTokens, counted.outputTokens);
        const amount = creditsForCost(usd);
        const input: DeductInput = {
          userId: options.userId,
          amount,
          projectId: options.projectId,
          model,
          inputTokens: counted.inputTokens,
          outputTokens: counted.outputTokens,
          costUsd: Number(usd.toFixed(6)),
        };

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            // If the project was deleted while the request ran, the ledger row's project reference
            // would be rejected. The second attempt records the charge without it, so deleting a
            // project mid-request cannot make the request free.
            const result = await options.deduct(
              attempt === 1 ? input : { ...input, projectId: null },
            );
            if (result.shortfall > 0) {
              logger.warn("credit_shortfall", {
                requestId: options.requestId,
                shortfall: result.shortfall,
              });
            }
            logger.info("credits_charged", {
              requestId: options.requestId,
              reason,
              charged: result.charged,
              inputTokens: counted.inputTokens,
              outputTokens: counted.outputTokens,
            });
            return {
              credits: result.charged,
              inputTokens: counted.inputTokens,
              outputTokens: counted.outputTokens,
            };
          } catch (error) {
            logger.error("credit_deduction_failed", {
              requestId: options.requestId,
              attempt,
              error,
            });
          }
        }
        return null;
      })();
      return settlement;
    },
  };
}
