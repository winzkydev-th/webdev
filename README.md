# KPN WAGON LOGISTICS — Phase 1 development

Local development only. Company content/branding is unapproved; live intake is disabled.

## Run and check

Node.js 24+; npm ci; npm test; npm run test:postgres; npm run typecheck; npm run build.

- npm run dev: local website with intake disabled by default.
- npm run preview:test: after build, starts an isolated PostgreSQL 18.6 cluster and loopback-only Next.js preview at http://127.0.0.1:3000/th/request-a-quote. Synthetic data only. No emails. New cluster each launch. Credentials generated in memory. Stop with Ctrl+C. Test data remains under ignored .local/ for diagnosis; it is not a backup and this launcher does not reopen older clusters.
- npm run db:migrate: requires DATABASE_URL for the migration owner. Applies migrations in order with advisory lock and checksums. Intended for a new database or a database previously managed by this runner. A legacy manually-applied schema must be explicitly baselined after review; this script will not adopt it silently.
- npm run test:postgres: starts a separate real PostgreSQL cluster on loopback port 55439. Requires that port free. Data is synthetic and retained under .local/; no Windows service is installed. Test preview uses port 55440 and web port 3000.

## Implemented

Three-language responsive route shell. Four-service synthetic quote form, server validation, bounded JSON streaming, origin/media-type checks, honeypot, durable hashed-contact and global limits, atomic contact/request/cargo/audit/outbox writes. Same key + normalized payload returns original reference, changed payload returns 409. Advisory transaction locks serialize concurrent retries. Client retains only key and payload hash in session storage, retries with the same key after uncertain network outcomes, and prevents repeated clicks while pending. Changing details after an uncertain submission is blocked until the user explicitly starts another request. Only that explicit action creates a new identity.

PostgreSQL migrations include staff/customer/request/quote/CMS/audit tables, initial status/outbox trigger, history protection and Quoted evidence guard. Baseline permission and transition policies are tested but not connected to staff sessions yet. Migration 002 fixes potential future reference truncation in the initial padded default.

GET /api/health is liveness only. It reports the intake mode and does not assert database or notification readiness. POST /api/quotes acknowledges only after commit. Unexpected errors return generic 503 without SQL, secrets or personal details. Notifications now fan out to independent staff/customer jobs. A leased retry worker, frozen provider payload, exponential backoff, timeout, dead-letter and provider-idempotency recovery are implemented and tested with a simulated provider. No real emails have been sent.

## Intake gate

Only explicit synthetic test mode is currently supported: QUOTE_INTAKE_MODE=test, APP_ENV=development, loopback APP_ORIGIN, PRIVACY_NOTICE_VERSION and a >=32-character RATE_LIMIT_SECRET. preview:test sets them in memory automatically. Production/live mode remains closed. Test acknowledgement is not an approved Privacy Notice. Uploaded files remain disabled, not silently discarded.

Company contact details, claims, news and legal pages remain configurable drafts with noindex/robots protection. Domain SEO/hreflang/sitemap needs approved content and production domain before publication. Existing LOGO assets are untouched.

## Security and deployment contracts

Production runtime must not own tables or be a superuser. Integration tests use a separate minimal intake role with only the privileges required to insert requests/outbox/history and maintain rate buckets; they confirm DELETE/TRUNCATE of evidence is denied. A migration owner remains separate. Staff endpoints now enforce database-backed sessions, role/assignment authorization and CSRF. Real company IdP/MFA assurance configuration and staging checks are still required. Test launcher creates only a database-local role in its isolated cluster, not an OS account.

Before live use: approved Privacy Notice/retention/contact routes, multi-layer spam control at the trusted edge, trusted proxy configuration if IP limiting is introduced, secure transport and storage, monitoring, upload quarantine/scan/download authorization, backup/restore drills, operational credentials and staging security checks. Current limiter is contact + global, not a complete internet anti-abuse system. Rate buckets require scheduled expiry maintenance before release. The default 5/contact and 200/global per 15 minutes are development settings awaiting operational review.

Status writes must set app.actor_id/change_reason using SET LOCAL in a server-authorized transaction. Audit row triggers do not protect against a database owner. Assignment, contact activities, status changes and the staff registry now have authorized services and audit. Quotation revisions, independent approval and immutable delivery evidence now have dedicated authorized services.

## Remaining modules

Public attachment API/UI and production private storage/scanner integration; production identity-provider configuration and MFA/recovery policies; production email configuration and worker operations; reports; privacy/retention; backup/restore and monitoring; staging/production. Phase 2 tracking and Phase 3 operations are deferred.

See docs for dated evidence. A passing test slice is not full Phase 1 completion.

## Notification worker (module 3)

