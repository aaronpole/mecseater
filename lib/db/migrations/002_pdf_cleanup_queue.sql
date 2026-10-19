CREATE TABLE pdf_cleanup_queue (
  object_key TEXT PRIMARY KEY CHECK (btrim(object_key) <> ''),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('staging', 'queued')),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdf_cleanup_queue_status_queued_at
  ON pdf_cleanup_queue (status, queued_at);

INSERT INTO schema_migrations (version)
VALUES ('002_pdf_cleanup_queue');
