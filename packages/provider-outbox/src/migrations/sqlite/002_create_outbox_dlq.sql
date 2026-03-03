CREATE TABLE IF NOT EXISTS conduit_outbox_dlq (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  handler_id TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  entry TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS conduit_outbox_dlq_operation_name_idx
  ON conduit_outbox_dlq (operation_name, created_at);
