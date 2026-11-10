# AC-01 Desktop / Mobile Acceptance
Date: 2026-11-10
Result: Passed — development public website viewport acceptance. Production release acceptance is not implied.

Baseline Git: 4e8e9fdb370078734d7a8f518af19d7ee5598220, tag backup/milestone-60-before-acceptance. Repository created because no Git repository existed. No runtime data, credentials, .local or node_modules committed.

Changed: src/app/globals.css; src/app/[locale]/[[...slug]]/page.tsx. Enlarged header links to >=44x44 CSS pixels; long text wraps; visible keyboard focus; correct company brand accessible name; keyboard skip focuses main. Existing architecture and service workflows unchanged.

Evidence: AC-01-browser-matrix.json, 48 actual rendered browser checks (12 Thai public routes at 320,390,768,1440 CSS-pixel widths), no horizontal overflow, exactly one h1 and visible main, all header links >=44x44. Screenshots ac01-home-{320,390,768,1440}.jpg. Staff login checked at 320, no overflow; screenshot ac01-staff-login-320.jpg. Enter on skip link focused #content. Production build/TypeScript passed.

Scope and limits: desktop browser viewport emulation, not physical iOS/Android certification. Approved corporate content is still pending; placeholders remain explicitly labelled. Staff authenticated workflow evidence remains in the earlier staff report and quotation report; those operations were not rerun. Real identity, live uploads and actual quotation delivery remain separate release dependencies. No synthetic data was used as Production data; ordinary disabled-intake website was used for this check. AC-02 will extend all-route checks to EN/ZH. No AC-11/AC-14 decision made.
