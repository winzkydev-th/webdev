BEGIN;
ALTER TABLE notifications ADD COLUMN lease_token uuid;
ALTER TABLE notifications ADD COLUMN first_attempt_at timestamptz;
ALTER TABLE notifications ADD COLUMN dead_at timestamptz;
ALTER TABLE notifications ADD COLUMN sent_at timestamptz;
ALTER TABLE notifications ADD COLUMN message jsonb;
ALTER TABLE notifications ADD CONSTRAINT notification_lease_pair CHECK ((lease_token IS NULL) = (lease_until IS NULL));
CREATE INDEX notification_recovery ON notifications(lease_until) WHERE state='processing' AND dead_at IS NULL;
CREATE TABLE notification_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid NOT NULL REFERENCES notifications(id),
 attempt integer NOT NULL, lease_token uuid NOT NULL UNIQUE, started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz, outcome text NOT NULL DEFAULT 'processing' CHECK(outcome IN ('processing','sent','failed','expired','dead')),
 error_code text, UNIQUE(notification_id,attempt)
);
CREATE OR REPLACE FUNCTION initialize_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO quote_status_history(request_id,to_status) VALUES(NEW.id,NEW.status);
 INSERT INTO notifications(request_id,event_key,event_type) VALUES
 (NEW.id,NEW.id::text || ':created:staff','quote.created.staff'),
 (NEW.id,NEW.id::text || ':created:customer','quote.created.customer');
 RETURN NEW;
END; $$;
-- Legacy unsent events represent the original staff alert. Do not resend sent history.
UPDATE notifications SET event_type='quote.created.staff' WHERE event_type='quote.created' AND state<>'sent';
COMMIT;
