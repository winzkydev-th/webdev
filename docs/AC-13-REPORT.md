# AC-13 SEO Acceptance — Pending actual approved domain
Date: 2026-11-10
Overall result: Pending. Technical preparation and negative runtime checks passed; no Production SEO acceptance claimed.

The owner confirmed there is no approved domain. PUBLIC_SITE_URL remains empty, PUBLIC_SITE_DOMAIN_APPROVED=false, SEO_INDEXING_ENABLED=false. No fictitious company domain or fabricated contact/logo data configured. AC-13 is NOT added to passedDevelopment. AC-11 backup/restore and AC-14 security remain Pending and were not tested or promoted.

## Implementation
Per-route/per-language metadata, self canonical, reciprocal TH/EN/zh-Hans hreflang and Thai x-default where Thai is approved; Open Graph; safe WebPage JSON-LD with no contact/logo claims. Metadata and page share request-local cached CMS reads. Sitemap includes only existing published non-test content from the read-only CMS view, never staff/API routes. No fake last-modified times.

Default noindex remains; robots disallows crawling and sitemap is empty without approval. Future indexing requires APP_ENV=production, CMS_MODE=live, company publication approval, SEO/index/domain flags, a valid HTTPS origin and matching approved company setting value.domain. Every page additionally needs published non-test CMS content before index/follow, alternate links or JSON-LD. Staff/API have permanent noindex headers. Unpublished/missing translations are omitted from hreflang and sitemap. Unknown locale/path produces 404; root redirects to Thai.

## Changed files
- .env.example
- next.config.ts
- package.json (only acceptance commands added)
- src/app/[locale]/[[...slug]]/page.tsx
- src/app/robots.ts
- src/app/sitemap.ts (new)
- src/lib/public-content.ts (shared read-only pool and request-local cache)
- src/lib/public-seo.ts (new)
- src/lib/seo.ts (new)
- tests/seo.acceptance.test.mjs (new)
- tests/seo-http.acceptance.mjs (new)
- tests/language.acceptance.test.mjs (new, AC-02 dictionary completeness evidence)
No database migration, intake, notification, quotation, staff authorization or CMS mutation service changed.

## Verification actually performed
- Next production build/TypeScript passed after source changes.
- 5 new SEO tests passed: flags, placeholder-origin rejection, self canonical, reciprocal alternates, unpublished/test exclusion, unique metadata and safe JSON-LD. Pure tests use explicit fixture values; these are not company domain approval, live content or external deployment. No positive Production indexing result is claimed.
- 1 new language completeness test passed (all public/form text states, locales, service/route keys and no Thai leakage in EN/ZH dictionaries).
- Actual HTTP: 36/36 public URLs returned 200, 36 distinct titles and descriptions, robots meta+header noindex, no invented canonical or schema. robots.txt returned Disallow:/ without a sitemap declaration. sitemap.xml returned an empty URL set. Unknown pages in all three locales and unknown locale returned 404. Staff login and health API retained noindex. Root returned 307 to /th. Full recorded evidence: AC-13-http-evidence.json.
- No previously passed backend suite rerun. Build needed for changed public rendering/configuration; HTTP checks limited to the new SEO path. AC-01/AC-02 screenshots and browser matrices retained.

## Required before changing AC-13 to Passed
1. Owner approves exact HTTPS company origin and business/privacy translations; configure it consistently in deployment and approved company settings, not in test fixtures.
2. Staging validates approved real CMS publication and only the approved environment receives production flags. Rebuild with the same SEO environment because Next response header rules are build-time configuration; changing only runtime flags is insufficient.
3. Verify real HTTPS/DNS, host redirects, rendered canonical/reciprocal hreflang, sitemap URLs and crawl/index directives on the actual approved host; ensure placeholders, test data, private pages and unpublished locales are excluded. Check behavior after unpublish/outage. Do not enable crawler access merely to satisfy a test.
4. Verify domain ownership/Search Console and submit the real sitemap when owner authorizes the live launch. Search ranking/index inclusion is not guaranteed by code tests.

## Reference basis
Next metadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
Next sitemap: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
Google language versions: https://developers.google.com/search/docs/specialty/international/localized-versions
Google noindex: https://developers.google.com/search/docs/crawling-indexing/block-indexing
