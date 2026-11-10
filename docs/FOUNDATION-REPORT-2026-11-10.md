# KPN WAGON LOGISTICS — รายงาน Foundation

วันที่ 10 พฤศจิกายน 2026 (ประเทศไทย)

เริ่มพัฒนาจริงที่ `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web` บนเครื่อง Windows ของผู้ใช้ ตรวจพบโฟลเดอร์จริงและเขียนไฟล์ใหม่ได้ ไม่ได้แก้ไขหรือลบไฟล์ใน `LOGO` ซึ่งมีภาพอยู่ในโฟลเดอร์ย่อย โลโก้หน้าเว็บเป็น monogram ชั่วคราวที่สร้างด้วยข้อความ ยังไม่ใช่ไฟล์โลโก้ทางการที่อนุมัติแล้ว

## สิ่งที่ทำแล้ว

- Next.js 16.4.6 / React / TypeScript พร้อม lockfile และคำสั่งพัฒนา สร้างเว็บ และทดสอบ
- โครงเว็บครบ 12 เส้นทางต่อภาษา ไทย อังกฤษ จีนตัวย่อ รวม 36 หน้า ไทยเป็นภาษาเริ่มต้น เปลี่ยนภาษาโดยคงเส้นทางเดิม
- รูปลักษณ์น้ำเงิน #0B1F45 ทอง #C9A34A ขาว #F5F7FA; หน้าแรก บริการ และ placeholder สำหรับเนื้อหาที่รอบริษัทอนุมัติ
- responsive layout, skip link, focus indicator, semantic headings และภาษาเอกสาร TH / EN / zh-Hans
- โครงกฎตรวจข้อมูล 4 บริการ กฎสิทธิ์และงานที่รับผิดชอบ เงื่อนไข MFA สำหรับ Owner/Manager และวงจรสถานะ
- migration PostgreSQL สำหรับผู้ใช้ ลูกค้า ผู้ติดต่อ คำขอ สินค้า ผู้รับผิดชอบ ประวัติติดต่อ ไฟล์แนบ ใบเสนอราคา/ฉบับแก้ไข ประวัติสถานะ outbox การแจ้งเตือน CMS สื่อ audit และ settings
- unique constraint สำหรับเลขอ้างอิงและ idempotency key; ประวัติเริ่มต้นและ outbox สร้างใน transaction เดียวกับคำขอ
- ประวัติสถานะป้องกัน UPDATE/DELETE ผ่าน trigger; Quoted ต้องมีราคาอนุมัติ ไฟล์สถานะ clean และหลักฐานส่ง
- พื้นที่ตั้งค่าข้อมูลบริษัทที่ยังไม่ยืนยันเป็น null และสถานะอนุมัติเป็น false
- ปิดรับคำขอจริงด้วย HTTP 503, noindex และ robots ปิด crawl เพื่อไม่รับข้อมูลลูกค้าก่อนพร้อม

## หลักฐานทดสอบ

| การตรวจ | ผล |
|---|---|
| npm test | ผ่าน 9 tests, ไม่ข้ามและไม่ล้มเหลว |
| npm run build | ผ่าน production compilation และ TypeScript |
| npm exec tsc -- --noEmit --incremental false | ผ่าน |
| HTTP smoke test | 36 หน้า 200, ภาษาเอกสารและลิงก์ครบ |
| เส้นทางไม่รองรับ | 404 ทั้ง 2 กรณี |
| หน้าเริ่มต้น | redirect ไป /th |
| POST /api/quotes | 503 INTAKE_NOT_READY ตามที่กำหนด |
| health และ robots | ถูกต้อง |
| เบราว์เซอร์ | ตรวจหน้าแรกไทย, สลับหน้าขนส่งทางเรือ TH → EN → 中文 |
| หน้าจอ | ตรวจหน้าแรก 390×844 และ 1440×1000, scrollWidth ไม่เกิน innerWidth |
| npm audit --omit=dev --audit-level=high | พบช่องโหว่ที่รายงาน 0 รายการ; ไม่ใช่การตรวจเจาะระบบ |

การทดสอบฐานข้อมูลใช้ PGlite (PostgreSQL แบบฝังสำหรับพัฒนา) ฐานชั่วคราวและข้อมูลสังเคราะห์ ครอบคลุม migration, unique constraints, transaction rollback, outbox ไม่ทำให้คำขอหายเมื่อแจ้งเตือนล้มเหลว, actor/assignee guard, status history, หลักฐาน Quoted และ publication guard ของ CMS ยังไม่ได้ทดสอบ external PostgreSQL, concurrent requests, notification worker หรือ backup/restore จริง

## เกณฑ์ตรวจรับ Phase 1