- npm run test:notifications starts PostgreSQL on 55441 and uses a mock provider; it never sends external emails.
- notifications:once / notifications:worker require DATABASE_URL, NOTIFICATION_MODE and sender/staff addresses. simulate mode requires APP_ENV=development and sends nothing externally. SIMULATE_NOTIFICATION_FAILURE=true exercises failure.
- resend mode additionally requires NOTIFICATION_TEMPLATES_APPROVED=true, COMPANY_COMMUNICATIONS_APPROVED=true and RESEND_API_KEY. These are disabled/unset by default. No company sender/domain/recipient has been invented or configured. Resend is an optional adapter, not a purchased or selected production provider.
- Delivery uses stable per-recipient event keys and frozen payloads, independent recipient jobs, SKIP LOCKED claims, lease tokens, fenced completion and timeout shorter than the lease. Retry defaults: 8 attempts, exponential delay 30s–1h plus jitter.
- Provider keys are retained for a limited time. Automatic retries stop at 23 hours after the first attempt; older ambiguous deliveries enter dead-letter for reconciliation, rather than risking a duplicate send after the provider dedupe window. A provider acceptance record means accepted by the API, not delivered into the recipient inbox; delivery/bounce webhooks remain pending.
- Completed/failed/expired attempts and sanitized audit codes are retained. Dead-letter review/requeue UI, provider reconciliation, production scheduling and backlog alerts need the staff/operations modules. Do not manually reset old ambiguous jobs without reconciling provider records.
- Worker role needs SELECT on quote_requests/contacts, SELECT+UPDATE on notifications, SELECT+INSERT+UPDATE on notification_attempts and INSERT on audit_logs. Keep it separate from the intake role and migration owner.

## Private attachment backend (module 4)

- npm run test:attachments starts PostgreSQL on 55442 and uses private local objects plus mock scanner verdicts. It also tests ClamAV TCP framing against a synthetic local protocol server. This is not a real malware-engine test.
- Implemented internal services: 15-minute opaque upload capability with only its SHA-256 hash stored in DB; per-request serialized quota of 5 files; upload-key idempotency; <=10 MiB PDF/PNG/JPEG signature/MIME/extension checks; generated object keys; quarantine; bounded scan timeout; scan lease and retry after scanner outage; integrity checks; staff assignment/MFA policy before download; forced download headers; audit.
- Public upload/download routes and UI remain disabled until authenticated staff sessions and real scanner/storage checks are ready. Capability issuance is server-internal only; an eventual route must bind issuance to the just-created request, never to an arbitrary client-supplied request UUID.
- LocalPrivateFileStore is for development only, outside public/. Production requires private object storage, encryption, IAM, antivirus definitions/health checks, size/rate limits at the HTTP layer, backup, retention and quarantine cleanup. Current signature checks are not a complete file parser or content-disarm system.
- Missing scanner, timeout, invalid protocol response and unknown verdict remain quarantined. Infected files are terminally rejected; clean rescans cannot automatically release rejected files. Object-write failure is held for review and never permits download. Pending storage writes from interrupted uploads need reconciliation before release.
- attachments:scan-once / attachments:scan-worker are disabled by default. For a development ClamAV instance on 127.0.0.1:3310, set APP_ENV=development, ATTACHMENT_SCANNER_MODE=clamav-local and DATABASE_URL for a restricted scanner role; the local store root is .local/private-uploads. After 8 scan attempts the worker leaves quarantine for manual review. No scanner was installed as a system service.
- Upload HTTP integration must stream-limit bytes before buffering, validate capability, implement abuse limits and expose only safe metadata. Do not use a clean mock scanner outside tests.

## Staff identity and workspace (modules 5–6)

