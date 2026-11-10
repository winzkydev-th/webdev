# KPN WAGON — AC-14 Security Report
วันที่: 10 พฤศจิกายน 2569 (Asia/Bangkok)
Baseline: b60a8accdebb8998976953160fbfad94b1c40120. ก่อนเริ่มสำรอง tag backup/before-ac14 และ KPN-Git-Before-AC14.bundle ซึ่ง verify ผ่าน

## ผลสรุปเพื่อให้เจ้าของตรวจรับ
**AC-14: NOT PASSED / รอแก้ไขและทดสอบส่วนที่ยังขาด ไม่ใช่ Production Security Acceptance**
Production Security Readiness: **NOT READY**. จำนวน Acceptance ฝั่งพัฒนายังคง 12/14 (85.7%); ไม่มีการเพิ่ม AC-14 เป็น Passed. AC-13 ยัง Pending โดเมนจริง

ในกรณีทดสอบและ Code Review ที่ทำรอบนี้ ยังไม่พบช่องโหว่ที่ยืนยันได้ระดับ Critical/High; ข้อความนี้ไม่ใช่การยืนยันว่าไม่มีช่องโหว่ดังกล่าวในทุกส่วน โดยเฉพาะ dependency advisories, real IdP/MFA, malware engine และระบบ HTTPS/Production ซึ่งยังไม่ทดสอบครบ หากพบ Critical/High ในงานถัดไปต้องหยุดรายงานก่อนแก้ตามคำสั่งเจ้าของ

บันทึก AC-11 ตามคำอนุมัติเป็น **APPROVED — LOCAL DEVELOPMENT DRILL ONLY** ใน docs/AC-11-OWNER-APPROVAL.md และ acceptance-status.json ข้อจำกัดก่อน Production: backup หลัง reboot; ทดสอบต่อเนื่องอย่างน้อย 24 ชั่วโมง; สำเนานอกเครื่อง; ระบบสำรอง/กู้ Encryption Key. ไม่มีการยกระดับเป็น Production Acceptance

## ขอบเขตที่อนุญาตและสิ่งที่ทำจริง
ตรวจเฉพาะ repository เดิมกับข้อมูลสังเคราะห์ใหม่ใน PostgreSQL loopback ที่แยกจากข้อมูลเดิม ชุดทดสอบใช้พอร์ต 55441/55442/55443/55444/55446/55447 และ 55450; ผู้ให้บริการ OIDC จำลองลงนาม RS256 จริงบน loopback ส่วน scanner/provider verdicts เป็นตัวจำลอง ไม่ใช่บริการจริง ไม่มีข้อมูลลูกค้าจริง ไม่มีการโจมตีภายนอก ไม่ติดตั้งบริการใหม่ ไม่ซื้อ/เชื่อมบริการ และไม่ Deployment

ทดสอบ HTTP เว็บไซต์ปกติที่ 127.0.0.1:3000 โดยปิด staff/intake/CMS ที่ยังไม่มีการตั้งค่าจริง และทดสอบ browser output encoding ของ quotationHtml/safeJsonLd ผ่าน harness สังเคราะห์พอร์ต 55451 เซิร์ฟเวอร์และคลัสเตอร์ทดสอบที่เปิดในรอบนี้ปิดหลังตรวจ ไม่เริ่มเว็บไซต์บนฐานที่กู้คืน ไม่รัน AC-11 ซ้ำ

ผลทดสอบจริงแยกจาก Code Review ในตารางต่อไปนี้ PASS หมายถึงเฉพาะกรณี/สภาพแวดล้อมที่ระบุ; FAIL คือพบการควบคุมที่ยังไม่ครบตามเป้าหมาย; NOT TESTED คือยังไม่มีหลักฐานทดสอบส่วนนั้น ระดับความรุนแรงใช้กับข้อค้นพบ ไม่ใส่ Critical/High/Medium/Low ให้รายการที่ยังไม่พบข้อบกพร่องหรือยังทดสอบไม่ได้โดยไม่มีเหตุรองรับ

