# KPN WAGON LOGISTICS — ระบบบัญชีเจ้าหน้าที่และ Workspace

วันที่ 10 พฤศจิกายน 2026 (ประเทศไทย)

ตำแหน่งโครงการ: `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web`

## รายงานผ่านจุด 40%

ปัจจุบันผ่านเกณฑ์ตรวจรับในสภาพแวดล้อมพัฒนา **7 จาก 14 ข้อ = 50% ตามจำนวนเกณฑ์แบบให้น้ำหนักเท่ากัน** จึงผ่านจุดรายงาน 40% แล้ว ตัวเลขนี้ไม่ใช่สัดส่วนเวลา/effort และไม่ใช่ความพร้อมเปิด production

เพิ่มหลักฐาน AC-05 Dashboard, AC-06 Assignment, AC-08 Status audit และ AC-09 ปฏิเสธการเข้าถึงข้ามสิทธิ์ จากเดิมที่มี AC-03/04/10 รวมเป็น 7 ข้อ ระบบอื่นยังต้องตรวจรับและทุกข้อต้องตรวจซ้ำใน staging ก่อนเปิดจริง

## สิ่งที่ทำเสร็จและทดสอบแล้ว

### บัญชีและการเข้าสู่ระบบ

- ใช้ OIDC Authorization Code + PKCE ผ่าน openid-client ไม่สร้างระบบเก็บรหัสผ่านเอง
- ตรวจ issuer, audience, signature RS256/JWKS, state, nonce, อายุโทเคนและ auth_time
- Owner/Manager ต้องมีค่า ACR ที่กำหนดไว้เป็นระดับ MFA จากโทเคนที่ตรวจแล้ว มิฉะนั้นไม่สร้าง session
- บทบาทมาจากฐานข้อมูลของเว็บไซต์ ไม่ใช้ role ที่ส่งมากับ ID token หรือ header/body จากเบราว์เซอร์
- ไม่มีการสมัครเป็นเจ้าหน้าที่อัตโนมัติ: subject ที่ไม่ลงทะเบียนหรือถูกปิดบัญชีเข้าระบบไม่ได้
- Session เป็นรหัสสุ่มและเก็บเฉพาะ hash ในฐานข้อมูล มีอายุสูงสุด 8 ชั่วโมง และหมดอายุเมื่อไม่ใช้งาน 30 นาที
- Cookie เป็น HttpOnly/SameSite และใช้ Secure + __Host- prefix เมื่อใช้ HTTPS; อนุญาต HTTP loopback เฉพาะ development ที่เปิด test flag ชัดเจน
- การเปลี่ยนบทบาท/ปิดบัญชีเพิกถอน session เดิมทันที พร้อม auth_version ตรวจซ้ำทุกคำขอ
- ทุก mutation ตรวจ Origin และ CSRF ที่ผูกกับ session
- Owner จัดการ registry บัญชีได้เมื่อมี MFA ที่ยืนยันภายใน 15 นาที และระบบไม่ให้ปิด/ลดสิทธิ์ Owner คนสุดท้าย
- มี bootstrap script สำหรับ Owner เริ่มต้นที่ต้องระบุ identity จริงอย่างชัดเจน ไม่มีบัญชี admin หรือรหัสผ่านเริ่มต้นสำหรับ production
- Callback ใช้ public origin จาก configuration และตรวจ Host ให้ตรงกัน โดยไม่เชื่อ X-Forwarded-Host; เพิ่ม HTTP regression หลังพบความต่างของ URL ภายใน Next.js ระหว่างทดสอบจริง

MFA enrollment, password policy, recovery และการยืนยันปัจจัยจริงอยู่กับผู้ให้บริการตัวตน การทดสอบรอบนี้ใช้ผู้ให้บริการจำลองที่ลงลายเซ็นจริงและจำลอง assertion ของ MFA ไม่ได้ทดสอบ OTP/อุปกรณ์จริง และยังไม่มีบัญชีบริษัทจริง

### Dashboard / Quotation Inbox

