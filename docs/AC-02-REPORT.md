# AC-02 Full Language Acceptance
Date: 2026-11-10
Result: Passed — development public interface language acceptance (TH/EN/Simplified Chinese). Not approval of corporate translations or live deployment.

Changes: src/lib/i18n.ts; src/lib/quote-copy.ts (extracted existing form copy); src/components/quote-form.tsx; src/app/[locale]/[[...slug]]/page.tsx; src/app/[locale]/not-found.tsx; src/app/[locale]/error.tsx. Localized navigation accessible names, route-art wording, 404 and safe error copy, FCL/LCL explanations and browser constraint-validation text. Staff UI remains Thai as the internal operational UI; no staff service logic changed.

Evidence: AC-02-browser-matrix.json has 72 rendered checks: 12 routes x 3 locales x 390/1440 widths. Each has expected html lang, nonempty title/h1, 3 context-preserving language links, appropriate hreflang and accessible labels, no horizontal overflow. Actual language link clicks preserved /services across TH→EN→ZH. Localized 404 pages observed for all three languages (AC-02-switch-and-notfound.json and screenshots). No automatic fallback to unapproved translations was introduced.

AC-02-form-matrix.json: 12 rendered form states (4 services x 3 languages) at 390px, no overflow. Required-field validation observed in Thai/English/Chinese. This was UI-only test mode with no database, no request accepted and no external email. It is not a substitute Production system. Existing intake persistence tests were not rerun because no intake service changed. Next production build and TypeScript passed. Error-boundary messages exist in all languages; an artificial server failure was not injected into the production-mode preview.

Remaining release dependencies: owner-approved business/privacy/terms text and professional translation review. Existing pages explicitly say awaiting approval. Real customer intake remains closed. These UI results do not certify untranslated/unapproved corporate content as release ready. AC-11/AC-14 unchanged.
