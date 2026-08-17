ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS send_rate_per_minute integer NOT NULL DEFAULT 30;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS daily_limit integer NOT NULL DEFAULT 500;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 10;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS last_dispatch_at timestamp;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS paused_at timestamp;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS email_recipients_campaign_status_attempt_idx
  ON email_campaign_recipients (campaign_id, status, last_attempt_at);
CREATE INDEX IF NOT EXISTS email_recipients_business_sent_idx
  ON email_campaign_recipients (business_id, sent_at);
