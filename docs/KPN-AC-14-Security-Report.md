# KPN WAGON — AC-14 Security Remediation Report
วันที่ 11 พฤศจิกายน 2569 (Asia/Bangkok) | Baseline c30c0c4be54e4ab3946f03db0ee0ec2502139bd3

**AC-14: PENDING ACCEPTANCE — เจ้าของยังไม่อนุมัติ / Production Security Readiness: NOT READY**
สถานะรวม 12/14 (85.7%) ไม่เพิ่มจำนวนเกณฑ์ที่ผ่าน AC-13 ยัง Pending โดเมนจริง AC-11 คง APPROVED — LOCAL DEVELOPMENT DRILL ONLY ไม่ใช่ Production Acceptance

## ขอบเขตและการรักษางานเดิม
สำรองก่อนเปลี่ยนด้วย tag backup/before-ac14-remediation และ bundle KPN-Git-Before-AC14-Remediation.bundle ที่ตรวจสอบแล้ว ไม่ amend/เปลี่ยน baseline c30c0c4 หรือ b60a8ac เพิ่ม migration 009 แบบ additive ไม่แก้ migration เดิม ใช้เฉพาะ PostgreSQL และ signed synthetic OIDC บน loopback ข้อมูลสังเคราะห์ ไม่มีข้อมูลลูกค้าจริง ไม่มีส่งอีเมลจริง ไม่มีเชื่อมบริการภายนอกหรือ Deployment
หลักฐาน AC14R-original-integrity.json เปรียบเทียบ Git blob ของ migration 001–008, AC-11 และ package files ตรง baseline ทุกไฟล์ ไม่ใช่การอ้างว่า fingerprint ฐาน Production แล้ว ฐานเดิมที่เจ้าของใช้ไม่ได้ถูกเปิดเพื่อเขียนโดยชุดทดสอบนี้
รายงานเดิมเก็บไว้ใน Git c30c0c4 และ outputs/KPN-AC-14-Security-Report-before-remediation-c30c0c4.md

## Medium findings
| Finding | ผลทดสอบจริง | ข้อจำกัดและสถานะตรวจรับ |
|---|---|---|
| M-01 Login rate limiting | PASS เฉพาะ local: browser 6/60 วินาที, network 120/60 วินาที; cooldown หมดแล้วกลับใช้ได้; browser อื่นยังใช้ได้; rotate client ถูก network จำกัด; 15 concurrent อนุญาต 6; ปฏิเสธก่อน discovery | Implemented / pending owner review. ไม่มี account-name lock; network /24 และ IPv6 /64 มีผลต่อผู้ใช้ร่วม NAT; distributed edge และ real IdP ต้องทดสอบก่อน Production |
| M-02 CSP | PASS เฉพาะกรณี local: nonce ใหม่ทุก response, script tags มี nonce ตรงกัน, ไม่มี unsafe-inline/eval; browser self-test 3 ครั้ง allowed=true และ blocked=null; quoted HTML ใช้ CSS hash | Implemented / pending owner review. มี style-src-elem warning ระหว่าง browser tooling; DOM พบ browser comments overlay มี shadow style 1 จุด แต่ app style elements 0 จึงยังไม่รับรองว่าไม่มี app violation ทุกกรณี ต้องยืนยันอีกครั้งใน browser ปกติและ TLS staging ห้ามผ่อน CSP เพื่อทำให้เงียบ |
| M-03 Detection & alerting | PASS เฉพาะ durable internal inbox: login failure/rate/success burst, unauthorized/CSRF/invalid requests/CSP; alert ตาม threshold; Owner/Manager + MFA claim; ack idempotent พร้อม audit; append-only และ rollback; authorization ยังคงปฏิเสธเมื่อ logging ล้มเหลว | Implemented / pending owner review. External alert delivery และ IdP/edge signal monitoring NOT TESTED ไม่มีการส่งแจ้งเตือนออกภายนอก |

ไม่พบ Critical/High ที่ยืนยันได้ในขอบเขตที่ทดสอบและ code review รอบนี้ ไม่ใช่คำรับรองว่าไม่มีช่องโหว่ในระบบทั้งหมด Medium เดิมทั้ง 3 อยู่สถานะรอตรวจรับหลังแก้ไข ไม่ลบประวัติหรือปรับลดความรุนแรง