| รหัส | สถานะปัจจุบัน | สิ่งที่ยังต้องทดสอบให้ครบ |
|---|---|---|
| AC-01 PC/มือถือ | ผ่านเฉพาะโครงหน้าแรก | ทุกหน้าที่เสร็จจริง ฟอร์ม หลังบ้าน และ accessibility |
| AC-02 ภาษา | ผ่านโครงหน้าและการสลับภาษา | เนื้อหาบริษัทครบและคำแปลอนุมัติ |
| AC-03 ส่งทุกบริการ | ยังไม่ผ่าน | ฟอร์ม API durable storage ครบ 4 บริการ |
| AC-04 ไม่ซ้ำ | ผ่านเฉพาะ constraint | API replay/conflict และ concurrent retry |
| AC-05 Dashboard | ยังไม่ทำ | ข้อมูลจริงตามสิทธิ์ |
| AC-06 Assignment | ผ่านเฉพาะกฎ | UI/API และประวัติ reassignment |
| AC-07 หลักฐานราคา | ผ่านเฉพาะกฎ/ฐานข้อมูล | สร้างราคา อนุมัติ เอกสารและการส่งจริง |
| AC-08 Status audit | ผ่านเฉพาะกฎ/ฐานข้อมูล | authorized API และประวัติ UI |
| AC-09 RBAC | ผ่านเฉพาะ policy tests | session จริง MFA และทุก endpoint |
| AC-10 Notification retry | ผ่านเฉพาะ transaction/outbox | worker retry/lease/backoff/provider recovery |
| AC-11 Backup/restore | ยังไม่ทำ | ฐานข้อมูลและ storage สำรองและกู้คืนจริง |
| AC-12 CMS | ผ่านเฉพาะ publication constraint | CMS UI workflow และ public renderer |
| AC-13 SEO | ยังไม่ผ่าน | canonical/hreflang/sitemap บนโดเมนที่ยืนยันแล้ว |
| AC-14 Security | ผ่านเฉพาะ build/audit/policies บางส่วน | authorization, uploads, abuse, session, security review ครบระบบ |

ยังไม่มี AC ข้อใดผ่านครบทั้งขอบเขต Phase 1 จึงยังไม่ประกาศความคืบหน้า 20% การผ่าน Foundation และ 9 tests ไม่ได้แปลว่า Phase 1 เสร็จ 20% จะรายงานจุด 20/40/60/80/100 ตามงานและหลักฐานจริง โดยเก็บผลผ่านบางส่วนแยกจากผลตรวจรับครบข้อ

## งานถัดไปตามลำดับ

1. เชื่อม PostgreSQL จริงและสร้าง repository/transaction layer: submit, payload hash, idempotent replay/409, rate limit, reference, outbox แล้วทดสอบความคงทนและส่งซ้ำพร้อมกัน
2. ฟอร์ม 4 บริการ 3 ภาษา, validation ฝั่ง server, spam control, privacy notice ที่อนุมัติ, private attachments + quarantine/scan/download authorization
3. Staff authentication + MFA, session, RBAC ฝั่ง server แล้วทดสอบสิทธิ์ข้ามงาน/ข้ามบัญชี ก่อน Dashboard/Inbox/assignment/activities
4. ใบเสนอราคาและฉบับแก้ไข การอนุมัติและหลักฐานส่ง status history, notification worker retry และรายงาน
5. CMS 3 ภาษา publication workflow, approved company settings/branding, SEO, retention, backups + restore, monitoring, staging และ production security checks

ไม่ต้องมีบัญชีลูกค้า ไม่คำนวณราคาขนส่งอัตโนมัติใน Phase 1; Phase 2 tracking และ Phase 3 operations เป็นส่วนขยายภายหลังผ่าน UUID เดิม ไม่ได้สร้างในรอบนี้

## สิ่งที่ยังไม่พร้อมจากสภาพแวดล้อม

ยังไม่พบคำสั่ง PostgreSQL server/psql และ Docker ใน PATH; ไม่ได้สรุปว่าไม่มีโปรแกรมเหล่านี้บนเครื่องทั้งหมด ยังไม่มีฐานข้อมูลภายนอก object storage identity provider อีเมล โดเมน หรือ hosting ที่ตั้งค่าสำหรับโครงการ การใช้ PGlite ช่วยทดสอบ schema โดยไม่เปลี่ยนบริการบนเครื่อง และไม่ควรใช้ผลนี้อ้างว่า production พร้อม

ข้อมูลธุรกิจที่รออนุมัติ ได้แก่ โลโก้ รายละเอียดบริการ ข้อมูลติดต่อ โดเมน อีเมลรับงาน ผู้อนุมัติราคา ระยะเวลาตอบกลับ นโยบายเก็บข้อมูล Privacy/Terms และภาพผลงาน ไม่ได้สมมติหรือเผยแพร่เป็นข้อมูลจริง

## เปิดดูในเครื่อง

เปิด terminal ใน `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web` แล้วรัน `npm run dev` จากนั้นเปิด `http://127.0.0.1:3000/th` ผูกเฉพาะ loopback ไม่ใช่การเผยแพร่ภายนอก เซิร์ฟเวอร์ที่ใช้ตรวจงานรอบนี้จะปิดเมื่อทดสอบเสร็จ

เอกสารรายละเอียดเพิ่มเติม: README.md ในโฟลเดอร์ web; migration: database/001_foundation.sql; tests: tests/domain.test.mjs, tests/database.test.mjs และ tests/http-smoke.mjs (รันหลังเปิดเว็บ)

อ้างอิงการติดตั้งและ headers ที่ตรวจระหว่างเตรียมงาน: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Next.js headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
