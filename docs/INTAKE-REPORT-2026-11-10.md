# KPN WAGON LOGISTICS — โมดูลรับคำขอ รอบที่ 2

วันที่ 10 พฤศจิกายน 2026 (ประเทศไทย)

พัฒนาต่อใน `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web` จาก Foundation เดิม ตรวจไฟล์ก่อนแก้และสำรองไฟล์ที่แก้ในพื้นที่ทำงาน ไม่แก้ไขหรือลบไฟล์ LOGO และไม่เผยแพร่เว็บไซต์

## ผลงานที่ใช้งานและทดสอบแล้ว

- ฟอร์มขอใบเสนอราคาไทย อังกฤษ จีนตัวย่อ แยกช่องข้อมูลตามทางเรือ/อากาศ/บก/ศุลกากร พร้อมเลขอ้างอิงหลัง commit สำเร็จ ไม่ต้องสมัครบัญชี
- PostgreSQL จริง 18.6 ใช้เฉพาะงานพัฒนาแบบแยกโครงการ ไม่ติดตั้งบริการ Windows; แอปเชื่อมด้วย pg และแยกบัญชี migration owner ออกจากบัญชี runtime ในชุดทดสอบ
- บันทึกผู้ติดต่อ คำขอ รายละเอียดสินค้า audit ประวัติเริ่มต้น และคิวแจ้งเตือนใน transaction เดียว
- ป้องกันการส่งซ้ำด้วย UUID idempotency key, normalized payload hash, unique constraint และ transaction advisory lock; ข้อมูลเดิมคืนเลขเดิม (200), ใหม่สำเร็จ (201), key เดิมกับข้อมูลเปลี่ยนคืน 409
- ฟอร์มล็อกระหว่างส่งและเก็บเฉพาะ key/hash ใน session storage เพื่อใช้ retry หลังผลเครือข่ายไม่แน่นอน ไม่เก็บรายละเอียดลูกค้าใน session storage; ข้อมูลที่เปลี่ยนสร้าง key ใหม่
- Server validation, JSON body สูงสุด 16 KiB รวมกรณี stream ไม่มี Content-Length, origin/content-type checks, honeypot, จำกัดจำนวนตาม email ที่แฮชด้วย HMAC และจำนวนรวมในฐานข้อมูล
- ความยินยอมการตลาดเป็นตัวเลือกแยก ไม่บังคับ; ข้อรับทราบบนฟอร์มขณะนี้เป็นการยืนยันข้อมูลสังเคราะห์สำหรับทดสอบ ไม่ใช่ Privacy Notice ทางกฎหมายที่อนุมัติแล้ว
- migration runner มี checksum, lock และรันซ้ำได้; migration 002 แก้ความเสี่ยงเลขอ้างอิงถูกตัดเมื่อ sequence ยาวเกินความกว้างเดิม
- ค่าปกติปิดรับคำขอ; เปิดได้เฉพาะ explicit synthetic test mode บน loopback ใน development โหมด live ยังปิดเสมอ

## หลักฐาน

| การตรวจ | ผล |
|---|---|
| npm test | ผ่าน 12 tests |
| npm run test:postgres | ผ่าน 10 กรณีย่อย บน PostgreSQL 18.6 (ตัว runner นับรวม parent เป็น 11 tests) |
| npm run typecheck | ผ่าน |
| npm run build หลังแก้ครั้งสุดท้าย | ผ่าน |
| npm audit --audit-level=high | พบช่องโหว่ที่แพ็กเกจรายงาน 0; ไม่ใช่ผล penetration test |
| HTTP smoke บน build สุดท้าย | 36 หน้า 200, เส้นทางผิด 2 กรณี 404, ไทยเริ่มต้น, health/robots และปิด intake ตามค่าเริ่มต้นผ่าน |
| เบราว์เซอร์ส่งจริงถึงฐานข้อมูลทดสอบ | ทางเรือภาษาไทย KPN-1, อากาศภาษาไทย KPN-2, บกภาษาอังกฤษ KPN-3, ศุลกากรภาษาจีน KPN-4 |
| หน้าจอฟอร์ม | 390×844 และ 1440×1000; document width ไม่เกิน viewport |

กรณีย่อย PostgreSQL ที่ผ่าน:

1. Migration apply และ rerun โดยไม่แก้ข้อมูลเดิม
2. ทั้ง 4 บริการ commit contact/request/cargo/history/audit/outbox
3. ส่งข้อมูลเดิม 20 ครั้งพร้อมกัน ได้คำขอเดียวและเลขเดียว
4. key เดิมข้อมูลเปลี่ยนถูกปฏิเสธ; whitespace ที่ normalize แล้วเหมือนเดิม replay ได้
5. จำลองล้มเหลวหลัง insert request แล้ว rollback ข้อมูลและ outbox ทั้งหมด
6. Rate limit อยู่ในฐานข้อมูล และ replay รายการสำเร็จเดิมยังทำได้
7. จำลอง notification failure แล้วคำขอยังอยู่
8. Runtime role ลบหรือ truncate หลักฐานไม่ได้
9. HTTP success/replay/conflict/origin/media type/spam/size/key และ generic error behavior
10. ข้อมูลที่ commit แล้วยังอยู่หลังปิด/เริ่ม PostgreSQL ใหม่