## รายการตรวจความปลอดภัยทั้งหมด
PASS ในตารางหมายถึงเฉพาะกรณีทดสอบ local ที่ระบุ ผลเดิมอ้างรายงาน baseline โดยไม่รันซ้ำหากไม่เกี่ยวกับการแก้ไข

| # | รายการ | ผล / หลักฐาน / ความเสี่ยงคงเหลือ |
|---|---|---|
| 1 | SQL Injection | PASS local: targeted security suite ทดสอบ literal metacharacters, role-scoped search, invalid IDs; ไม่มี broadening ข้อมูล |
| 2 | XSS | PASS local encoding/CMS literal script text และ browser CSP self-test; inherited quotation escaping tests ผ่าน; ไม่ใช่ exhaustive stored/DOM XSS assurance |
| 3 | CSRF / Session | PASS local: cross-session/cross-site CSRF rejected; cookies, callback, revocation/session checks ใน auth suite; Production session/TLS policy NOT TESTED |
| 4 | Brute force | PASS local M-01 ตามข้างต้น; real IdP brute-force/distributed edge NOT TESTED |
| 5 | Authentication / MFA | PASS signed mock OIDC signature/state/PKCE/MFA-claim checks; **real MFA NOT TESTED** |
| 6 | RBAC / horizontal access | PASS local integration และ HTTP: roles, assignment/reassignment revocation, Owner/Manager security inbox; production provisioning NOT TESTED |
| 7 | Upload / Malware | PASS existing local upload/quarantine/download control regression; scanner verdict/protocol เป็นตัวจำลอง **real engine/EICAR/definitions NOT TESTED** |
| 8 | API / rate limits | PASS local origin/type/size/shape/mass-assignment/rate checks; CSP endpoint 403/415/400/413/204; anonymous staff APIs 401; edge/load/slow-body resilience NOT TESTED |
| 9 | HTTPS / Headers | PASS local nonce CSP + nosniff/DENY/no-store; **HTTPS/TLS/certificate/expiry/redirect/HSTS NOT TESTED** ไม่มีโดเมนที่อนุมัติ |
| 10 | Secrets / Environment | Code review: new security events accept no arbitrary text/secrets, CSP diagnostics fixed enums only, edge key server-side; existing heuristic baseline evidence retained. Full secret inventory/rotation/KMS NOT TESTED |
| 11 | PostgreSQL privileges | PASS local restricted fixture denies audit modification/schema CREATE; append-only security events/alerts/acks; Production network/TLS/provisioning NOT TESTED |
| 12 | Audit / Alert | PASS durable local ledger, threshold/inbox/ack/rollback; notification retry regressionผ่านกับ providerจำลอง; real external routing/on-call/health monitoring NOT TESTED |
| 13 | Current dependency advisories | **NOT TESTED** เจ้าของไม่อนุญาตเชื่อมภายนอก ไม่เรียก npm audit/OSV ไม่ใช้ offline zero เป็น PASS |
| 14 | Backup security | ใช้ AC-11 ที่อนุมัติเฉพาะ local และ read-only integrity evidence เดิม ไม่รัน restore ซ้ำ ไม่แก้ Backup; reboot/24h/off-machine/key recovery ยังเป็น Production blockers |

## ผลทดสอบและหลักฐาน
หลักฐานอยู่ docs/evidence/ac14-remediation/ พร้อม manifest.json (SHA-256) และ outputs/ ชื่อเดียวกัน

