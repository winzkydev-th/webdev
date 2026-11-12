# KPN WAGON — Project Status

งานโค้ด Local ตามขอบเขตนี้เสร็จ 100% เจ้าของตรวจรับ M-01 (จำกัด Login), M-02 (CSP แบบ nonce), M-03 (ตรวจจับและแจ้งเตือนภายใน) วันที่ 12 พ.ย. 2569 หลักฐานที่ commit `6b076aa`
Auth/MFA ใช้ OIDC client กับ IdP จำลองที่แยกบน loopback ส่วนอัปโหลดใช้ `FileScanner` และ `ClamAvScanner` โดยกักไฟล์เมื่อสแกนไม่สำเร็จ

Production ยังไม่พร้อม เกณฑ์โครงการ 12/14 (85.7%) AC-13 รอโดเมน AC-14 รอทดสอบ IdP/MFA, ClamAV, HTTPS/TLS, advisory ปัจจุบันและ CSP บนเบราว์เซอร์ปกติ เงื่อนไข Production ของ AC-11 อยู่ใน [acceptance-status.json](acceptance-status.json)

## ตัวแปร .env สำหรับ Production

- ระบบและฐานข้อมูล — `APP_ENV=production`, `APP_ORIGIN`, `DATABASE_URL`, `STAFF_DATABASE_URL`, `CMS_DATABASE_URL`
- Staff และ IdP — `STAFF_ORIGIN`, `STAFF_SESSION_KEY`, `STAFF_EDGE_KEY`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_MFA_ACR_VALUES`, `STAFF_AUTH_ENABLED` ส่วน `BOOTSTRAP_STAFF_SUBJECT`, `BOOTSTRAP_STAFF_NAME` ใช้ตอนตั้ง Owner ครั้งแรก
- ใบเสนอราคาและ CMS — `QUOTE_INTAKE_MODE`, `PRIVACY_NOTICE_VERSION`, `RATE_LIMIT_SECRET`, `QUOTATION_MODE`, `QUOTATION_EVIDENCE_ROOT`, `COMPANY_QUOTATION_APPROVED`, `CMS_MODE`, `COMPANY_PUBLICATION_APPROVED`
- แจ้งเตือน — `NOTIFICATION_MODE`, `NOTIFICATION_FROM`, `NOTIFICATION_STAFF_EMAIL`, `RESEND_API_KEY`, `NOTIFICATION_TEMPLATES_APPROVED`, `COMPANY_COMMUNICATIONS_APPROVED`
- โดเมนและ SEO — `PUBLIC_SITE_URL`, `PUBLIC_SITE_DOMAIN_APPROVED`, `SEO_INDEXING_ENABLED`
- ปิดโหมดทดสอบด้วย `OIDC_ALLOW_LOOPBACK_TEST=false`, `CSP_LOCAL_TEST=false` เปิดฟีเจอร์และธงอนุมัติเมื่อมีข้อมูลและการอนุมัติจริง เก็บค่าลับในที่จัดเก็บ secrets
- ไฟล์แนบ — `ATTACHMENT_SCANNER_MODE=clamav-local` ใช้ได้เฉพาะ Local ปัจจุบันยังไม่มีค่า .env สำหรับเปิด worker สแกน Production หรือเชื่อม Object Storage
