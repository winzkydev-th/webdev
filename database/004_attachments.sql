BEGIN;
ALTER TABLE attachments ADD COLUMN object_state text NOT NULL DEFAULT 'pending' CHECK(object_state IN ('pending','stored','failed'));
ALTER TABLE attachments ADD COLUMN upload_key uuid;
ALTER TABLE attachments ADD COLUMN last_error_code text;
ALTER TABLE attachments ADD COLUMN scan_lease_token uuid;
ALTER TABLE attachments ADD COLUMN scan_lease_until timestamptz;
ALTER TABLE attachments ADD COLUMN scan_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE attachments ADD COLUMN next_scan_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE attachments ADD CONSTRAINT attachment_scan_lease CHECK((scan_lease_token IS NULL)=(scan_lease_until IS NULL));
CREATE UNIQUE INDEX attachment_upload_idempotency ON attachments(request_id,upload_key) WHERE upload_key IS NOT NULL;
CREATE TABLE attachment_upload_permits (
 token_hash char(64) PRIMARY KEY, request_id uuid NOT NULL REFERENCES quote_requests(id),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachment_permit_expiry ON attachment_upload_permits(expires_at);
COMMIT;
