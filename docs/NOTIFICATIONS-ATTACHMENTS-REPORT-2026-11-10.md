# KPN WAGON LOGISTICS — รายงานจุด 20% ตามเกณฑ์ทดสอบในระบบพัฒนา

วันที่ 10 พฤศจิกายน 2026 (ประเทศไทย)

โครงการ: `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web`

## วิธีวัดความคืบหน้า

ใช้เกณฑ์ตรวจรับเดิม 14 ข้อเป็นตัวนับเท่ากัน ไม่คิดจากจำนวนไฟล์ จำนวนบรรทัด หรือชั่วโมงที่คาดเดา ปัจจุบันมีหลักฐานผ่านในสภาพแวดล้อมพัฒนา 3 ข้อ ได้แก่ AC-03, AC-04 และ AC-10 คิดเป็น **3 ÷ 14 = 21.4% ของจำนวนเกณฑ์** จึงเป็นรายงานผ่านจุด 20% ครั้งแรก

ตัวเลขนี้เป็นสัดส่วนเกณฑ์ที่ทดสอบผ่านใน development ไม่ใช่สัดส่วน effort ของงานทั้งหมด และไม่ใช่ความพร้อมเปิด production เกณฑ์ทั้ง 14 ต้องตรวจซ้ำกับ staging/production ก่อนเปิดใช้งานจริง โดยการส่งอีเมลจริง antivirus engine จริง และ cloud storage ยังไม่ได้ตั้งค่า

## เกณฑ์ที่มีหลักฐานผ่านในระบบพัฒนา

| รหัส | หลักฐาน |
|---|---|
| AC-03 ส่งคำขอครบ 4 บริการแล้วบันทึกสำเร็จ | รอบก่อนส่งจากเบราว์เซอร์ครบทางเรือ/อากาศ/บก/ศุลกากรลง PostgreSQL จริง ได้ KPN-1 ถึง KPN-4; รอบนี้ทดสอบ regression ของ transaction ทั้ง 4 บริการผ่าน |
| AC-04 ส่งซ้ำไม่สร้างคำขอซ้ำ | ส่งพร้อมกัน 20 ครั้งได้รายการเดียว; payload เดิม replay เลขเดิม; เปลี่ยน payload กับ key เดิมได้ 409; เพิ่มและทดสอบฟอร์มไม่สร้าง key ใหม่เองหลังผลส่งไม่แน่นอน |
| AC-10 แจ้งเตือนขัดข้องไม่สูญคำขอและส่งซ้ำได้ | PostgreSQL จริงร่วมกับผู้ส่งจำลอง: failure → เก็บคำขอ → backoff → retry สำเร็จ, timeout, lease recovery, ผู้ส่งรับแล้วแต่ response หาย และ worker หลายตัว |

AC-03 ยังไม่รวมการเปิดอัปโหลดไฟล์ต่อสาธารณะ ซึ่งอยู่ในงานความปลอดภัย/การเชื่อมบริการที่ยังไม่เสร็จ การผ่าน AC-10 ใน development ไม่ได้หมายความว่าส่งอีเมลจริงถึง inbox แล้ว

## สิ่งที่ทำเสร็จรอบนี้

### ระบบแจ้งเตือน

- แยกแจ้งเจ้าหน้าที่และยืนยันลูกค้าเป็นคนละงาน เพื่อลดความเสี่ยงส่งผู้รับแรกซ้ำเมื่อผู้รับที่สองล้มเหลว
- Claim งานด้วย PostgreSQL row lock + SKIP LOCKED, lease token และตรวจ token ก่อนบันทึกผล ป้องกัน worker เก่าที่กลับมาช้าเขียนทับงานใหม่
- บันทึก payload และผู้รับครั้งแรกไว้ใช้ซ้ำ ไม่เปลี่ยนตาม configuration ระหว่าง retry
- Timeout ผู้ส่งสั้นกว่า lease, exponential backoff พร้อม jitter, จำกัด attempts และแยกงานที่ต้องตรวจโดยเจ้าหน้าที่ (dead-letter)
- เก็บ attempts, ผลล้มเหลว/สำเร็จ/lease หมดอายุ และ audit ด้วย error code ที่ไม่บันทึกเนื้อหาอีเมลหรือข้อมูลลับ
- รองรับผู้ส่งจำลอง และมี Resend adapter เป็นทางเลือกในโค้ด ยังไม่ได้เลือกซื้อ สมัคร หรือตั้งค่าใช้งานจริง
- ใช้ idempotency key เดิมต่อผู้รับ และหยุดส่งอัตโนมัติเมื่อเกิน 23 ชั่วโมงหลังเริ่มพยายามส่ง เพื่อไม่ส่งซ้ำหลังหมดช่วงคุ้มครองของผู้ให้บริการ
- Worker ถูกปิดโดยค่าเริ่มต้น การเปิดส่งจริงต้องมีข้อมูลผู้ส่ง/ผู้รับและสถานะอนุมัติข้อความ/การสื่อสารชัดเจน

