import { describe, expect, it, vi } from "vitest";

import { costUsd, DEFAULT_MODEL, priceFor } from "@/lib/ai/models";
import { addUsage, hasReportedUsage } from "@/lib/ai/usage";
import { createBiller, type DeductInput } from "@/lib/credits/billing";
import {
  creditsForCost,
  estimateTokensFromChars,
  MIN_CHARGE_CREDITS,
  USD_PER_CREDIT,
} from "@/lib/credits/math";

describe("creditsForCost", () => {
  it("is 1 credit per $0.03, rounded up to two decimals", () => {
    expect(USD_PER_CREDIT).toBe(0.03);
    expect(creditsForCost(0.03)).toBe(1);
    expect(creditsForCost(0.0301)).toBe(1.01);
    expect(creditsForCost(0.0228)).toBe(0.76);
    expect(creditsForCost(0.0229)).toBe(0.77);
  });

  it("does not let floating point push exact values up a cent", () => {
    expect(creditsForCost(0.09)).toBe(3);
    expect(creditsForCost(0.06)).toBe(2);
    expect(creditsForCost(0.15)).toBe(5);
  });

  it("charges at least the minimum, including for zero, negative and invalid cost", () => {
    expect(creditsForCost(0.000001)).toBe(MIN_CHARGE_CREDITS);
    expect(creditsForCost(0)).toBe(MIN_CHARGE_CREDITS);
    expect(creditsForCost(-1)).toBe(MIN_CHARGE_CREDITS);
    expect(creditsForCost(Number.NaN)).toBe(MIN_CHARGE_CREDITS);
  });

  it("never rounds a cost down to less than itself", () => {
    for (let usd = 0.0005; usd < 0.5; usd += 0.00137) {
      expect(creditsForCost(usd) * USD_PER_CREDIT).toBeGreaterThanOrEqual(usd - 1e-9);
    }
  });
});

describe("prices", () => {
  it("uses $1.40 in and $4.40 out per million tokens for the default model", () => {
    expect(DEFAULT_MODEL.id).toBe("z-ai/glm-5.2");
    expect(costUsd(DEFAULT_MODEL.id, 1_000_000, 0)).toBeCloseTo(1.4, 10);
    expect(costUsd(DEFAULT_MODEL.id, 0, 1_000_000)).toBeCloseTo(4.4, 10);
  });

  it("gives a believable cost for a typical request", () => {
    // About 12k tokens of context and 1.5k of output across a few steps.
    const credits = creditsForCost(costUsd(DEFAULT_MODEL.id, 12_000, 1_500));
    expect(credits).toBeGreaterThan(0.5);
    expect(credits).toBeLessThan(1.5);
  });

  it("bills an unknown model at the default prices rather than for free", () => {
    expect(priceFor("somebody/else").id).toBe(DEFAULT_MODEL.id);
  });
});

describe("usage helpers", () => {
  it("ignores missing, negative and non-finite counts", () => {
    expect(
      addUsage({ inputTokens: 1, outputTokens: 2 }, { inputTokens: undefined, outputTokens: -5 }),
    ).toEqual({
      inputTokens: 1,
      outputTokens: 2,
    });
    expect(
      addUsage({ inputTokens: 0, outputTokens: 0 }, { inputTokens: Number.NaN, outputTokens: 3.9 }),
    ).toEqual({
      inputTokens: 0,
      outputTokens: 3,
    });
    expect(hasReportedUsage({ inputTokens: 0, outputTokens: 0 })).toBe(false);
  });

  it("over-estimates tokens from characters", () => {
    expect(estimateTokensFromChars(0)).toBe(0);
    expect(estimateTokensFromChars(300)).toBe(100);
    expect(estimateTokensFromChars(301)).toBe(101);
  });
});

function setup(inputChars = 3000) {
  const deduct = vi.fn(async (input: DeductInput) => ({
    charged: input.amount,
    balanceAfter: 10,
    shortfall: 0,
  }));
  const biller = createBiller({
    userId: "u1",
    projectId: "p1",
    requestId: "r1",
    inputChars,
    getModelId: () => DEFAULT_MODEL.id,
    deduct,
  });
  return { biller, deduct };
}

