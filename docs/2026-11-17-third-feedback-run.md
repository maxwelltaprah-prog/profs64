# Synthetic User Feedback Report: third run (short)

**Target:** https://profs64.vercel.app (live, after the 2026-11-17 deploy)
**Compared with:** `docs/2026-11-17-second-feedback-run.md`

**Read this first.** The scores below are an AI-simulated reassessment by the assistant, not real users and not reviewed
by the owner. Unlike the second run, the four personas were **not** all re-driven end to end. What was run live, in a
real Chromium browser with a throwaway account: one document-chat deck request (chart and process flow), one app request
("a notes app that saves"), the cost hint, the Security page, and the picture attach. Each ran once. Not verified: the
Domains guide in the live browser (covered by a unit test only), a deck with an uploaded picture, the data store with a
real database (migration not applied yet), dark theme, real devices.

## What changed since the second run, and what was seen

| Change                                                                                                                                                                                                                                                                                                       | Seen live?                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Slide visuals: a deck with a bar chart (Oct 10, Nov 20, Dec 35) and a three-step process flow downloaded and opened in LibreOffice; the chart and flow render as native objects with the person's numbers. One overlap (supporting sentence over the flow) was found and fixed afterwards, then re-rendered. | Yes                                                                                                                           |
| Picture attach in the document chat                                                                                                                                                                                                                                                                          | Partly: the chip appears; the upload fails with a clear "database update needed" message because the migration is not applied |
| Built-in data store: the generated notes app imports `db` and says notes are saved; adding a note works in the preview                                                                                                                                                                                       | Partly: it ran on the browser-only fallback, so persistence in the database is unverified                                     |
| Cost and time hint under the project chat box                                                                                                                                                                                                                                                                | Yes (text shown once the reply finishes)                                                                                      |
| Domains: four-step publish guide, replaces "Planned"                                                                                                                                                                                                                                                         | Unit test only                                                                                                                |
| Security page and footer link (200)                                                                                                                                                                                                                                                                          | Yes                                                                                                                           |

Timings in this run: deck 48 s, notes app 52 s (single samples; the second run saw about a minute).

## Reassessed impression (simulated)

| Persona                 | Before | Now | Why                                                                                                                                                            |
| ----------------------- | ------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priya, cafe owner       | 8      | 8   | A publish guide now exists, but there is still no one-click publish or domain.                                                                                 |
| Marcus, product manager | 7      | 8   | Cost expectation is stated up front and there is a plain Security page. Still no company name, contact or reviewed legal pages.                                |
| Dana, developer         | 8      | 8   | Notes app now has real persistence code. GitHub still needs a token and she still cannot see the model.                                                        |
| Sam, analyst            | 7      | 8   | His kind of deck can now carry a real chart, stats, process or timeline and his own pictures. Still no company template or in-browser preview before download. |

Average 7.5 before, 8 now. **This does not reach 10 and should not be read as if it did.**

## What stands between here and 10 (owner or larger work)

1. Company name, contact address and a lawyer-reviewed Terms and Privacy (`NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_LEGAL_REVIEWED`). These cannot be invented.
2. One-click publish: a GitHub OAuth app (or GitHub App) for token-free push, then hosting. Needs the owner to register the app.
3. Apply the new migration so pictures and the data store persist.
4. Preview a document before downloading it, and apply a company template.
5. Measure real credit cost spread with more than one sample per task.