- ภาพรวมจำนวนคำขอ งานใหม่ รอข้อมูล และกำลังจัดทำราคา พร้อมแยกบริการ/สถานะ
- จำกัดทั้งจำนวนรวม รายการ และรายละเอียดตามสิทธิ์ตั้งแต่ query ไม่ดึงข้อมูลทั้งหมดมาซ่อนบนหน้าเว็บ
- Owner/Manager ดูคำขอทั้งหมดได้ตามนโยบาย; Sales ดู/ทำงานเฉพาะรายการที่มอบหมาย; Viewer อ่านเฉพาะขอบเขตที่อนุญาตและไม่มี mutation; Content Editor เข้าถึงคำขอไม่ได้
- Viewer ไม่มีสิทธิ์เห็นงานทั้งหมดโดยปริยาย การจัดการ grant สำหรับการดู/รายงานเพิ่มเติมยังเป็นงานต่อยอด; การมอบหมายงานดำเนินการปกติเลือก Owner/Manager/Sales ที่ active เท่านั้น
- Inbox ค้นหาเลขคำขอ/ชื่อติดต่อ กรองบริการ/สถานะ และแบ่งหน้า
- หน้ารายละเอียดแสดงผู้ติดต่อ เส้นทาง สินค้า ผู้รับผิดชอบ และประวัติการทำงาน
- มอบหมายและมอบหมายใหม่ด้วย optimistic version check มีประวัติผู้มอบหมาย/ผู้รับผิดชอบ/เวลา การมอบหมายใหม่ตัดสิทธิ์ Sales คนเดิมทันที
- บันทึกการติดต่อตามช่องทาง พร้อมผู้บันทึกและเวลา
- เปลี่ยนสถานะเฉพาะทางที่กฎอนุญาต ปิดงานต้องมีเหตุผล และ Quoted ต้องมีราคาอนุมัติ/ไฟล์ที่ผ่านตรวจ/หลักฐานส่ง
- การเปลี่ยนสถานะ ประวัติมอบหมาย และ audit บันทึกในธุรกรรมเดียว
- หน้าหลังบ้านตรวจ session ใน runtime ทุกครั้ง ไม่ถูกสร้างเป็น static snapshot; HTTP ตรวจว่าไม่ cache ข้อมูลส่วนตัว

## หลักฐานจากเบราว์เซอร์

ใช้ข้อมูลสังเคราะห์บน PostgreSQL แยกและผู้ให้บริการจำลองเท่านั้น:

1. Owner เข้าผ่าน OIDC flow เห็น 4 คำขอ (2 New / 2 Assigned)
2. เปิด KPN-1 ที่ยังไม่มอบหมาย แล้วมอบหมายให้ Sales สำเร็จ มีประวัติ Owner และเวลา
3. Owner เปิดหน้าบัญชีเห็น registry ทดสอบ 5 บทบาท และออกจากระบบได้
4. Sales เข้าระบบ เห็น 3 งานที่ได้รับมอบหมาย ไม่เห็น KPN-4 ที่ไม่อยู่ในสิทธิ์
5. Sales เปิด /staff/accounts โดยตรงแล้วถูกปฏิเสธ ไม่ได้รับรายการบัญชี
6. Sales เปลี่ยน KPN-1 จาก Assigned → Reviewing มีชื่อ Sales และเวลาในประวัติ
7. Sales บันทึกติดต่อลูกค้าได้ ข้อความและผู้บันทึกปรากฏใน Workspace
8. Inbox กรอง air แล้วเหลือรายการ KPN-2 เพียงรายการเดียว
9. ตรวจ 390×844 และ 1440×1000; document width ไม่เกิน viewport ตารางยาวเลื่อนภายในกรอบของตารางได้

ชุด HTTP สุดท้ายใช้ฐานสังเคราะห์ชุดใหม่ (Owner 4 / Sales 2 ก่อนเริ่มทดสอบ) และยืนยัน login/cookie → สร้างคำขอ → มอบหมาย → เปลี่ยนสถานะ → บันทึกติดต่อ → audit → มอบหมายใหม่ → Sales เดิมถูกตัดสิทธิ์ รวมถึง CSRF/role spoof/last Owner protection ผ่านครบ

