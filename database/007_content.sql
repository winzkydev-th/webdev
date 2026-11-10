BEGIN;
INSERT INTO pages(slug) SELECT unnest(ARRAY['','about','services','sea-freight','air-freight','land-freight','customs-clearance','request-a-quote','news','contact','privacy','terms']) ON CONFLICT DO NOTHING;
CREATE TABLE cms_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), translation_id uuid NOT NULL REFERENCES translations(id),
 revision integer NOT NULL CHECK(revision>0), title text NOT NULL, description text NOT NULL, body jsonb NOT NULL,
 author_id uuid NOT NULL REFERENCES staff_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 save_key uuid NOT NULL UNIQUE, payload_hash char(64) NOT NULL, test_only boolean NOT NULL,
 UNIQUE(translation_id,revision), UNIQUE(translation_id,id)
);
ALTER TABLE translations ADD COLUMN current_revision_id uuid;
ALTER TABLE translations ADD COLUMN published_revision_id uuid;
ALTER TABLE translations ADD CONSTRAINT cms_current_matches FOREIGN KEY(id,current_revision_id) REFERENCES cms_revisions(translation_id,id);
ALTER TABLE translations ADD CONSTRAINT cms_published_matches FOREIGN KEY(id,published_revision_id) REFERENCES cms_revisions(translation_id,id);
CREATE TABLE cms_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),translation_id uuid NOT NULL REFERENCES translations(id),
 revision_id uuid NOT NULL REFERENCES cms_revisions(id),action text NOT NULL CHECK(action IN ('saved','submitted','published','unpublished')),
 actor_id uuid NOT NULL REFERENCES staff_users(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER cms_revisions_immutable BEFORE UPDATE OR DELETE ON cms_revisions FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER cms_events_immutable BEFORE UPDATE OR DELETE ON cms_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE FUNCTION cms_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r cms_revisions; actor staff_users; BEGIN
 IF NEW.published_revision_id IS NOT NULL AND NEW.published_revision_id IS DISTINCT FROM OLD.published_revision_id THEN
 SELECT * INTO r FROM cms_revisions WHERE id=NEW.published_revision_id AND translation_id=NEW.id;
 SELECT * INTO actor FROM staff_users WHERE id=NEW.reviewed_by;
 IF r.id IS NULL OR r.author_id=NEW.reviewed_by OR NOT actor.active OR actor.role NOT IN ('owner','manager') OR NEW.published_at IS NULL OR NEW.state<>'published' OR NEW.current_revision_id<>r.id THEN RAISE EXCEPTION 'Independent content approval required'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER cms_publication_guard BEFORE UPDATE ON translations FOR EACH ROW EXECUTE FUNCTION cms_publication_guard();
COMMIT;