| ชุด | ผลที่เครื่องมือรายงาน | หลักฐาน |
|---|---|---|
| Unit ล่าสุด | 31 passed, 0 failed | AC14R-unit-final.log |
| Remediation integration + pure checks | 9 passed, 0 failed (รวม parent) | AC14R-remediation.log / AC14R-remediation-evidence.json |
| Security SQL/CSRF/API targeted | 7 passed, 0 failed (รวม parent) | AC14R-security-final.log |
| Staff auth / workspace | 11 / 12 passed, 0 failed | AC14R-staff-auth.log / AC14R-staff-workspace.log |
| Quotation / CMS | 13 / 12 passed, 0 failed | AC14R-quotations.log / AC14R-content.log |
| Notification / attachments regression | 10 / 11 passed, 0 failed | AC14R-notifications.log / AC14R-attachments.log |
| TypeScript / Build | PASS | AC14R-typecheck.log / AC14R-build.log |
| Staff HTTP / quotation HTTP | PASS actual Next HTTP with synthetic signed IdP; delivery proof saved, document hash matched, status Quoted, externalMessagesSent=0 | AC14R-staff-http-final.log / AC14R-quotation-http-final.log |
| CSP / safe HTTP paths | PASS: nonce rotation 4 HTML routes, matching script nonces, 5 report input cases, 4 anonymous API families, 3 sensitive paths | AC14R-http-csp-final.json |
| Public desktop/mobile | 72 route-language-viewport observations, no overflow/missing h1 in inspected cases (12 routes × 3 locales × 2 sizes) | AC14R-public-browser-matrix.json |
| Conditional service forms | 12 browser selections TH/EN/ZH; EN air request saved KPN-6 in synthetic preview | AC14R-form-conditional-final.json / AC14R-form-submit-final.jpg |
| CMS / alert inbox UI | Synthetic draft→review→publish, literal script text; Owner alert acknowledgement; desktop/mobile screenshots | AC14R-cms-published-csp.jpg / AC14R-security-inbox-desktop.jpg / AC14R-security-inbox-mobile.jpg |
| CSP enforcement / tooling observation | 3 actual browser checks allowed script ran, injected inline did not; browser overlay shadow-style observation preserved | AC14R-csp-final.json / AC14R-csp-overlay-observation.json |

จำนวน test รวม parent ตาม Node ไม่ใช่จำนวนช่องโหว่หรือเปอร์เซ็นต์ coverage ตัวจำลองไม่ถูกนับเป็น real integration
มี preview restart attempt 1 ครั้งไม่สำเร็จเพราะ preview เดิมยังใช้งานอยู่; หลังตรวจ session แล้ว HTTP/browser ใช้ preview เดิมที่เป็น synthetic เท่านั้น ไม่ถือ attempt ที่ล้มเหลวเป็น PASS

## สิ่งที่ต้องเตรียมก่อนตรวจรับ/Production
1. Real MFA: เจ้าของเลือก/อนุมัติ IdP ของบริษัทและ test tenant/accounts; ทดสอบ MFA enrolment, bypass/claim policy, recovery, logout/revocation และ provisioning ห้ามสมัครบริการเอง
2. Malware engine: เลือก local ClamAV หรือบริการที่อนุมัติ; ต้องอนุมัติการรับ engine/definitions จากภายนอกก่อน ทดสอบ safe file และ standard EICAR, engine failure/timeout/quarantine ด้วยข้อมูลทดสอบ Engine จริงยังไม่มีหลักฐาน
3. HTTPS/TLS: เตรียม host/certificate ที่อนุมัติและแยก staging ทดสอบ chain/hostname/expiry/redirect/HSTS/cookie/edge ไม่มีการติดตั้ง trust root หรือ bypass browser warnings ในรอบนี้
4. Advisories: รออนุมัติส่งชื่อ/เวอร์ชัน packages ไป registry หรือรับฐาน advisory แบบ offline ที่มีวันปรับปรุงและแหล่งตรวจสอบได้ ไม่มีข้อมูลปัจจุบันจึง NOT TESTED
5. Trusted edge: ต้องลบ header จาก client และลง HMAC attestation จริง เก็บ STAFF_EDGE_KEY ใน secret store; ป้องกัน network cap abuse/NAT impact และ distributed volumetric load ที่ edge/IdP ทดสอบจริงก่อนใช้ Production
6. Monitoring: local inbox เป็น durable evidence ต้องตั้งผู้รับผิดชอบ/ระยะเวลาตอบสนอง/retention/capacity/cleanup ของ buckets และ real external alerting ที่อนุมัติ; reporter limit 60 requests/min/process ป้องกัน amplification แต่ attacker อาจทำให้ reports ช่วงนั้นตกหล่น ต้องตรวจ health ที่ edge
7. Backup: automatic after reboot, continuous ≥24h, off-machine copy, independent encryption key recovery ตามเงื่อนไข AC-11 เดิม
8. CSP: ยืนยัน browser ปกติที่ไม่มี tooling overlay และ real staging; CSP_LOCAL_TEST ต้อง false ใน deployment, route test เปิดเฉพาะ APP_ENV=development + loopback + explicit flag