describe("createBiller", () => {
  it("bills reported usage from every step once", async () => {
    const { biller, deduct } = setup();
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 1500, outputTokens: 420 });
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 1800, outputTokens: 40 });
    await biller.settle("finish", { inputTokens: 3300, outputTokens: 460 });

    expect(deduct).toHaveBeenCalledTimes(1);
    const call = deduct.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      userId: "u1",
      projectId: "p1",
      model: "z-ai/glm-5.2",
      inputTokens: 3300,
      outputTokens: 460,
    });
    expect(call?.costUsd).toBeCloseTo(costUsd(DEFAULT_MODEL.id, 3300, 460), 6);
    expect(call?.amount).toBe(creditsForCost(costUsd(DEFAULT_MODEL.id, 3300, 460)));
  });

  it("settles only once however many paths report the end", async () => {
    const { biller, deduct } = setup();
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 1000, outputTokens: 100 });
    await Promise.all([biller.settle("finish"), biller.settle("abort"), biller.settle("error")]);
    await biller.settle("cancel");
    expect(deduct).toHaveBeenCalledTimes(1);
  });

  it("bills tokens used so far when the person presses Stop mid-step", async () => {
    const { biller, deduct } = setup(3000);
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 1500, outputTokens: 400 });
    biller.stepStarted();
    biller.textSeen(600); // partial second step, never reported
    await biller.settle("abort");

    const call = deduct.mock.calls[0]?.[0];
    // 1500 reported + 1000 estimated input; 400 reported + 200 estimated output.
    expect(call?.inputTokens).toBe(2500);
    expect(call?.outputTokens).toBe(600);
  });

  it("estimates from characters when the provider reports nothing", async () => {
    const { biller, deduct } = setup(3000);
    biller.stepStarted();
    biller.textSeen(900);
    biller.stepEnded({ inputTokens: undefined, outputTokens: undefined });
    await biller.settle("finish");
    const call = deduct.mock.calls[0]?.[0];
    expect(call?.inputTokens).toBe(1000);
    expect(call?.outputTokens).toBe(300);
    expect(call?.amount).toBeGreaterThanOrEqual(MIN_CHARGE_CREDITS);
  });

  it("charges nothing when the model was never reached", async () => {
    const { biller, deduct } = setup();
    await biller.settle("error");
    expect(deduct).not.toHaveBeenCalled();
  });

  it("retries a failed deduction once, then gives up without throwing", async () => {
    const deduct = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ charged: 1, balanceAfter: 1, shortfall: 0 });
    const biller = createBiller({
      userId: "u",
      projectId: "p",
      requestId: "r",
      inputChars: 10,
      getModelId: () => DEFAULT_MODEL.id,
      deduct,
    });
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 10, outputTokens: 10 });
    await biller.settle("finish");
    expect(deduct).toHaveBeenCalledTimes(2);

    const failing = vi.fn().mockRejectedValue(new Error("db down"));
    const second = createBiller({
      userId: "u",
      projectId: "p",
      requestId: "r",
      inputChars: 10,
      getModelId: () => DEFAULT_MODEL.id,
      deduct: failing,
    });
    second.stepStarted();
    second.stepEnded({ inputTokens: 10, outputTokens: 10 });
    await expect(second.settle("finish")).resolves.toBeUndefined();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("still charges if the project was deleted mid-request by retrying without the project", async () => {
    const deduct = vi
      .fn()
      .mockRejectedValueOnce(new Error("foreign key violation"))
      .mockImplementationOnce(async (input: DeductInput) => ({
        charged: input.amount,
        balanceAfter: 1,
        shortfall: 0,
      }));
    const biller = createBiller({
      userId: "u",
      projectId: "p",
      requestId: "r",
      inputChars: 10,
      getModelId: () => DEFAULT_MODEL.id,
      deduct,
    });
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 100, outputTokens: 10 });
    await biller.settle("finish");
    expect(deduct.mock.calls[0]?.[0].projectId).toBe("p");
    expect(deduct.mock.calls[1]?.[0].projectId).toBeNull();
  });

  it("bills the model that actually answered", async () => {
    let model = "z-ai/glm-5.2";
    const deduct = vi.fn(async (input: DeductInput) => ({
      charged: input.amount,
      balanceAfter: 1,
      shortfall: 0,
    }));
    const biller = createBiller({
      userId: "u",
      projectId: "p",
      requestId: "r",
      inputChars: 0,
      getModelId: () => model,
      deduct,
    });
    biller.stepStarted();
    biller.stepEnded({ inputTokens: 1_000_000, outputTokens: 0 });
    model = "deepseek/deepseek-v3.2";
    await biller.settle("finish");
    expect(deduct.mock.calls[0]?.[0].model).toBe("deepseek/deepseek-v3.2");
    expect(deduct.mock.calls[0]?.[0].costUsd).toBeCloseTo(0.29, 6);
  });
});