## รายการตรวจสอบทั้งหมด 14 หัวข้อ
| # | หัวข้อ | ผลในขอบเขตนี้ | ความรุนแรงข้อค้นพบ | ทดสอบจริง | Code Review / ข้อจำกัด |
|---|---|---|---|---|---|
| 1 | SQL Injection | PASS — local cases | — | input ที่มี SQL metacharacters ถูกเก็บเป็น literal; search ไม่ขยาย scope; UUID payload ปฏิเสธ; จำนวนแถวคงตามคาด | ทบทวน parameterized queries และ allowlisted SQL fragments ใน intake/staff/quotation/CMS ไม่ใช่การพิสูจน์ทุก payload ที่เป็นไปได้ |
| 2 | XSS | PASS — tested output sinks | — | browser แสดง payload เป็นข้อความ; quotation มี script=0/img=0/event attributes=0; JSON-LD มีเพียง application/ld+json 1 ตัว executable script=0; title ไม่ถูกเปลี่ยน | ตรวจ JSX text rendering, escape ในเอกสาร และ safeJsonLd; ไม่ได้ทดสอบ stored XSS ผ่านการเผยแพร่ CMS จริงทุกหน้าหรือ rich-text/media ที่ยังไม่ทำ |
| 3 | CSRF / Session Hijacking | PASS — local controls; actual stolen-device scenario NOT TESTED | — | ข้าม origin/session CSRF ถูก 403; forged/missing session ถูก 401; callback replay/tampered cookie/nonce/signature/issuer/audience/expiry ถูกปฏิเสธ; idle/hard expiry/logout/role revocation ผ่าน | Cookie HttpOnly/SameSite และ Secure/__Host ใน HTTPS config; ไม่มีการขโมย session จริงหรือทดสอบเครื่องผู้ใช้ที่ถูก compromise และไม่รับรองว่า bearer token ที่ถูกขโมยใช้ไม่ได้ก่อน revoke |
| 4 | Brute Force / Login Rate | FAIL — layered protection incomplete | Medium M-01 | เพดาน login 100 ครั้ง/15 นาทีทำให้ครั้งเกินได้ 429 และไม่สร้าง transaction ใหม่ | bucket เป็น global ร่วมกัน และ provider discovery เกิดก่อน limiter; password brute force/lockout ของ IdP จริง NOT TESTED |
| 5 | Authentication / MFA | PASS — signed local OIDC tests; real provider NOT TESTED | — | code+PKCE, RS256/JWKS validation, state/nonce/auth_time และการปฏิเสธ Owner/Manager ที่ไม่มี ACR ที่กำหนดผ่าน | ACR ในตัวจำลองไม่ใช่ MFA challenge จริง; enrollment/recovery/provider policy/revocation ต้องทดสอบกับผู้ให้บริการที่เจ้าของอนุมัติ |
| 6 | RBAC / Cross-user access | PASS — local scoped cases | — | forged role ไม่เพิ่มสิทธิ์; Sales/Viewer เห็นเฉพาะงานที่มอบหมาย; Editor เข้า operations ไม่ได้; มอบหมายใหม่ตัดสิทธิ์เดิม; แยกผู้ทำ/ผู้อนุมัติราคาและ CMS; fresh MFA/last owner ผ่าน | Production role mapping/SQL grants จริงยังต้องตรวจในสภาพแวดล้อมเป้าหมาย |
| 7 | Upload / Malware Scanning | PASS — validation/quarantine; real malware scan NOT TESTED | — | ไฟล์ผิดชนิด/ขนาด/ชื่อ, quarantine, scanner timeout/unavailable, rejected verdict, hash mismatch, expired scan lease และ quota race ปิดการปล่อยไฟล์ได้; download authorization ผ่าน | signature checks ไม่ใช่ full parser/CDR; verdict/protocol server เป็นตัวจำลอง ไม่มี real ClamAV engine/EICAR/definitions/health test และ public upload ยังปิด |
| 8 | API / Rate Limiting | PASS — local rejection cases; edge abuse coverage NOT TESTED | — | cross-origin 403, content type 415, oversized 413, malformed JSON 400, mass assignment 422, prototype action 400, contact limiter 429; ไม่มีข้อมูลเพิ่มหลังถูกจำกัด | global/contact limiter ไม่ใช่ per-client trusted-edge protection; slow-body/concurrency/exhaustion/load attacks ไม่ได้รันเพื่อไม่สร้างผลกระทบ |
| 9 | HTTPS / Security Headers | FAIL — CSP incomplete; HTTPS NOT TESTED | Medium M-02 | HTTP 12 จุด: nosniff, DENY, referrer policy, permissions policy, no x-powered-by, ไม่มี CORS wildcard; sensitive file probes 403/404; staff APIs ปิดเป็น 503 และคืนเพียง safe code | CSP ไม่มี default-src/script-src; HTTP loopback ไม่มี HSTS ตามหลักฐาน ไม่ได้ตรวจจริง TLS/certificate/proxy/redirect/HSTS บน host ที่อนุมัติ ห้ามตีความ local HTTP ว่าผ่าน HTTPS |
| 10 | Secrets / Environment | PASS — limited heuristic; full credential review NOT TESTED | — | สแกนไฟล์ที่ติดตามใน Git 115 ไฟล์ตาม pattern ไม่พบ private-key/common-token/literal DB password หรือ sensitive NEXT_PUBLIC reference; HTTP ปิด .env/.git/source/package file probes | มีเพียง .env.example ในการตรวจนี้; heuristic ไม่รับประกันตรวจพบ secret ทุกชนิด ไม่มีการอ่าน/หมุนเวียน Production secrets หรือ KMS/rotation test |
| 11 | PostgreSQL Access Control | PASS — fixture runtime; Production policy NOT TESTED | — | restricted runtime ถูกปฏิเสธ DELETE/UPDATE audit และ CREATE TABLE (42501); worker ลบคำขอ/audit ไม่ได้; public CMS role อ่าน private drafts ไม่ได้ | เป็น grants ในฐานทดสอบ ไม่ใช่การรับรอง Production network isolation/TLS/role provisioning หรือสิทธิ์ migration owner |
| 12 | Audit Logs / Alerts | PASS — integrity; FAIL — security monitoring readiness | Medium M-03 | audit/assignment/status/approval append-only และ rollback เมื่อเขียน audit ไม่ครบผ่าน; notification retry/lease/dedupe/dead-letter ผ่านกับ provider จำลอง | ไม่มีหลักฐาน end-to-end security alerting; callback log เป็น safe code แต่ failed/denied API events ไม่ครบใน durable security ledger; IdP/edge monitoring ยังไม่เชื่อม |
| 13 | Dependency Vulnerability Scan | NOT TESTED — current advisories | — | npm audit --offline --ignore-scripts --json รันและคืน zero แต่ไม่ใช่ security scan ที่รับรองได้ | ตรวจ source npm ในเครื่อง audit-report.js พบ offline=true จะ return null ก่อนขอ advisory จึงไม่นับผล zero เป็น PASS; ไม่ส่ง dependency metadata ไป npm/OSV/บริการอื่นเพราะยังไม่อนุมัติ |
| 14 | Backup Security | PASS — approved local artifacts; disaster recovery NOT TESTED | — | อ่าน cipher hash/manifest hash ตรง AC-11; ACL vault/keys ยัง protected; อาศัยผล Restore/wrong-key/corruption จาก AC-11 ที่เจ้าของอนุมัติ โดยไม่รันซ้ำ | ปกป้องเฉพาะ local scope; reboot/24h/off-machine/key recovery ยังเป็นข้อบังคับก่อน Production ไม่มีการแก้ backup implementation |