Provider API acceptance ไม่เท่ากับการส่งถึง inbox: delivery/bounce webhooks และการแจ้งเตือนงานค้างยังต้องทำต่อ

### บริการไฟล์แนบแบบส่วนตัว

- เพิ่มบริการภายในสำหรับสิทธิ์อัปโหลดแบบ token อายุ 15 นาที โดยเก็บเฉพาะ hash ของ token ในฐานข้อมูล
- จำกัด 5 ไฟล์/คำขอและไม่เกิน 10 MiB/ไฟล์ ตรวจนามสกุล MIME และ signature ของ PDF/PNG/JPEG; ปฏิเสธ path traversal/control characters/Windows stream syntax
- เก็บไฟล์ด้วยชื่อ UUID นอกพื้นที่เว็บสาธารณะ มี idempotency ของการอัปโหลดและป้องกันจำนวนเกินเมื่อหลายคำขอเข้าพร้อมกัน
- กักกันไฟล์ก่อนตรวจ ตรวจ checksum และมี timeout/lease สำหรับการ scan
- ไม่มี scanner/timeout/คำตอบผิดรูปแบบ: คง quarantine และลองตรวจใหม่ได้; ผล infected: ปฏิเสธและไม่ปล่อยด้วยผลเก่าที่มาช้า
- ดาวน์โหลดผ่านบริการที่ตรวจ Principal, MFA ของสิทธิ์สูง และผู้รับผิดชอบคำขอ ตรวจ hash อีกครั้งและบังคับ attachment/no-store/nosniff
- มี ClamAV INSTREAM adapter และ scan worker แบบปิดไว้เป็นค่าเริ่มต้น

**ข้อจำกัดสำคัญ:** ยังไม่มี public upload/download API หรือ UI ที่เปิดรับไฟล์ ยังไม่ได้เชื่อม staff session จริง ยังไม่พบ clamd/clamscan ใน PATH และยังไม่ได้ทดสอบกับ antivirus engine จริง ชุดทดสอบใช้ verdict จำลองและ protocol server จำลอง พื้นที่ local เป็น development adapter เท่านั้น; cloud private object storage, encryption/IAM, retention, backups และ antivirus definitions/health ยังไม่พร้อม การตรวจ signature ไม่ใช่ตัวแยกวิเคราะห์เอกสารหรือ content-disarm ที่ครบถ้วน

### เสริมการส่งซ้ำของฟอร์มเดิม

แก้กรณีหลังผลส่งไม่แน่นอนแล้วเปลี่ยนข้อมูล: เดิมฟอร์มอาจสร้าง key ใหม่เอง ปัจจุบันคง identity เดิม ปฏิเสธการเปลี่ยน payload ระหว่างลองใหม่ และแสดงปุ่มเริ่มคำขอใหม่ให้ผู้ใช้เลือกอย่างชัดเจน Normalize whitespace/Unicode/email ก่อนคำนวณ identity ฝั่งฟอร์ม

ตรวจผ่านเบราว์เซอร์กับฐานข้อมูลที่ไม่พร้อม: ส่งเดิมซ้ำยังแจ้งยืนยันไม่ได้, เปลี่ยนรายละเอียดแสดงคำเตือน, กด Start another test request แล้วล้างฟอร์มและเริ่มใหม่ได้ ใช้ข้อมูลสังเคราะห์เท่านั้น

## ผลทดสอบ

