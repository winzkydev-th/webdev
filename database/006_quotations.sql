BEGIN;
CREATE UNIQUE INDEX quote_offer_request ON quote_offers(request_id);
CREATE TABLE quotation_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quote_requests(id),
 snapshot jsonb NOT NULL, html_document text NOT NULL, sha256 char(64) NOT NULL,
 created_by uuid NOT NULL REFERENCES staff_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER protect_quotation_documents BEFORE UPDATE OR DELETE ON quotation_documents FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
ALTER TABLE quote_revisions ALTER COLUMN document_attachment_id DROP NOT NULL;
ALTER TABLE quote_revisions ADD COLUMN document_id uuid UNIQUE REFERENCES quotation_documents(id);
ALTER TABLE quote_revisions ADD COLUMN created_by uuid REFERENCES staff_users(id);
UPDATE quote_revisions r SET created_by=o.created_by FROM quote_offers o WHERE o.id=r.offer_id;
ALTER TABLE quote_revisions ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE quote_revisions ADD COLUMN draft_key uuid UNIQUE;
ALTER TABLE quote_revisions ADD COLUMN payload_hash char(64);
ALTER TABLE quote_revisions ADD COLUMN valid_until date;
ALTER TABLE quote_revisions ADD COLUMN line_items jsonb NOT NULL DEFAULT '[]';
ALTER TABLE quote_revisions ADD COLUMN terms text;
ALTER TABLE quote_revisions ADD COLUMN tax_note text;
ALTER TABLE quote_revisions ADD COLUMN revision_reason text;
ALTER TABLE quote_revisions ADD COLUMN approval_document_sha char(64);
ALTER TABLE quote_revisions ADD CONSTRAINT quotation_has_one_document CHECK(num_nonnulls(document_id,document_attachment_id)=1);
CREATE TABLE quotation_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL UNIQUE REFERENCES quote_revisions(id),
 request_id uuid NOT NULL REFERENCES quote_requests(id), delivery_key uuid NOT NULL UNIQUE, payload_hash char(64) NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','line','other')), recipient text NOT NULL,
 evidence_reference text NOT NULL, evidence_attachment_id uuid NOT NULL REFERENCES attachments(id),
 evidence_sha char(64) NOT NULL, document_sha char(64) NOT NULL, sent_at timestamptz NOT NULL,
 recorded_by uuid NOT NULL REFERENCES staff_users(id), recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER protect_quotation_deliveries BEFORE UPDATE OR DELETE ON quotation_deliveries FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE FUNCTION protect_quote_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Quotation revisions are append-only'; END IF;
 IF (NEW.offer_id,NEW.revision,NEW.currency,NEW.amount,NEW.document_id,NEW.document_attachment_id,NEW.created_by,NEW.draft_key,NEW.payload_hash,NEW.valid_until,NEW.line_items,NEW.terms,NEW.tax_note,NEW.revision_reason,NEW.created_at)
 IS DISTINCT FROM (OLD.offer_id,OLD.revision,OLD.currency,OLD.amount,OLD.document_id,OLD.document_attachment_id,OLD.created_by,OLD.draft_key,OLD.payload_hash,OLD.valid_until,OLD.line_items,OLD.terms,OLD.tax_note,OLD.revision_reason,OLD.created_at)
 THEN RAISE EXCEPTION 'Quotation content is immutable; create a revision'; END IF;
 IF OLD.approved_by IS NOT NULL AND (NEW.approved_by,NEW.approved_at,NEW.approval_document_sha) IS DISTINCT FROM (OLD.approved_by,OLD.approved_at,OLD.approval_document_sha) THEN RAISE EXCEPTION 'Approval is immutable'; END IF;
 IF NEW.approved_by IS NOT NULL AND OLD.approved_by IS NULL THEN
 IF NEW.approved_by=NEW.created_by THEN RAISE EXCEPTION 'Independent approver required'; END IF;
 IF NEW.document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM quotation_documents d JOIN quote_offers o ON o.id=NEW.offer_id WHERE d.id=NEW.document_id AND d.request_id=o.request_id AND d.sha256=NEW.approval_document_sha) THEN RAISE EXCEPTION 'Approved document hash mismatch'; END IF;
 END IF;
 IF OLD.sent_at IS NOT NULL AND (NEW.sent_at,NEW.delivery_evidence) IS DISTINCT FROM (OLD.sent_at,OLD.delivery_evidence) THEN RAISE EXCEPTION 'Delivery evidence is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_quote_revision BEFORE UPDATE OR DELETE ON quote_revisions FOR EACH ROW EXECUTE FUNCTION protect_quote_revision();
CREATE FUNCTION latest_quotation_delivered(request uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
 SELECT 1 FROM quote_revisions r JOIN quote_offers o ON o.id=r.offer_id
 JOIN quotation_documents d ON d.id=r.document_id JOIN quotation_deliveries l ON l.revision_id=r.id
 JOIN attachments a ON a.id=l.evidence_attachment_id
 WHERE o.request_id=request AND r.revision=(SELECT max(r2.revision) FROM quote_revisions r2 WHERE r2.offer_id=o.id)
 AND l.request_id=o.request_id AND d.request_id=o.request_id AND a.request_id=o.request_id
 AND r.approved_by IS NOT NULL AND r.approval_document_sha=d.sha256 AND l.document_sha=d.sha256
 AND r.sent_at=l.sent_at AND l.sent_at>=r.approved_at AND length(trim(l.evidence_reference))>0
 AND a.scan_status='clean' AND a.object_state='stored' AND a.sha256=l.evidence_sha
 );
$$;
CREATE OR REPLACE FUNCTION record_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; reason_text text; allowed boolean;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 actor:=nullif(current_setting('app.actor_id',true),'')::uuid;
 reason_text:=nullif(trim(current_setting('app.change_reason',true)),'');
 IF actor IS NULL THEN RAISE EXCEPTION 'Verified actor required'; END IF;
 allowed:=CASE OLD.status
 WHEN 'New' THEN NEW.status IN ('Assigned','Closed')
 WHEN 'Assigned' THEN NEW.status IN ('Reviewing','Closed')
 WHEN 'Reviewing' THEN NEW.status IN ('Need Information','Preparing Quote','Closed')
 WHEN 'Need Information' THEN NEW.status IN ('Reviewing','Closed')
 WHEN 'Preparing Quote' THEN NEW.status IN ('Need Information','Quoted','Closed')
 WHEN 'Quoted' THEN NEW.status IN ('Preparing Quote','Accepted','Declined','Closed')
 WHEN 'Accepted' THEN NEW.status='Closed' WHEN 'Declined' THEN NEW.status='Closed' ELSE false END;
 IF NOT allowed THEN RAISE EXCEPTION 'Invalid status transition'; END IF;
 IF NEW.status='Assigned' AND NEW.assigned_to IS NULL THEN RAISE EXCEPTION 'Assignee required'; END IF;
 IF NEW.status='Closed' AND reason_text IS NULL THEN RAISE EXCEPTION 'Closure reason required'; END IF;
 IF NEW.status='Quoted' AND NOT latest_quotation_delivered(NEW.id) THEN RAISE EXCEPTION 'Latest approved quotation delivery evidence required'; END IF;
 NEW.version:=OLD.version+1;NEW.updated_at:=now();
 INSERT INTO quote_status_history(request_id,from_status,to_status,actor_id,reason) VALUES(NEW.id,OLD.status,NEW.status,actor,reason_text);
 RETURN NEW;
END; $$;
COMMIT;