## ชุดทดสอบจริงและหลักฐาน
| ชุดทดสอบ | ผลที่ Node รายงาน | หลักฐาน |
|---|---:|---|
| staff-auth | 11 passed / 0 failed | AC-14-staff-auth-test.log |
| staff-workspace | 12 passed / 0 failed | AC-14-staff-workspace-test.log |
| attachments | 11 passed / 0 failed | AC-14-attachments-test.log |
| quotations | 13 passed / 0 failed | AC-14-quotations-test.log |
| content | 12 passed / 0 failed | AC-14-content-test.log |
| notifications | 10 passed / 0 failed | AC-14-notifications-test.log |
| targeted | 7 passed / 0 failed | AC-14-targeted-test.log |

ตัวเลขด้านบนรวม parent tests ตามรูปแบบของ Node ไม่ใช่จำนวนช่องโหว่หรือเปอร์เซ็นต์ความครอบคลุม ทวนชุดเดิมเฉพาะที่มีเหตุผลตรงกับ AC-14 ไม่รัน build หรือชุด UI/ภาษา/SEO ที่ไม่เกี่ยวข้องซ้ำ

Additional evidence:
- AC-14-targeted-evidence.json: 6 กลุ่มโจมตีเฉพาะ SQL/CSRF/API/login/SQL privilege
- AC-14-xss-browser-evidence.json และ AC-14-xss-quotation.jpg: DOM/ภาพจาก browser จริงของเอกสารสังเคราะห์
- AC-14-http-and-secret-evidence.json: 12 HTTP probes, headers และ heuristic source scan ไม่พิมพ์ค่า credentials
- AC-14-backup-review-evidence.json: read-only hash/ACL ของ Backup ที่อนุมัติแล้ว
- AC-14-dependency-audit-offline.json: เก็บเพื่อแสดงข้อจำกัด ไม่ใช่หลักฐานว่าไม่มี dependency vulnerabilities

