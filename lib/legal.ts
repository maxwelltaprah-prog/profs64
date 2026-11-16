// Details the legal pages show, set per deployment so nothing is invented in code. All optional:
// when unset, the pages say who to contact in plain words and keep the "pending review" notice.
export const LEGAL = {
  /** Who operates the service, e.g. the company name. */
  operator: process.env["NEXT_PUBLIC_LEGAL_ENTITY"] || null,
  /** Where people write about privacy and terms. */
  contactEmail: process.env["NEXT_PUBLIC_CONTACT_EMAIL"] || null,
  /** Set to "true" once a lawyer has reviewed both pages; removes the draft notice. */
  reviewed: process.env["NEXT_PUBLIC_LEGAL_REVIEWED"] === "true",
  updated: "16 November 2026",
} as const;
