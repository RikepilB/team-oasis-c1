CREATE TABLE IF NOT EXISTS synapse_documents (
 namespace text NOT NULL, key text NOT NULL, content text NOT NULL,
 PRIMARY KEY(namespace,key)
);
CREATE TABLE IF NOT EXISTS synapse_audit (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 namespace text NOT NULL, event_id text NOT NULL, payload text NOT NULL,
 UNIQUE(namespace,event_id)
);
CREATE INDEX IF NOT EXISTS synapse_audit_namespace ON synapse_audit(namespace,sequence);
CREATE OR REPLACE FUNCTION synapse_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Synapse immutable row'; END $$;
DROP TRIGGER IF EXISTS synapse_audit_immutable ON synapse_audit;
CREATE TRIGGER synapse_audit_immutable BEFORE UPDATE OR DELETE ON synapse_audit FOR EACH ROW EXECUTE FUNCTION synapse_immutable();
CREATE OR REPLACE FUNCTION synapse_protect_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.key LIKE 'snapshots/%' OR OLD.key LIKE 'exports/%' THEN
  IF TG_OP = 'DELETE' OR NEW.content <> OLD.content THEN RAISE EXCEPTION 'Synapse immutable evidence/export'; END IF;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.key LIKE 'records/%' AND (
  (OLD.content::jsonb)->'original_text' IS DISTINCT FROM (NEW.content::jsonb)->'original_text' OR
  (OLD.content::jsonb)->'dataset_id' IS DISTINCT FROM (NEW.content::jsonb)->'dataset_id' OR
  (OLD.content::jsonb)->'snapshot_id' IS DISTINCT FROM (NEW.content::jsonb)->'snapshot_id') THEN
  RAISE EXCEPTION 'Synapse immutable report source';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS synapse_document_guard ON synapse_documents;
CREATE TRIGGER synapse_document_guard BEFORE UPDATE OR DELETE ON synapse_documents FOR EACH ROW EXECUTE FUNCTION synapse_protect_document();