## ข้อค้นพบที่ต้องแก้ก่อน Production — ยังไม่ได้แก้ในรอบนี้
### M-01 — Login throttling แบบ global และงาน discovery ก่อนจำกัด (Medium)
อ้างอิง src/lib/staff-auth.ts:23–27. Runtime ยืนยัน 429 เมื่อ bucket ถึง 100; Code Review ยืนยัน bucket เดียวสำหรับทุกผู้ใช้และ provider discovery มาก่อน ผลคือผู้ไม่เข้าสู่ระบบอาจใช้โควตาร่วมจนผู้ใช้ปกติเริ่ม login ไม่ได้ในช่วงหน้าต่างนั้น และคำขอที่ควรถูกจำกัดยังทำงาน provider discovery ก่อน ไม่ได้รัน load/DoS หรือโจมตี IdP จริง และยังไม่พิสูจน์การล้มทั้งระบบ จึงไม่อ้างระดับ High จากสิ่งที่ไม่ได้วัด

แผนเสนอ: วาง preflight rate limiting ก่อน discovery; ใช้ layered trusted-edge/client/global limits ที่ไม่ให้ client key ชี้นำสิทธิ์; ยืนยัน password/MFA brute-force controls ที่ IdP; ทดสอบว่า client เดียวไม่กินโควตาทุกคน และ request เกินไม่แตะ discovery พร้อม audit ที่ไม่เก็บ credential. ต้องตกลง proxy/client identity policy ก่อน implementation

### M-02 — CSP ยังไม่จำกัดแหล่งสคริปต์ (Medium)
อ้างอิง next.config.ts:11 และ header จริงในหลักฐาน ไม่มี default-src/script-src แม้มี frame-ancestors/object-src/base-uri/form-action จึงขาดแนวป้องกันซ้อนสำหรับ script injection ไม่พบ XSS ที่ทำงานได้ใน sink ที่ตรวจ และไม่ได้อ้างว่าการไม่มี CSP ทำให้ bypass authentication ได้

แผนเสนอ: ออกแบบ nonce/hash-based CSP ให้เข้ากับ Next.js และทั้ง public/staff layouts; ทดลอง Report-Only ในพื้นที่ที่อนุมัติก่อน enforce; ทดสอบ hydration/forms/print/download/JSON-LD และยืนยันไม่มีการเพิ่ม unsafe-eval หรือผ่อนนโยบายเพียงเพื่อให้ผ่าน ส่วน TLS/HSTS ต้องกำหนดและทดสอบตาม deployment ที่อนุมัติ ไม่เปิดจากผล HTTP loopback

### M-03 — การตรวจจับและแจ้งเตือน security events ยังไม่พร้อม (Medium)
อ้างอิง staff-auth.ts, staff-http.ts, callback route และ notification worker. มี business audit/append-only และ safe callback error code แต่ยังไม่มีหลักฐานการรวม failed authentication/authorization/CSRF/rate-limit events และการส่ง alert ไปถึงผู้รับที่อนุมัติ ข้อนี้เป็นช่องว่างการตรวจจับ/ปฏิบัติการ ไม่ใช่การยืนยันว่า audit ธุรกิจถูกแก้ไขได้

