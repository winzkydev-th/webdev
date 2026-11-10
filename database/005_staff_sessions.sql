BEGIN;
ALTER TABLE staff_users ADD COLUMN oidc_issuer text;
ALTER TABLE staff_users ADD COLUMN display_name text NOT NULL DEFAULT 'Staff';
ALTER TABLE staff_users ADD COLUMN auth_version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX staff_oidc_identity ON staff_users(oidc_issuer,identity_subject) WHERE oidc_issuer IS NOT NULL;
CREATE TABLE staff_login_transactions (
 state_hash char(64) PRIMARY KEY, expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE staff_sessions (
 token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES staff_users(id), auth_version integer NOT NULL,
 auth_time timestamptz NOT NULL, mfa_verified boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_session_user ON staff_sessions(user_id);
CREATE FUNCTION invalidate_staff_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.role,NEW.active,NEW.identity_subject,NEW.oidc_issuer) IS DISTINCT FROM (OLD.role,OLD.active,OLD.identity_subject,OLD.oidc_issuer) THEN
 NEW.auth_version:=OLD.auth_version+1;
 UPDATE staff_sessions SET revoked_at=now() WHERE user_id=OLD.id AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER invalidate_staff_sessions BEFORE UPDATE ON staff_users FOR EACH ROW EXECUTE FUNCTION invalidate_staff_sessions();
COMMIT;
