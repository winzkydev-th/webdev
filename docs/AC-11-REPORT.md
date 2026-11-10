# KPN WAGON — AC-11 Backup / Restore Acceptance
Date: 2026-11-10. Completed: 10 พฤศจิกายน 2569 เวลา 19:09:57 (Asia/Bangkok).

## Result
Passed: actual local-development backup/restore drill. All 6 subchecks passed (7 tests including the parent suite). Owner review is pending; STOP before AC-14. This is not approval of Production backup operations, persistent Windows scheduling or whole-machine disaster recovery.

## 1. สิ่งที่ดำเนินการ
ตรวจของเดิมก่อนแก้: ไม่มี KPN Windows Scheduled Task, ไม่มีไฟล์ .env Production และไม่มี DATABASE_URL/STAFF_DATABASE_URL/CMS_DATABASE_URL ในสภาพแวดล้อมที่ตรวจ ไม่พบบริการ PostgreSQL ของโครงการที่ตั้งเป็นระบบถาวร โฟลเดอร์ .local เดิมเป็นฐานทดสอบ ไม่ใช่ Backup และไม่ได้อ่านข้อมูลภายในหรือเปิดฐานเดิม

สำรอง Git ก่อนแก้: tag backup/before-ac11, commit 171cb91418f794e597493ababae4c0d258374f56 และไฟล์ KPN-Git-Before-AC11.bundle ซึ่งตรวจ verify ผ่าน ไม่มีการ push ภายนอก

เครื่องมือเดิมขาด pg_dump/pg_restore จึงรายงานก่อนดาวน์โหลด ZIP ทางการและแตกเฉพาะเครื่องมือ 18.6/DLL ไป .local/tools ไม่ติดตั้งบริการ ไม่เปลี่ยน PATH ระบบ ไม่แก้ฐานเดิม เพิ่มเครื่องมือ Local Backup/Restore เท่านั้น ไม่เปลี่ยนสถาปัตยกรรม เว็บ migration หรือระบบธุรกิจที่ผ่านแล้ว

สำรองด้วย pg_dump custom format และ snapshot แบบอ่านอย่างเดียว เข้ารหัส AES-256-GCM ครอบคลุม dump, manifest และไฟล์แนบ/สื่อ กุญแจแยกจาก vault และห่อด้วย DPAPI CurrentUser สิทธิ์ NTFS ของ vault/keys ปิด inheritance และให้เฉพาะ Windows user ปัจจุบันกับ SYSTEM ตามหลักฐาน ACL

## 2. ไฟล์ที่สร้างหรือแก้ไข
Created: scripts/lib/local-backup.mjs; scripts/local-backup.mjs; tests/backup.integration.mjs; docs/LOCAL-BACKUP-RESTORE-RUNBOOK.md; docs/AC-11-REPORT.md; docs/AC-11-VERIFICATION.md; docs/evidence/ac11/restore-evidence.json.
Modified: package.json (4 backup/test commands only); README.md (backup instructions/status); docs/acceptance-status.json.
Deliverables outside repo: KPN-AC-11-Report.md; KPN-AC-11-Restore-Verification.md; KPN-Local-Backup-Restore-Runbook.md; AC-11-restore-evidence.json; KPN-Git-Before-AC11.bundle.
Ignored local artifacts: 18.6 portable tools, encrypted backup vault, separate DPAPI key, two test cluster directories and isolated restore objects under .local/ac11-*. No raw dump, key or database cluster is committed to Git. Existing LOGO and business files untouched.

