// Credit top-up packs. These are the amounts shown on the pricing page. There is no checkout yet:
// a person joins a waitlist and nothing is charged. One credit covers $0.03 of model usage
// (lib/credits/math.ts), so every pack is priced above that cost to leave a margin, with a larger
// bonus on bigger packs. Prices are the owner's to change; edit this table and nothing else needs
// to change.

export interface CreditPack {
  id: "starter" | "builder" | "studio";
  name: string;
  /** Price in whole US dollars. */
  priceUsd: number;
  /** Credits granted by the pack. */
  credits: number;
  blurb: string;
  popular?: boolean;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 5,
    credits: 120,
    blurb: "A handful of builds or a long chat session.",
  },
  {
    id: "builder",
    name: "Builder",
    priceUsd: 20,
    credits: 560,
    blurb: "Enough to take a project from idea to finished app.",
    popular: true,
  },
  {
    id: "studio",
    name: "Studio",
    priceUsd: 50,
    credits: 1500,
    blurb: "For heavy building, long chats and lots of documents.",
  },
];

export const PACK_IDS = CREDIT_PACKS.map((pack) => pack.id);

export function packById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}

// Credits per dollar, shown so the volume bonus is visible. Always above the ~33 credits/$ cost
// basis so a pack never sells credits below what they cost to serve.
export function creditsPerDollar(pack: CreditPack): number {
  return Math.round(pack.credits / pack.priceUsd);
}
