CREATE TABLE IF NOT EXISTS conduit_outbox (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  handler_id TEXT NOT NULL,
  route TEXT NOT NULL,
  envelope TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  partition_key TEXT NULL,
  last_error TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS conduit_outbox_status_next_attempt_idx
  ON conduit_outbox (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS conduit_outbox_partition_key_idx
  ON conduit_outbox (partition_key, created_at);