แผนเสนอ: กำหนด event taxonomy/retention, บันทึก event แบบ redacted และไม่ให้ผู้โจมตีเติม log จนทรัพยากรหมด; ตั้ง threshold และทดสอบ alert delivery/retry/reconciliation กับปลายทางที่เจ้าของอนุมัติ ไม่ตั้งปลายทางสมมติหรือส่งข้อความออกในรอบนี้

## ความเสี่ยงและงานค้างก่อน Production
1. แก้ M-01/M-02/M-03 ตามแผนที่อนุมัติและเก็บ regression/security evidence ใหม่เฉพาะจุด ไม่ลดมาตรฐานเพื่อให้ผ่าน
2. ขออนุมัติวิธีตรวจ advisory ปัจจุบัน: อาจอนุญาตส่งเฉพาะ package names/versions ไป registry advisory หรือใช้ฐาน advisory ที่จัดเตรียมแบบ offline แล้ว ต้องไม่ส่ง source/secrets/customer data และต้องไม่สรุปว่าปลอดช่องโหว่จาก npm offline zero
3. ทดสอบ real IdP/MFA assurance, recovery/disable/revocation กับบัญชีทดสอบที่ได้รับอนุญาต; ห้ามแทนด้วย ACR จำลองแล้วนับเป็น Production MFA
4. ทดสอบ malware engine จริง ความทันสมัย definitions, scanner health/outage, safe test samples และ private object authorization ก่อนเปิด public upload
5. ยืนยัน HTTPS/TLS/proxy/Host/HSTS, network isolation, real SQL grants, secrets lifecycle และ monitoring บน environment ที่เจ้าของอนุมัติ ใช้ข้อมูลทดสอบ ไม่มีการอ้างว่า domain/Production ตรวจแล้ว
6. ปิดเงื่อนไข AC-11 ที่อนุมัติเฉพาะ local ทั้ง 4 ข้อ; ยังไม่ถือว่า Backup รองรับเครื่องเสีย/profile สูญหายหรือสำเนานอกเครื่อง
7. ห้ามเปิด live intake/uploads/issuance/indexing/Production deployment เพื่อให้รายงานดูครบ ขณะนี้หลาย gate ยังปิดโดยเจตนาและเป็นข้อจำกัดความพร้อม ไม่ใช่หลักฐานผ่านระบบจริง

## ไฟล์ที่สร้างหรือแก้ไข
Modified: docs/acceptance-status.json — บันทึกคำอนุมัติ AC-11 และสถานะ AC-14 ไม่ผ่าน/รอ review เท่านั้น
Created: docs/AC-11-OWNER-APPROVAL.md; tests/security.acceptance.integration.mjs; tests/security-render-preview.mjs; tests/security-http.acceptance.mjs; docs/KPN-AC-14-Security-Report.md; docs/evidence/ac14/* (logs/JSON หลักฐาน).
Outputs: KPN-AC-14-Security-Report.md, logs/JSON ที่ระบุ, XSS screenshot และ KPN-Git-Before-AC14.bundle. Temporary probe helpers อยู่ใน workspace work/; ไม่เพิ่ม production dependency

ไม่มีการแก้ src/, next.config.ts, package manifests, database migrations, encryption/backup implementation หรือโค้ดระบบธุรกิจเพื่อปิดข้อค้นพบ ในการพัฒนาตัวทดสอบ HTTP ครั้งแรกคาด safe error code ของระบบปิดไว้แคบเกินไป จึงแก้ assertion ให้ตรวจ 503 และ body เพียง safe allowlisted code ที่ตรงพฤติกรรมจริง ไม่ได้ผ่อนการตรวจสิทธิ์หรือแก้ระบบให้ผ่าน

## จุดหยุดและการอนุมัติ
การประเมินรอบนี้เสร็จในขอบเขต local ที่ทำได้ แต่ **ไม่เสนออนุมัติ AC-14 เป็น Passed** ให้เจ้าของตรวจรายงานและอนุมัติแผนแก้/ทดสอบส่วนที่ขาดก่อนเริ่มขั้นต่อไป ไม่ Deployment ไม่ซื้อหรือเชื่อมบริการ และไม่เริ่มงานอื่น. AC-11 ยังคง APPROVED — LOCAL DEVELOPMENT DRILL ONLY; AC-13 Pending; จำนวน Passed development ยังคง 12/14
