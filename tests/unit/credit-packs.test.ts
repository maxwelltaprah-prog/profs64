import { describe, expect, it } from "vitest";

import { USD_PER_CREDIT } from "@/lib/credits/math";
import { CREDIT_PACKS, creditsPerDollar, packById, PACK_IDS } from "@/lib/credits/packs";

describe("credit packs", () => {
  it("has unique ids, exactly one popular pack and rising value by size", () => {
    expect(new Set(PACK_IDS).size).toBe(CREDIT_PACKS.length);
    expect(CREDIT_PACKS.filter((pack) => pack.popular)).toHaveLength(1);
    const perDollar = CREDIT_PACKS.map(creditsPerDollar);
    for (let i = 1; i < perDollar.length; i += 1) {
      expect(perDollar[i]).toBeGreaterThanOrEqual(perDollar[i - 1] as number);
    }
  });

  it("never sells credits below what they cost to serve", () => {
    const costBasisPerDollar = 1 / USD_PER_CREDIT; // ~33 credits per $1 at cost
    for (const pack of CREDIT_PACKS) {
      expect(pack.priceUsd).toBeGreaterThan(0);
      expect(pack.credits).toBeGreaterThan(0);
      expect(creditsPerDollar(pack)).toBeLessThan(costBasisPerDollar);
    }
  });

  it("looks up by id", () => {
    expect(packById("builder")?.name).toBe("Builder");
    expect(packById("nope")).toBeUndefined();
  });
});