- npm run preview:staff (after build) starts a fresh synthetic PostgreSQL cluster on 55445, a loopback-only signed mock OIDC provider and the local website on 3000. Choose a synthetic role in the mock page; no real password or MFA device is used. The mock is test code, not a production authentication provider.
- test:staff-auth uses 55443, test:staff-workspace uses 55444. test:staff-http runs against preview:staff and only permits the synthetic-preview banner; it creates synthetic requests and signs its test sessions out. test:staff-disabled runs against an ordinary npm start with auth disabled.
- OIDC requires explicit STAFF_AUTH_ENABLED, STAFF_ORIGIN, STAFF_DATABASE_URL, OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET, OIDC_MFA_ACR_VALUES and a random 32-byte base64 STAFF_SESSION_KEY. HTTP is permitted only for explicitly enabled loopback development tests. Production must use HTTPS and a real provider with verified MFA assurance mapping.
- Provider must support code+PKCE, signed RS256 ID tokens/JWKS, nonce, auth_time/max_age and the agreed ACR policy. State/nonce/signature/issuer/audience/expiry/auth_time checks and single-use login transactions are enforced. Provider roles are ignored. Passwords/enrollment/recovery remain at the IdP.
- Set STAFF_ORIGIN to the public origin without trailing slash. The callback is exactly /staff/auth/callback. Reverse proxies must preserve its expected Host. Forwarded-host headers do not choose the callback origin.
- Register the initial real Owner only with staff:bootstrap and explicit BOOTSTRAP_STAFF_SUBJECT/NAME plus HTTPS OIDC_ISSUER against a migration-owner connection. It refuses if an active Owner exists. No initial production account has been registered.
- Opaque sessions are hashed in the database; idle 30 minutes / hard lifetime 8 hours. High roles need MFA; staff-registry changes need auth_time within 15 minutes. Role/active/identity updates revoke old sessions. Local logout does not sign out of the whole provider; back-channel/provider revocation and lifecycle need verification with the selected IdP.
- Owner/Manager read all operational requests. Sales read/work assigned requests only. Viewer defaults to no global access and can only read permitted rows; additional viewer-grant management is not implemented. Editor cannot read quote operations; its workspace now opens the CMS. Every API resolves the session/role server-side; x-role and client actor IDs do not grant rights.
- Dashboard/Inbox scope totals and rows, support service/status/search/page filters, and private pages are force-dynamic/no-store. Assignment uses optimistic request versions, stores history and revokes old assignee access. Activities/status changes record the actor and time in the same transaction. Quoted/closure rules remain enforced.
- Staff registry supports Owner create/update/disable with audit, session revocation and last-active-Owner protection. It registers an existing IdP Subject; it does not provision the external directory account or reset its credentials.
- Staff runtime is a separate database login from intake and migration owner. See the integration fixture/preview grants for the required table operations; it cannot DELETE/TRUNCATE audit evidence. Production grants and edge controls still require staging review.
- Add scheduled expiry cleanup for staff sessions/login transactions and approved retention before release. No real MFA enrollment, company directory or production domain is configured yet.

## Quotations and CMS (modules 7–8)

See docs/quotation-checkpoint.md and docs/milestone-60.md for evidence and limits. test:quotations uses PostgreSQL 55446; test:content uses 55447. All data is synthetic.

Quotation downloads are immutable approved printable HTML, not server-generated PDF. Delivery recording requires an approved latest revision plus clean same-request private proof; it does not itself send email. Live evidence storage remains gated until the production private object adapter is configured.

CMS_MODE defaults to disabled. test requires APP_ENV=development. live requires staging/production, COMPANY_PUBLICATION_APPROVED=true and approved company settings; test-only revisions cannot publish live. CMS_DATABASE_URL must use a separate read-only login granted SELECT on cms_published_content and system_settings only, not cms_revisions/translations. Staff runtime additionally needs SELECT/INSERT/UPDATE on pages/translations and SELECT/INSERT on cms_revisions/cms_events; no UPDATE/DELETE on revision/event evidence. Existing operational grants still apply. Staff runtime also needs quotation table grants as demonstrated in preview and integration fixtures. Use separate migration owner credentials.

Editor/Owner save new immutable drafts and submit review. Owner/Manager with recent MFA publish independently; self-publication is denied. Each locale is independent. Edits keep the old published pointer until the new review is approved. Unpublish is explicit and audited. Fixed pages, including News, are editable; individual article management/media library remain outside this implemented CMS slice.

Default public pages remain noindex during development. Company content, identity, malware engine, cloud storage, backups, monitoring, production grants and deployment still require acceptance. Current unweighted development criteria: 11/14 (78.6%); not production ready.

## Acceptance 01 / 02 / 13 continuation

AC-01 and AC-02 passed development public-interface acceptance; see docs/AC-01-REPORT.md and docs/AC-02-REPORT.md with recorded evidence in docs/evidence/acceptance-01-02-13. Browser widths were emulated; official business copy and physical-device acceptance remain release checks.

AC-13 remains Pending: no approved company domain. test:seo and test:language exercise only new acceptance logic; test:seo-http checks the ordinary localhost production build with indexing disabled. It makes HTTP requests only to 127.0.0.1:3000. Optional first argument is an evidence JSON path. It never enables a domain or inserts test data.

Before enabling SEO, follow docs/AC-13-REPORT.md. No default production domain. PUBLIC_SITE_URL must exactly match approved system_settings.company value.domain as an HTTPS origin. Domain/SEO/company flags plus live CMS and non-test publication are required. Headers are compiled at build time: rebuild with approved configuration, then verify actual-host directives before launch. Staff/API noindex stays permanent. AC-11/AC-14 remain unaccepted.
