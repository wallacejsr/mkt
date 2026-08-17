CREATE TABLE IF NOT EXISTS email_dispatch_worker_state (
  id text PRIMARY KEY DEFAULT 'main',
  status text NOT NULL DEFAULT 'idle',
  last_started_at timestamp,
  last_completed_at timestamp,
  last_error text,
  campaigns_processed integer NOT NULL DEFAULT 0,
  recipients_processed integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  updated_at timestamp DEFAULT now()
);

INSERT INTO email_dispatch_worker_state (id, status)
VALUES ('main', 'idle')
ON CONFLICT (id) DO NOTHING;
