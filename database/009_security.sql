BEGIN;
CREATE TABLE security_rate_buckets (
 bucket char(64) PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL CHECK(hits>0)
);
CREATE INDEX security_rate_expiry ON security_rate_buckets(window_start);
CREATE TABLE security_event_windows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,route_group text NOT NULL,
 window_start timestamptz NOT NULL DEFAULT date_trunc('minute',now()),hits integer NOT NULL DEFAULT 1,
 last_seen_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,route_group,window_start)
);
CREATE TABLE security_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),window_id uuid NOT NULL UNIQUE REFERENCES security_event_windows(id),
 kind text NOT NULL,route_group text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE security_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),window_id uuid NOT NULL UNIQUE REFERENCES security_event_windows(id),
 kind text NOT NULL,route_group text NOT NULL,threshold integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE security_alert_acknowledgements (
 alert_id uuid PRIMARY KEY REFERENCES security_alerts(id),actor_id uuid NOT NULL REFERENCES staff_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER security_events_immutable BEFORE UPDATE OR DELETE ON security_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER security_alerts_immutable BEFORE UPDATE OR DELETE ON security_alerts FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER security_alert_ack_immutable BEFORE UPDATE OR DELETE ON security_alert_acknowledgements FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
COMMIT;