ตัวเลขในภาพเป็นข้อมูลทดสอบ ไม่ใช่ยอดลูกค้าหรือผลงานจริงของบริษัท

## ผลตรวจครั้งล่าสุด

| ชุดทดสอบ | ผล |
|---|---|
| npm test | 18 tests ผ่าน |
| npm run test:postgres | 10 กรณีย่อยผ่าน |
| npm run test:notifications | 9 กรณีย่อยผ่าน |
| npm run test:attachments | 9 กรณีฐานข้อมูล/ไฟล์ + 1 protocol test ผ่าน |
| npm run test:staff-auth | 10 กรณีย่อยผ่าน |
| npm run test:staff-workspace | 11 กรณีย่อยผ่าน |
| รวมข้างต้น | 68 กรณี ไม่รวมการนับ parent/container ซ้ำ |
| staff-http-smoke | HTTP ครบวงจรผ่าน รวม rendered status choices และ no-store |
| public HTTP smoke | 36 หน้า/3 ภาษา, 404, ไทยเริ่มต้น, robots, health และปิด intake ปกติ ผ่าน |
| default-disabled checks | /staff redirect ไป login, /api/staff และเริ่ม OIDC คืน 503 เมื่อยังไม่ตั้งค่า |
| npm run build / typecheck | ผ่าน |
| npm audit --audit-level=high | พบช่องโหว่ที่แพ็กเกจรายงาน 0; ไม่ใช่ penetration test |

ชุด OIDC ทดสอบ state/nonce/issuer/audience/expiration/auth_time ผิด, ลายเซ็นผิด, cookie ถูกแก้, callback ถูก replay, ผู้ใช้ไม่ลงทะเบียน/ถูกปิด, MFA ไม่ครบ, session หมดอายุ/idle/logout/เปลี่ยน role, คำขอพร้อมกันใน session เดียว และ Host ปลอม

ชุด Workspace ทดสอบ scoping ของ Dashboard/Inbox, assignment/audit, Sales ข้ามงาน, staff accounts, stale version, assignee ไม่ถูกบทบาท, activities, status guards, reassignment, Viewer read-only, HTTP role spoof/CSRF และ Owner คนสุดท้าย

## สถานะเกณฑ์ทั้ง 14

| เกณฑ์ | สถานะ development | หมายเหตุ |
|---|---|---|
| AC-01 PC/มือถือ | บางส่วน | หน้าที่มีและหลังบ้านตรวจแล้ว ต้องตรวจทุกหน้าที่จะเพิ่ม |
| AC-02 ภาษา | บางส่วน | โครง/ฟอร์ม 3 ภาษา เนื้อหาบริษัทยังรออนุมัติ |
| AC-03 ส่งทุกบริการ | ผ่าน | ข้อมูลคำขอครบ 4 บริการบันทึกได้ในสภาพทดสอบ |
| AC-04 ไม่ซ้ำ | ผ่าน | concurrent retry, conflict และ identity หลังผลส่งไม่แน่นอน |
| AC-05 Dashboard | ผ่าน | จำนวนและสถานะจาก DB ตรงขอบเขตสิทธิ์ |
| AC-06 Assignment | ผ่าน | มอบหมาย/ประวัติ/ผู้รับเห็นงาน/ตัดสิทธิ์คนเดิม |
| AC-07 หลักฐานราคา | ยังไม่ครบ | ต้องทำเอกสาร ฉบับแก้ไข อนุมัติ และส่งจริง |
| AC-08 Status audit | ผ่าน | workflow ที่ทำแล้วมีผู้แก้ไข เวลา และประวัติ atomic |
| AC-09 ปฏิเสธข้ามสิทธิ์ | ผ่าน | signed identity + server session/RBAC และ negative endpoint tests |
| AC-10 Notification retry | ผ่าน | จำลองผู้ส่งขัดข้อง คำขอไม่หายและ retry ได้ |
| AC-11 Backup/restore | ยังไม่ครบ | restart test ผ่าน แต่ยังต้องกู้คืน backup จริง |
| AC-12 CMS | ยังไม่ครบ | มี schema รอ editor/review/publish และ public renderer |
| AC-13 SEO | ยังไม่ครบ | รอโดเมน/เนื้อหาอนุมัติ และ hreflang/sitemap/canonical |
| AC-14 Security | ยังไม่ครบ | production identity/scanner/storage/monitoring และ review ยังรอ |