## 3. ผล Backup และ Restore จริง
Dataset: 27 tables / 89 rows / 5 actual private files. Four freight services, TH/EN/ZH, staff roles, CMS history, notifications, quote revisions/approval/delivery, audit and attachment/media objects were included. Source: port 55448; restore cluster: port 55449, different PostgreSQL system identifier and separate directory. No real customer data used.
Backup 233e09c5-e27e-450f-9be7-83d2fce6dd13: 740 ms. Restore 1: 1222 ms; Restore 2: 1089 ms. These timings describe only this small test dataset, not a Production RTO.
Both restores used new database names; no DROP, --clean or overwrite. Final full source fingerprint matched its pre-backup fingerprint exactly. No website or outbound worker was connected to restored data. Test clusters were stopped afterward.

## 4. หลักฐานความครบถ้วนหลัง Restore
Every row of all 27 tables was fingerprinted before capture and compared after restore; counts alone were not used. Both restores matched table hashes, sequence last_value/is_called, column/default definitions, constraints, functions, triggers, indexes and view hashes. All 5 files matched size and SHA256. Migration checksum rows matched. Restored quotation delivery relationship returned valid, published CMS retained 3 locales, all constraints validated, append-only guards blocked changes and next reference sequence advanced correctly. Full per-table/object evidence is in KPN-AC-11-Restore-Verification.md and AC-11-restore-evidence.json.
Wrong key and deliberately corrupted encrypted dump were rejected before any target database was created; database counts unchanged. Same-cluster restore and an unallowlisted database name were rejected. These checks are backup-specific and do not constitute AC-14 acceptance.

## Automatic backups and storage
No pre-existing KPN automatic backup task was found. New worker completed 2 actual wall-clock automatic cycles with a 2-second test interval (10 พฤศจิกายน 2569 เวลา 19:09:52 and 10 พฤศจิกายน 2569 เวลา 19:09:55). Another process read the persisted due time and skipped an early run. A failed backup recorded failure, waited the configured 1-second test retry, then completed successfully. Default operational worker interval is 24 hours; retry default 60 seconds. A real 24-hour cycle was not observed.
Worker stopped after the drill. No permanent Windows task, automatic login/reboot startup or Production schedule was installed. This is deliberately left for the approved fixed local-staging setup; it is not an unattended backup guarantee. No automatic retention deletion is enabled.

## 5. ข้อจำกัดและปัญหาที่ยังเหลือ
Only the local database/object adapter is covered. Production/cloud object backups, offsite copy, retention/PDPA expiry, disk and missed-backup alerts, recovery-key escrow, global PostgreSQL roles/passwords/grants, WAL/PITR and reboot/whole-machine-loss recovery remain deployment work. DPAPI depends on the current Windows profile; do not rely on it alone after machine/profile loss. Automatic captures require stopped writers/jobs for database/file/sequence consistency. No customer data permission or Production connection was assumed.
Initial attempts failed while collecting Windows ACL evidence because inherited PowerShell 7 module paths were incompatible with Windows PowerShell 5.1. Child-process module resolution was corrected without OS-wide changes. The drill harness now stops after a failed subcheck and emits successful acceptance evidence only after all checks pass. Incomplete first-attempt output was excluded from acceptance evidence. The final complete run passed all checks; no old backend suite was rerun.

## 6. สถานะ Acceptance ล่าสุด
AC-11: Passed development restore drill; owner review required before starting AC-14. Development count: 12/14 = 85.7%, crossing the 80% reporting milestone on actual evidence. ProductionReady=false. AC-13 remains Pending approved domain and actual-host evidence. AC-14 remains Pending and NOT STARTED by this work. No claim of 14/14 or Production readiness.

งานหยุดที่จุดนี้เพื่อให้เจ้าของตรวจรายงานและอนุมัติ AC-11 ก่อนเริ่ม AC-14 ตามคำสั่ง ไม่มีการซื้อโดเมน/Hosting หรือตั้ง Production/Local Staging ใหม่

References: PostgreSQL pg_dump https://www.postgresql.org/docs/18/app-pgdump.html ; pg_restore https://www.postgresql.org/docs/18/app-pgrestore.html ; EDB portable binaries https://www.enterprisedb.com/download-postgresql-binaries .
