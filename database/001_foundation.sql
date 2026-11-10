BEGIN;
CREATE TYPE staff_role AS ENUM ('owner','manager','sales','editor','viewer');
CREATE TYPE quote_status AS ENUM ('New','Assigned','Reviewing','Need Information','Preparing Quote','Quoted','Accepted','Declined','Closed');
CREATE TYPE freight_service AS ENUM ('sea','air','land','customs');
CREATE TABLE staff_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity_subject text UNIQUE NOT NULL,
 role staff_role NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_name text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE contacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES customers(id), name text NOT NULL, email text NOT NULL, phone text NOT NULL);
CREATE SEQUENCE quote_reference_seq;
CREATE TABLE quote_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text NOT NULL UNIQUE DEFAULT ('KPN-' || lpad(nextval('quote_reference_seq')::text,10,'0')),
 idempotency_key uuid NOT NULL UNIQUE, payload_hash text NOT NULL CHECK(length(payload_hash)=64),
 contact_id uuid NOT NULL REFERENCES contacts(id), locale text NOT NULL CHECK(locale IN ('th','en','zh')),
 service freight_service NOT NULL, status quote_status NOT NULL DEFAULT 'New',
 assigned_to uuid REFERENCES staff_users(id), version integer NOT NULL DEFAULT 1,
 privacy_notice_version text NOT NULL, privacy_acknowledged_at timestamptz NOT NULL,
 marketing_consent boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quote_cargo_details (
 request_id uuid PRIMARY KEY REFERENCES quote_requests(id), origin text NOT NULL, destination text NOT NULL,
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 4000), weight_kg numeric CHECK(weight_kg>0),
 container_mode text CHECK(container_mode IN ('FCL','LCL')), customs_direction text CHECK(customs_direction IN ('import','export'))
);
CREATE TABLE quote_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id), assignee_id uuid NOT NULL REFERENCES staff_users(id), assigned_by uuid NOT NULL REFERENCES staff_users(id), assigned_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE quote_activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id), actor_id uuid NOT NULL REFERENCES staff_users(id), channel text NOT NULL, note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id),
 object_key text NOT NULL UNIQUE, original_name text NOT NULL, media_type text NOT NULL CHECK(media_type IN ('application/pdf','image/png','image/jpeg')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760), sha256 text NOT NULL CHECK(length(sha256)=64),
 scan_status text NOT NULL DEFAULT 'quarantined' CHECK(scan_status IN ('quarantined','clean','rejected')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quote_offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id), created_by uuid NOT NULL REFERENCES staff_users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE quote_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid NOT NULL REFERENCES quote_offers(id), revision integer NOT NULL CHECK(revision>0),
 currency char(3) NOT NULL, amount numeric(18,2) NOT NULL CHECK(amount>=0),
 document_attachment_id uuid NOT NULL REFERENCES attachments(id), approved_by uuid REFERENCES staff_users(id), approved_at timestamptz,
 delivery_evidence text, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(offer_id,revision), CHECK((approved_by IS NULL)=(approved_at IS NULL)), CHECK(sent_at IS NULL OR (approved_by IS NOT NULL AND length(trim(delivery_evidence))>0))
);
CREATE TABLE quote_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id),
 from_status quote_status, to_status quote_status NOT NULL, actor_id uuid REFERENCES staff_users(id), reason text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id),
 event_key text NOT NULL UNIQUE, event_type text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, provider_message_id text, last_error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_due ON notifications(next_attempt_at) WHERE state IN ('pending','failed');