การผ่านใน development ไม่ใช่ sign-off production ต้องตรวจซ้ำหลังเชื่อมระบบจริงและหลังเพิ่มโมดูลถัดไป

## ข้อขัดข้องและงานคงเหลือ

- ยังไม่ได้เลือก/เชื่อมผู้ให้บริการตัวตนของบริษัท ต้องยืนยัน MFA assurance mapping, policy และ recovery กับผู้ให้บริการจริงก่อนเปิดบัญชีจริง
- ยังไม่ตั้งค่าบริการอีเมลจริง, ClamAV engine จริง, private cloud object storage หรือ staging/prod
- การออกจากระบบตอนนี้เพิกถอน session ของเว็บไซต์ ไม่ใช่การออกจาก SSO ทั้งองค์กร; provider logout/revocation integration ต้องพิจารณากับผู้ให้บริการที่เลือก
- ยังต้องมีงานล้างข้อมูล session/login transaction ที่หมดอายุ และกำหนด retention ที่อนุมัติ
- Quotation revisions/approval/delivery evidence, CMS 3 ภาษา, Customer Directory, รายงานตามช่วงเวลา, backups/restore, monitoring และ security review ยังต้องทำต่อ
- ไฟล์แนบยังปิดใน UI และยังไม่มี public upload/download route แม้บริการภายในผ่านชุดทดสอบแล้ว
- ข้อมูลบริษัท โลโก้ ติดต่อ โดเมน นโยบาย Privacy/Terms และภาพผลงานยังรอเจ้าของอนุมัติ ไม่สมมติหรือประกาศเป็นข้อมูลจริง

งานถัดไปคือระบบจัดทำใบเสนอราคา/ฉบับแก้ไข การอนุมัติและหลักฐานส่ง แล้วต่อ CMS และงานปฏิบัติการก่อนเตรียม staging

## เปิดตรวจเอง

ใน `E:\KPN WAGON LOGISTICS COMPANY LIMITED\web`:

1. `npm run build`
2. `npm run preview:staff`
3. เปิด `http://127.0.0.1:3000/staff/login`
4. เลือก Owner หรือ Sales จากหน้าผู้ให้บริการจำลอง ไม่ใช้รหัสผ่านจริง
5. กด Ctrl+C เมื่อจบ

Preview สร้างฐานข้อมูลสังเคราะห์ใหม่ทุกครั้ง ใช้พอร์ต 55445 และเว็บ 3000 ผู้ให้บริการจำลองเปิดบนพอร์ต loopback ที่สุ่มขึ้น ข้อมูลชุดนี้ไม่ใช่ระบบปฏิบัติงานจริงและไม่ใช่ backup ไม่มี credentials ของบริษัทถูกตั้งค่า

ไม่ได้ติดตั้งบริการ Windows ไม่เผยแพร่เว็บไซต์ ไม่ส่งข้อความถึงบุคคลอื่น และไม่ได้แก้ไขไฟล์ LOGO

## อ้างอิงที่ใช้ประกอบการออกแบบ

- [openid-client: Authorization Code Grant checks](https://github.com/panva/openid-client/blob/main/docs/interfaces/AuthorizationCodeGrantChecks.md)
- [openid-client: Signature validation](https://github.com/panva/openid-client/blob/main/docs/functions/enableNonRepudiationChecks.md)
- [OWASP Multifactor Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet)
