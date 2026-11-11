# AC-14 Local security controls and deployment prerequisites

These instructions describe the implemented controls. They do not authorize production, external integrations, secret changes, or acceptance approval.

## Migrations and least privilege

Apply `database/009_security.sql` with the existing migration runner and migration-owner role in an authorized isolated environment first. Do not rewrite applied migrations 001–008. The fixture runtime grants are in `scripts/staff-preview.mjs`; they are examples for tests, not evidence of production provisioning. Runtime requires SELECT/INSERT/UPDATE on security_rate_buckets and security_event_windows; SELECT/INSERT on security_events, security_alerts and security_alert_acknowledgements; existing audit INSERT permissions remain required. Immutable table triggers prohibit modifying history. Provision real grants through the existing deployment process, after approval.

## Login budget and trusted edge

The browser cookie is signed using the existing server session key. Per-browser limit is 6 starts per 60 seconds. Per-network limit is 120 per 60 seconds. A denied browser does not consume additional network budget. Rejected requests do not extend the window. There is no username-based lockout. Limits use atomic PostgreSQL transactions, independent of process restart. IPv4 /24 and canonical IPv6 /64 network grouping reduces address rotation; shared NAT may affect legitimate users. Coordinate actual values with approved edge and IdP controls before production.

Outside explicit local mode, login requires STAFF_EDGE_KEY (32-byte base64) and signed trusted-edge headers. The edge must discard all incoming x-kpn-client-* headers and generate:

- x-kpn-client-ip: actual validated client IP
- x-kpn-client-time: current Unix milliseconds, 13 digits, within 30 seconds
- x-kpn-client-signature: base64url HMAC-SHA256 over `timestamp + '\n' + method + '\n' + pathname + '\n' + IP`, with STAFF_EDGE_KEY decoded from base64

Only the approved edge may reach the application directly. Never expose the key to client-side code or logs. Unsigned/missing/expired attestations fail closed. This protocol still needs real edge integration/replay/load testing; it does not provide complete distributed attack protection. Failed IdP password attempts must also be controlled and observed at the real IdP. No real IdP has been tested.

## CSP

HTML receives a cryptographically random nonce for each response, forwarded to Next rendering. Responses are private/no-store. JSON-LD uses the same nonce. Quotation HTML uses a fixed CSS hash. Inline script without a nonce and inline style attributes are disallowed. Do not add unsafe-inline or unsafe-eval to make a test pass. Use the production build for local QA; development debugging may conflict with strict CSP.

CSP reports accept bounded 8 KiB bodies, at most four reports per request, only report JSON types and matching origin when supplied, with cross-site fetch rejection. The per-process reporter cap is 60 requests/minute. Reports are untrusted: only fixed directive/source/blocked classifications reach diagnostic logs; raw URL, script sample, body, cookies or secrets are not retained. These reports do not prove an attack and may be forged or suppressed by rate saturation. Independent edge health monitoring remains required. Browser tooling injected shadow styles produced warnings in the local browser; investigate in a normal browser without weakening the policy.

The `/security-test/csp` harness is gated by APP_ENV=development, loopback hostname and CSP_LOCAL_TEST=true. The default is false and it must remain disabled in deployments. It deliberately includes a forbidden inline script to demonstrate enforcement. A browser overlay style warning is not counted as a successful application security test.

## Detection and internal review

Fixed one-minute windows generate at most one event and one alert per kind/route/window. Thresholds: login_success 20, login_rate 3, login_failure 3, access_denied 5, csrf_denied 3, invalid_request 10, csp_violation 3. No arbitrary messages or identities are accepted by this telemetry function. Denial telemetry remains independent of permission decisions. A storage failure emits only a fixed code/kind/route; it must be monitored by an approved operations system.

Owner/Manager with a verified MFA claim can view `/staff/security` and acknowledge alerts. Acknowledgement is append-only and idempotent with an audit record. Local mock claims do not constitute real MFA verification. The inbox is durable internal notification; no email/SMS/external alert delivery was tested or enabled.

Before production, approve retention/cleanup of expired rate buckets, ledger capacity and monitoring, on-call ownership, external alert routing and retry/dead-letter behavior. Configure and test actual services only after owner authorization. Do not use this runbook as acceptance evidence for services not tested.

## Evidence and real integration gates

Consult `KPN-AC-14-Security-Report.md` and `evidence/ac14-remediation/manifest.json`. Unit/integration/HTTP/browser results are separated from review findings. Real IdP/MFA, malware engine/definitions/EICAR, TLS and current dependency advisories remain NOT TESTED. The owner explicitly declined external advisory requests; no npm/OSV connection is allowed without new approval. AC-11 retains its four production prerequisites and AC-13 awaits an approved domain. AC-14 remains Pending Acceptance.
