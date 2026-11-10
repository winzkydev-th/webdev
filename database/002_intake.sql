BEGIN;
CREATE TABLE intake_rate_limits (
 bucket text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL CHECK(hits>0)
);
CREATE INDEX intake_rate_expiry ON intake_rate_limits(window_start);
-- Correct lpad truncation when the sequence eventually grows beyond ten digits.
ALTER TABLE quote_requests ALTER COLUMN reference SET DEFAULT ('KPN-' || nextval('quote_reference_seq')::text);
COMMIT;
