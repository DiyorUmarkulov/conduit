CREATE TABLE IF NOT EXISTS conduit_outbox (
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
) ENGINE=InnoDB;