การทดสอบหลัง restart ไม่ใช่การกู้คืน backup: AC-11 ยังต้องทดสอบ backup/restore จริง

## สถานะตรวจรับเทียบ Phase 1

AC-03 และ AC-04 มีหลักฐานการทำงานของเส้นทางรับคำขอแบบข้อความครบ 4 บริการและการส่งซ้ำในสภาพทดสอบแล้ว ยังต้องตรวจซ้ำร่วมกับไฟล์แนบและสภาพ staging ที่พร้อมใช้งานจริง

AC-01/02 ทดสอบโครงเว็บและฟอร์ม 3 ภาษา/2 ขนาดหน้าจอได้ แต่เนื้อหาบริษัทและทุกหน้าหลังบ้านยังไม่ครบ AC-08 มีประวัติเริ่มต้นและกฎเปลี่ยนสถานะ แต่ยังไม่มี workflow หลังบ้าน AC-09 มี policy และฐานข้อมูลบางส่วน แต่ยังไม่มี staff session/MFA endpoints AC-10 มี outbox คงทน แต่ยังไม่มี worker retry จริง

ยังไม่ประกาศ 20% ของ Phase 1 จากจำนวนไฟล์หรือจำนวน tests: เกณฑ์ตรวจรับทั้ง 14 ข้อยังไม่ได้ผ่านครบเป็นชุดที่รองรับการอ้างเปอร์เซ็นต์รวม รายงานนี้แยกสิ่งที่ทดสอบผ่านจริงจากสิ่งที่ยังขาดไว้เพื่อไม่ให้เข้าใจว่าระบบพร้อมเปิดใช้

## สิ่งที่ยังไม่ทำและข้อจำกัด

- แนบไฟล์: ยังปิด ต้องทำ private object storage, type/signature/size verification, quarantine, malware scanner และ authorized download
- Notification worker: ยังไม่ส่งอีเมล ต้องเพิ่ม claim/lease/retry/backoff/provider idempotency และจัดการงานค้าง
- บัญชีเจ้าหน้าที่/MFA, RBAC ตาม endpoint, Dashboard/Inbox, assignment, activity, ใบเสนอราคา/ฉบับแก้ไข/อนุมัติ/หลักฐานส่ง, CMS, reports ยังรอโมดูลถัดไป
- Anti-abuse ปัจจุบันเป็นชั้นเบื้องต้นสำหรับ development; ต้องเสริม trusted-edge controls ก่อนเปิด internet ห้ามตีความ contact/global limiter ว่าเป็นการป้องกันสแปม production ที่ครบถ้วน
- ต้องตั้งงาน cleanup ของ rate buckets, retention, approved Privacy/Terms, monitoring, backup/restore, staging/prod และ security review
- เนื้อหาบริษัท โลโก้ ข้อมูลติดต่อ โดเมน และนโยบายยังรอเจ้าของอนุมัติ ไม่ได้สร้างข้อมูลจริงขึ้นเอง

## เปิดทดสอบเอง

เข้าโฟลเดอร์ `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web`

1. `npm run build`
2. `npm run preview:test`
3. เปิด `http://127.0.0.1:3000/th/request-a-quote` ใช้ข้อมูลสมมติเท่านั้น
4. กด Ctrl+C เมื่อจบ

Preview สร้างฐานทดสอบใหม่ทุกครั้ง ไม่ได้เปิดข้อมูลชุดก่อนกลับมา และไม่ส่งอีเมลจริง พอร์ต 3000/55440 ต้องว่าง; ชุด integration ใช้ 55439 ข้อมูลทดสอบเก็บใน `.local/` ที่ถูก ignore เพื่อวิเคราะห์ ไม่ใช่แผนสำรองข้อมูล ไม่ได้สร้างไฟล์ credential ของแอป

ตัวช่วยฐานข้อมูลใช้แพ็กเกจ [embedded-postgres](https://github.com/leinelissen/embedded-postgres) เฉพาะ development; ระบบ runtime ใช้ pg และ DATABASE_URL สำหรับ PostgreSQL ที่จัดเตรียมจริงต่อไป

งานถัดไปตามลำดับ: ทำตัวส่งแจ้งเตือนและ retry ให้ผ่าน → ไฟล์แนบปลอดภัย → เชื่อม staff identity/MFA และตรวจสิทธิ์ → Dashboard/Quotation Inbox ก่อนขยาย workflow ราคาและ CMS
