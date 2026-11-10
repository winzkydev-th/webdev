# KPN Phase 1 — 60% development milestone
Date: 2026-11-10

## Measured progress
9 of 14 unweighted development acceptance criteria passed: 64.3%. Reporting milestone: 60%. This measures criteria, not elapsed effort or production readiness. productionReady remains false.

AC-03 quote intake, AC-04 duplicate protection, AC-05 dashboard, AC-06 assignment, AC-07 quotation evidence, AC-08 status audit, AC-09 RBAC, AC-10 notification retry and AC-12 CMS have development evidence. Remaining: AC-01 desktop/mobile acceptance, AC-02 full language acceptance, AC-11 backup/restore, AC-13 SEO and AC-14 full security acceptance. Existing screenshot slices alone do not satisfy their full acceptance.

## Completed this checkpoint
Quotation: immutable revisions and printable HTML, exact money totals, independent approval with recent MFA, approval hash, private delivery proof, atomic Quoted audit. No external message sent. See quotation-checkpoint.md.

CMS: 12 fixed corporate pages x Thai/English/Simplified Chinese; plain-text structured content and SEO title/description; immutable revisions; draft/review/published workflow; independent Owner/Manager publication with recent MFA; explicit unpublish reason; actor/time/reason audit. Editor edits/submits, Manager reviews, Sales/Viewer denied. Old approved content stays visible while a new draft is edited. No unapproved locale fallback. Read-only public database role can access a view containing only published pointers, not private draft tables. Test content is labelled and excluded from live reads. Default mode disabled; live publication requires company approval settings and environment gates.

CMS scope: fixed page content, including News page. Separate news article creation, media library and rich-text editing are not implemented. Rendering treats content as text; no raw HTML is accepted.

## Verification
- Next production build and TypeScript: passed after final source changes.
- Unit/schema suite: 22/22 passed.
- Quotation real PostgreSQL: 12 cases passed (13 reported including parent suite); full HTTP flow and browser Sales/Owner workflow passed.
- Staff regression: 11 cases passed (12 including parent).
- CMS real PostgreSQL: 11 cases passed (12 including parent). Includes 20 concurrent retries, stale edits, all three languages, independent approval/MFA, draft privacy, old publication retention, unpublish history, read-only public credentials, and transaction rollback after injected audit failure.
- CMS HTTP session/CSRF/unknown-field checks passed.
- Browser: Editor saved and submitted Thai synthetic content; Owner approved it; local public page displayed the approved text and test label. Switching to unpublished Chinese showed pending approval rather than Thai content. Final public-view privilege change was verified in PostgreSQL tests.

The two added test checks initially failed because of a SQL test delimiter and an overly narrow expected error message; corrected and the complete CMS suite passed. No production security check was bypassed.

## Pending live dependencies and remaining work
Approved company contact/content/logo/privacy data; real identity provider/MFA, malware scanner and private object storage; public attachments UI/API; operational notification delivery and monitoring; backup/restore drill; reports; staging/production deployment and security review. Current preview uses synthetic identity/scanner/provider data. No real company contact, customer record or commercial quote was invented or published externally. LOGO unchanged.

Local preview processes started for this work were stopped; saved source and synthetic test clusters remain. Resume with npm run build then npm run preview:staff for a fresh synthetic preview. Never use the mock identity provider or clean mock scanner in production.