## ไฟล์เปลี่ยนแปลง
รายการ source/config/tests ก่อนเพิ่มรายงานและ evidence (เอกสารและ evidence เพิ่มใน commit เดียวกัน):
- .env.example
- database/009_security.sql
- docs/AC-14-LOCAL-SECURITY-RUNBOOK.md
- docs/evidence/ac14-remediation/AC14R-attachments.log
- docs/evidence/ac14-remediation/AC14R-build.log
- docs/evidence/ac14-remediation/AC14R-cms-published-csp.jpg
- docs/evidence/ac14-remediation/AC14R-content.log
- docs/evidence/ac14-remediation/AC14R-csp-browser-current.json
- docs/evidence/ac14-remediation/AC14R-csp-browser-selftest.json
- docs/evidence/ac14-remediation/AC14R-csp-final.json
- docs/evidence/ac14-remediation/AC14R-csp-overlay-observation.json
- docs/evidence/ac14-remediation/AC14R-csp-selftest.jpg
- docs/evidence/ac14-remediation/AC14R-form-conditional-final.json
- docs/evidence/ac14-remediation/AC14R-form-submit-final.jpg
- docs/evidence/ac14-remediation/AC14R-http-csp-final.json
- docs/evidence/ac14-remediation/AC14R-notifications.log
- docs/evidence/ac14-remediation/AC14R-original-integrity.json
- docs/evidence/ac14-remediation/AC14R-public-browser-matrix.json
- docs/evidence/ac14-remediation/AC14R-quotation-http-final.log
- docs/evidence/ac14-remediation/AC14R-quotations.log
- docs/evidence/ac14-remediation/AC14R-remediation-evidence.json
- docs/evidence/ac14-remediation/AC14R-remediation.log
- docs/evidence/ac14-remediation/AC14R-security-final.log
- docs/evidence/ac14-remediation/AC14R-security-inbox-desktop.jpg
- docs/evidence/ac14-remediation/AC14R-security-inbox-mobile.jpg
- docs/evidence/ac14-remediation/AC14R-staff-auth.log
- docs/evidence/ac14-remediation/AC14R-staff-http-final.log
- docs/evidence/ac14-remediation/AC14R-staff-workspace.log
- docs/evidence/ac14-remediation/AC14R-typecheck.log
- docs/evidence/ac14-remediation/AC14R-unit-final.log
- docs/evidence/ac14-remediation/AC14R-unit.log
- docs/evidence/ac14-remediation/manifest.json
- next.config.ts
- scripts/staff-preview.mjs
- src/app/(entry)/layout.tsx
- src/app/(entry)/security-test/csp/route.ts
- src/app/(staff)/layout.tsx
- src/app/(staff)/staff/auth/callback/route.ts
- src/app/(staff)/staff/auth/login/route.ts
- src/app/(staff)/staff/auth/logout/route.ts
- src/app/(staff)/staff/content/[pageId]/[locale]/page.tsx
- src/app/(staff)/staff/security/page.tsx
- src/app/[locale]/[[...slug]]/page.tsx
- src/app/[locale]/layout.tsx
- src/app/api/security/csp/route.ts
- src/app/api/staff/security/route.ts
- src/app/globals.css
- src/components/security-actions.tsx
- src/components/staff-shell.tsx
- src/lib/content-http.ts
- src/lib/csp.ts
- src/lib/login-protection.ts
- src/lib/quotation-document.ts
- src/lib/quotation-http.ts
- src/lib/security-events.ts
- src/lib/security-inbox.ts
- src/lib/staff-auth.ts
- src/lib/staff-http.ts
- src/proxy.ts
- tests/content.integration.mjs
- tests/quotations.integration.mjs
- tests/security-http.acceptance.mjs
- tests/security-remediation.integration.mjs
- tests/security-remediation.test.mjs
- tests/security.acceptance.integration.mjs
- tests/staff-workspace.integration.mjs

เอกสารเพิ่ม/อัปเดต: docs/KPN-AC-14-Security-Report.md, docs/AC-14-LOCAL-SECURITY-RUNBOOK.md, docs/acceptance-status.json, docs/evidence/ac14-remediation/*; รายงานฉบับส่งเจ้าของใน outputs/KPN-AC-14-Security-Report.md

## ข้อเสนอเพื่อเจ้าของตรวจสอบ
ให้ตรวจการแก้ M-01/M-02/M-03 เฉพาะ local จากหลักฐานที่แนบ ยังไม่อนุมัติ AC-14 เอง และยังไม่พร้อม Production ไม่เริ่ม AC-13/Deployment/บริการภายนอก รอเจ้าของอนุมัติขอบเขตและ prerequisites ของ real integrations ก่อนดำเนินงานต่อ
