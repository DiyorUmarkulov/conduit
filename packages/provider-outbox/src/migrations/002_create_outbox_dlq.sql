CREATE TABLE IF NOT EXISTS conduit_outbox_dlq (
  id UUID PRIMARY KEY,
  operation_id UUID NOT NULL,
  operation_name TEXT NOT NULL,
  handler_id TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  entry JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conduit_outbox_dlq_operation_name_idx
  ON conduit_outbox_dlq (operation_name, created_at DESC);
