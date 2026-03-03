CREATE TABLE IF NOT EXISTS conduit_outbox (
  id UUID PRIMARY KEY,
  operation_id UUID NOT NULL,
  operation_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  handler_id TEXT NOT NULL,
  route JSONB NOT NULL,
  envelope JSONB NOT NULL,
  status TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  partition_key TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS conduit_outbox_status_next_attempt_idx
  ON conduit_outbox (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS conduit_outbox_partition_key_idx
  ON conduit_outbox (partition_key, created_at);
