CREATE TABLE IF NOT EXISTS conduit_outbox_dlq (
  id CHAR(36) PRIMARY KEY,
  operation_id CHAR(36) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  handler_id VARCHAR(255) NOT NULL,
  attempts INT NOT NULL,
  last_error TEXT NOT NULL,
  entry JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY conduit_outbox_dlq_operation_name_idx (operation_name, created_at)
) ENGINE=InnoDB;
