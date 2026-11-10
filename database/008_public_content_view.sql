BEGIN;
CREATE VIEW cms_published_content WITH (security_barrier=true) AS
 SELECT p.slug,t.locale,r.title,r.description,r.body,r.test_only
 FROM pages p JOIN translations t ON t.page_id=p.id
 JOIN cms_revisions r ON r.id=t.published_revision_id AND r.translation_id=t.id;
COMMIT;
