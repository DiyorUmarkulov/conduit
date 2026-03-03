export const OUTBOX_SQL_MIGRATIONS = {
  postgres: [
    `CREATE TABLE IF NOT EXISTS conduit_outbox (
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
  ON conduit_outbox (partition_key, created_at);`,
    `CREATE TABLE IF NOT EXISTS conduit_outbox_dlq (
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
  ON conduit_outbox_dlq (operation_name, created_at DESC);`
  ],
  mysql: [
    `CREATE TABLE IF NOT EXISTS conduit_outbox (
  id CHAR(36) PRIMARY KEY,
  operation_id CHAR(36) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  operation_type VARCHAR(32) NOT NULL,
  handler_id VARCHAR(255) NOT NULL,
  route JSON NOT NULL,
  envelope JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  attempt_number INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NOT NULL,
  partition_key VARCHAR(255) NULL,
  last_error TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  delivered_at DATETIME(3) NULL,
  KEY conduit_outbox_status_next_attempt_idx (status, next_attempt_at, created_at),
  KEY conduit_outbox_partition_key_idx (partition_key, created_at)
) ENGINE=InnoDB;`,
    `CREATE TABLE IF NOT EXISTS conduit_outbox_dlq (
  id CHAR(36) PRIMARY KEY,
  operation_id CHAR(36) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  handler_id VARCHAR(255) NOT NULL,
  attempts INT NOT NULL,
  last_error TEXT NOT NULL,
  entry JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY conduit_outbox_dlq_operation_name_idx (operation_name, created_at)
) ENGINE=InnoDB;`
  ],
  sqlite: [
    `CREATE TABLE IF NOT EXISTS conduit_outbox (
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
  ON conduit_outbox (partition_key, created_at);`,
    `CREATE TABLE IF NOT EXISTS conduit_outbox_dlq (
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
  ON conduit_outbox_dlq (operation_name, created_at);`
  ]
} as const;

export type OutboxSqlDialect = keyof typeof OUTBOX_SQL_MIGRATIONS;
