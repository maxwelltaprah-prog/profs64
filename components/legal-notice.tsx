import { LEGAL } from "@/lib/legal";

// Shown on both legal pages until the operator confirms a lawyer has reviewed them.
export function LegalNotice() {
  if (LEGAL.reviewed) return null;
  return (
    <p className="border-hairline bg-accent-subtle mt-2 rounded-md border px-3 py-2 text-[13px]">
      Beta draft, updated {LEGAL.updated}. These pages are written for the closed beta and are
      awaiting legal review.
    </p>
  );
}

export function ContactLine() {
  return LEGAL.contactEmail ? (
    <>
      write to{" "}
      <a className="text-accent underline underline-offset-2" href={`mailto:${LEGAL.contactEmail}`}>
        {LEGAL.contactEmail}
      </a>
    </>
  ) : (
    <>use Send feedback in the app, or reply to the email that invited you</>
  );
}