CREATE INDEX quote_inbox ON quote_requests(status,created_at DESC);
CREATE INDEX quote_staff_inbox ON quote_requests(assigned_to,status,created_at DESC);
CREATE TABLE pages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE);
CREATE TABLE translations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), page_id uuid NOT NULL REFERENCES pages(id), locale text NOT NULL CHECK(locale IN ('th','en','zh')),
 title text NOT NULL, description text NOT NULL, body jsonb NOT NULL DEFAULT '{}',
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','review','published')),
 version integer NOT NULL DEFAULT 1, reviewed_by uuid REFERENCES staff_users(id), published_at timestamptz,
 UNIQUE(page_id,locale), CHECK(state<>'published' OR (reviewed_by IS NOT NULL AND published_at IS NOT NULL))
);
CREATE TABLE media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_key text NOT NULL UNIQUE, approved_by uuid REFERENCES staff_users(id), approved_at timestamptz, alt_text jsonb NOT NULL DEFAULT '{}');
CREATE TABLE system_settings (key text PRIMARY KEY, value jsonb NOT NULL, approved_by uuid REFERENCES staff_users(id), approved_at timestamptz);
INSERT INTO system_settings(key,value) VALUES ('company','{"name":"KPN WAGON LOGISTICS COMPANY LIMITED","phone":null,"email":null,"address":null,"domain":null,"logoApproved":false,"publicationApproved":false}');
CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES staff_users(id), action text NOT NULL, entity_type text NOT NULL, entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'History is append-only'; END; $$;
CREATE TRIGGER protect_status_history BEFORE UPDATE OR DELETE ON quote_status_history FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER protect_audit_log BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE FUNCTION initialize_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO quote_status_history(request_id,to_status) VALUES(NEW.id,NEW.status);
 INSERT INTO notifications(request_id,event_key,event_type) VALUES(NEW.id,NEW.id::text || ':created','quote.created');
 RETURN NEW;
END; $$;
CREATE TRIGGER initialize_request AFTER INSERT ON quote_requests FOR EACH ROW EXECUTE FUNCTION initialize_request();
CREATE FUNCTION record_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; reason_text text; allowed boolean;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 actor := nullif(current_setting('app.actor_id',true),'')::uuid;
 reason_text := nullif(trim(current_setting('app.change_reason',true)),'');
 IF actor IS NULL THEN RAISE EXCEPTION 'Verified actor required'; END IF;
 allowed := CASE OLD.status
 WHEN 'New' THEN NEW.status IN ('Assigned','Closed')
 WHEN 'Assigned' THEN NEW.status IN ('Reviewing','Closed')
 WHEN 'Reviewing' THEN NEW.status IN ('Need Information','Preparing Quote','Closed')
 WHEN 'Need Information' THEN NEW.status IN ('Reviewing','Closed')
 WHEN 'Preparing Quote' THEN NEW.status IN ('Need Information','Quoted','Closed')
 WHEN 'Quoted' THEN NEW.status IN ('Preparing Quote','Accepted','Declined','Closed')
 WHEN 'Accepted' THEN NEW.status='Closed'
 WHEN 'Declined' THEN NEW.status='Closed' ELSE false END;
 IF NOT allowed THEN RAISE EXCEPTION 'Invalid status transition'; END IF;
 IF NEW.status='Assigned' AND NEW.assigned_to IS NULL THEN RAISE EXCEPTION 'Assignee required'; END IF;
 IF NEW.status='Closed' AND reason_text IS NULL THEN RAISE EXCEPTION 'Closure reason required'; END IF;
 IF NEW.status='Quoted' AND NOT EXISTS (
 SELECT 1 FROM quote_revisions r JOIN quote_offers o ON o.id=r.offer_id
 JOIN attachments a ON a.id=r.document_attachment_id
 WHERE o.request_id=NEW.id AND a.request_id=NEW.id AND a.scan_status='clean'
 AND r.approved_by IS NOT NULL AND r.sent_at IS NOT NULL AND length(trim(r.delivery_evidence))>0
 ) THEN RAISE EXCEPTION 'Approved, clean quotation and delivery evidence required'; END IF;
 NEW.version:=OLD.version+1; NEW.updated_at:=now();
 INSERT INTO quote_status_history(request_id,from_status,to_status,actor_id,reason) VALUES(NEW.id,OLD.status,NEW.status,actor,reason_text);
 RETURN NEW;
END; $$;
CREATE TRIGGER record_status BEFORE UPDATE ON quote_requests FOR EACH ROW EXECUTE FUNCTION record_status_change();
COMMIT;
