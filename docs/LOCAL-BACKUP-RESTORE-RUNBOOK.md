# KPN — Local Backup / Restore Runbook
Scope: Windows local test/local staging only. Not a production backup deployment.

## Safety boundary
Use the original repository and PostgreSQL 18 tools. No automatic DATABASE_URL fallback. The source must be explicitly configured as loopback 127.0.0.1 with a kpn_local_test_<32 hex> or kpn_local_staging_<32 hex> database, inside a cluster explicitly named kpn-local-*. Maintenance confirmation is required: stop application writes, notification/scanner jobs, schema changes and object cleanup for the capture. The dump uses an exported read-only repeatable-read snapshot; non-MVCC sequences and filesystem objects still require this maintenance window. Do not set confirmation while writers are active.

Restore permits only another loopback cluster marked kpn-local-restore-*. Source/target ports must differ; recorded source system identifier must differ from the restore system identifier. It generates a new kpn_restore_<uuid> database with CREATE DATABASE; existing names cannot be overwritten. It does not use --clean or pg_restore --create. No database drop or overwrite command exists in this tool. Never restore an untrusted dump, or use these local tools against real customer/production data.

## Prerequisites and secure directories
pg_dump.exe and pg_restore.exe 18.6 are in ignored .local/tools/postgresql-18.6. They were extracted from the EDB portable ZIP, not installed as a system service. SHA256 of the downloaded ZIP: E2246BA91D22345BC3D017586C09EDE52D9DF180B1EEB480F050445F1CAD84E2 (locally computed, not a separately verified vendor digest). Source: https://www.enterprisedb.com/download-postgresql-binaries .

Use newly created directories protected for the current Windows user and SYSTEM only; do not repurpose public/project document folders. The helper privateDirectory creates these restricted directories and removes inherited access. Key directory must be separate from the backup vault. Keys are 32 random bytes encrypted with Windows DPAPI CurrentUser and never printed. Do not place passwords, raw keys, decrypted dumps or backups in Git. Do not point paths at LOGO, public/, existing business folders or another environment's data directory.

## Repeat the complete isolated drill
From E:/KPN WAGON LOGISTICS COMPANY LIMITED/web run npm run test:backup. Optional KPN_BACKUP_EVIDENCE sets a new JSON evidence output path; use a dedicated file. This starts two fresh PostgreSQL clusters on 55448/55449, creates new synthetic data, performs actual encrypted backups and two actual restores, compares tables/schema/sequences/objects, checks corruption failures and automatic scheduling, then stops its clusters. It does not read or reopen previous .local clusters or use customer data. A failed check stops the drill; successful evidence is written only after all checks finish. Retained synthetic files are for diagnosis, not an active staging environment.

## Operator commands for a separately prepared local staging environment
Do not start these until that staging source and maintenance window are configured. Set credentials only in the process environment, never command arguments or tracked files:
- KPN_BACKUP_MODE=local-test or local-staging
- KPN_BACKUP_SOURCE_URL: explicit local source connection; no fallback
- KPN_BACKUP_MAINTENANCE_CONFIRMED=true only while writers/jobs are stopped
- KPN_BACKUP_OBJECT_ROOTS: JSON map of storage aliases to absolute private object directories; each root contains UUID-keyed files, no links/subdirectories
- KPN_BACKUP_VAULT: absolute protected backup directory
- KPN_BACKUP_KEY_FILE: DPAPI-wrapped key in a separate protected directory
- KPN_PG_DUMP / KPN_PG_RESTORE: absolute paths to the tools
- For restore only, KPN_RESTORE_ADMIN_URL points to the new isolated target cluster's postgres database, and KPN_RESTORE_BASE is an absolute protected directory

Initialize the key once with node scripts/local-backup.mjs --init-key; the file must not already exist. Run npm run backup:once for a manual snapshot. Run npm run backup:worker for an automatic worker. Default interval is 86400 seconds (24 hours after success), not a promise that a 24-hour production cycle has been observed. Retry is 60 seconds after a failed backup; state is persisted to schedule-state.json. PostgreSQL advisory locks prevent overlapping capture/ticks and release when a process exits. Worker must remain running; it is not an installed Windows task. After a computer restart it must be launched again by an approved startup/scheduler arrangement. No such persistent task was installed here because the fixed local staging environment has not been provisioned yet.

For restore, pass the absolute completed backup folder to npm run backup:restore -- <folder>. Never change application URLs to the restored database until checks and owner review finish. The restore tool decrypts/authenticates into a fresh protected directory, verifies dump and object hashes before creating the target database, invokes pg_restore with --single-transaction --exit-on-error --no-owner --no-acl, and compares data/schema fingerprints. Only a successful full match creates VERIFIED.json. Decrypted temporary dump/manifest files are removed in finally; restored private objects remain in the protected restore directory. Failed/incomplete folders are not accepted as completed backups. Do not start the website or outbound workers automatically against a restored copy.

## What to verify and retain
Keep COMPLETE.json and encrypted database.enc, manifest.enc, and objects/*.enc together. The authenticated encrypted manifest holds full per-table counts/hash, sequence values, schema hashes, dump hash and object inventory. COMPLETE.json alone is not proof of a restore. Verify all 27 tables (including empty tables), migration checksums, status/audit/quotation evidence, staff roles, three-language CMS, notification queue, sequences and each object's size/hash. Validate a new restore after every relevant schema/storage change, not merely a process restart. Record elapsed times only for the dataset actually used.

No automatic deletion/retention pruning was enabled. Before real operation, approve retention and expiry rules (including backups containing personal data), disk-space alerts, failed/late-backup alerts, a second failure-domain copy, and an independent recovery-key escrow. DPAPI CurrentUser alone is insufficient after losing the Windows profile or this whole computer. Retain an approved recovery mechanism before relying on this for disaster recovery. Do not email backup archives or keys. Local administrator/SYSTEM can take ownership; NTFS ACLs are not immutable offsite storage.

## Explicit limitations
Logical database + current local private objects only; no WAL/PITR, offsite/cloud-object versioning, global PostgreSQL roles/passwords or database ACL restore. Runtime SQL roles/grants must be recreated from reviewed infrastructure/runbooks before application use. Staff role records ARE included as application data. No production identity/provider/credentials are backed up or configured by this drill. Real recovery SLAs, large-volume timings, automatic startup after reboot, 24-hour continuity and off-machine disaster recovery are not certified here. These are deployment/release dependencies; AC-14 was not started.