| ชุด | ผลล่าสุด |
|---|---|
| npm test | 18 tests ผ่านทั้งหมด |
| npm run test:postgres | 10 กรณีย่อยผ่านทั้งหมด; runner นับ parent เป็น 11 |
| npm run test:notifications | 9 กรณีย่อยผ่านทั้งหมด; runner นับ parent เป็น 10 |
| npm run test:attachments | 9 กรณีฐานข้อมูล/ไฟล์ + 1 กรณี ClamAV protocol ผ่านทั้งหมด; runner นับ parent เป็น 11 |
| npm run build | ผ่านหลังแก้ฟอร์มเวอร์ชันสุดท้าย |
| npm run typecheck | ผ่าน |
| npm audit --audit-level=high | พบช่องโหว่ที่แพ็กเกจรายงาน 0 รายการ ไม่ใช่ penetration test |
| Browser retry regression | ผ่านการส่งเดิมซ้ำ, เตือนเมื่อเปลี่ยนข้อมูล, ปุ่มเริ่มใหม่ |

รวม 47 กรณีเมื่อไม่นับ test container/parent ซ้ำ ไม่ใช้จำนวนนี้คำนวณความคืบหน้าเปอร์เซ็นต์

## สถานะที่ยังไม่ผ่านครบ

| รหัส | งานคงเหลือ |
|---|---|
| AC-01 PC/มือถือ | ตรวจทุกหน้าที่เสร็จจริง รวมหลังบ้านและ accessibility |
| AC-02 ภาษา | เนื้อหาบริษัทครบและคำแปลอนุมัติ; ปัจจุบันมีโครงและฟอร์มทดสอบ |
| AC-05 Dashboard | ยังไม่สร้างหน้าจอที่เชื่อม staff session |
| AC-06 Assignment | กฎบางส่วนมีแล้ว ต้องมี API/UI และประวัติ reassignment |
| AC-07 หลักฐานใบเสนอราคา | มีโครง/guard ต้องสร้าง แก้ไข อนุมัติและส่งจริง |
| AC-08 Audit สถานะ | ต้องเชื่อม workflow เปลี่ยนสถานะผ่าน authorized API/UI |
| AC-09 RBAC | ต้องเชื่อม identity provider, session/MFA และทุก endpoint |
| AC-11 Backup/restore | restart test ผ่าน แต่ยังไม่มี backup/restore drill |
| AC-12 CMS | โครงฐานข้อมูลมีแล้ว ต้องมี editor/review/publish/renderer |
| AC-13 SEO | canonical/hreflang/sitemap บนโดเมนและเนื้อหาที่อนุมัติ |
| AC-14 Security | เชื่อม scanner/storage/session จริง, abuse controls, monitoring, review และ staging checks |

เกณฑ์ที่ผ่านใน development ทั้ง 3 ข้อต้องตรวจซ้ำหลังเชื่อมระบบเหล่านี้ ไม่ถือว่า production sign-off แล้ว

## ข้อขัดข้องและงานถัดไป

ไม่ติดขัดการเขียนโมดูลถัดไป แต่การเปิดใช้จริงยังรอ company communications configuration, ผู้ให้บริการอีเมล/โดเมนที่อนุมัติ, antivirus engine, private cloud storage, identity provider และข้อมูลธุรกิจที่เจ้าของต้องยืนยัน ไม่สมมติข้อมูลติดต่อหรือเผยแพร่แบรนด์เป็นทางการ

ถัดไป: เชื่อมบัญชีเจ้าหน้าที่และ MFA พร้อมตรวจสิทธิ์ฝั่ง server ก่อนสร้าง Dashboard/Quotation Inbox/assignment จากนั้นต่อหลักฐานใบเสนอราคา CMS และงานปฏิบัติการ ระบบไฟล์ยังปิดต่อผู้ใช้จนผ่านการตรวจเชื่อมบริการจริง

เอกสารและคำสั่งใช้งานเก็บใน README.md ของโครงการ ชุดใหม่ใช้พอร์ตทดสอบ 55441/55442 แยกจากงานเดิมและใช้ข้อมูลสังเคราะห์ ไม่ติดตั้งเป็นบริการ Windows ไม่ส่งอีเมลจริง และไม่แตะโฟลเดอร์ LOGO

## อ้างอิงที่ตรวจประกอบการออกแบบ

- [PostgreSQL SELECT / SKIP LOCKED](https://www.postgresql.org/docs/18/sql-select.html)
- [Resend idempotency keys และช่วง 24 ชั่วโมง](https://resend.com/changelog/idempotency-keys)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [ClamAV INSTREAM protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)
