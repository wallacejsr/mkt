CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  created_by_user_id uuid REFERENCES users(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'paused', 'completed', 'cancelled', 'failed')),
  subject text NOT NULL,
  preview_text text,
  html_body text,
  text_body text NOT NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  reply_to_email text,
  audience_filters jsonb DEFAULT '{}'::jsonb,
  template_variables jsonb DEFAULT '[]'::jsonb,
  legal_basis text,
  processing_purpose text,
  balance_test_reference text,
  include_unsubscribe boolean NOT NULL DEFAULT true,
  provider text,
  provider_batch_id text,
  total_recipients integer NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  queued_count integer NOT NULL DEFAULT 0 CHECK (queued_count >= 0),
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  delivered_count integer NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  opened_count integer NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  clicked_count integer NOT NULL DEFAULT 0 CHECK (clicked_count >= 0),
  bounced_count integer NOT NULL DEFAULT 0 CHECK (bounced_count >= 0),
  complained_count integer NOT NULL DEFAULT 0 CHECK (complained_count >= 0),
  unsubscribed_count integer NOT NULL DEFAULT 0 CHECK (unsubscribed_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  scheduled_at timestamp,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_campaigns_business_status_idx
  ON email_campaigns (business_id, status);
CREATE INDEX IF NOT EXISTS email_campaigns_scheduled_idx
  ON email_campaigns (status, scheduled_at);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  normalized_email text NOT NULL,
  recipient_name text,
  company_name text,
  personalization jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed', 'suppressed', 'cancelled')),
  provider_message_id text,
  last_error text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  scheduled_at timestamp,
  last_attempt_at timestamp,
  sent_at timestamp,
  delivered_at timestamp,
  opened_at timestamp,
  clicked_at timestamp,
  bounced_at timestamp,
  complained_at timestamp,
  unsubscribed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_recipients_campaign_email_uidx
  ON email_campaign_recipients (campaign_id, normalized_email);
CREATE UNIQUE INDEX IF NOT EXISTS email_recipients_unsubscribe_token_uidx
  ON email_campaign_recipients (unsubscribe_token);
CREATE INDEX IF NOT EXISTS email_recipients_dispatch_idx
  ON email_campaign_recipients (campaign_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS email_recipients_provider_message_idx
  ON email_campaign_recipients (provider_message_id);
CREATE INDEX IF NOT EXISTS email_recipients_business_email_idx
  ON email_campaign_recipients (business_id, normalized_email);

CREATE TABLE IF NOT EXISTS email_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text,
  event_type text NOT NULL
    CHECK (event_type IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed', 'suppressed')),
  payload jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_events_provider_event_uidx
  ON email_campaign_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_events_campaign_occurred_idx
  ON email_campaign_events (campaign_id, occurred_at);
CREATE INDEX IF NOT EXISTS email_events_recipient_idx
  ON email_campaign_events (recipient_id);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  email text NOT NULL,
  normalized_email text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'link'
    CHECK (source IN ('link', 'one_click', 'complaint', 'manual', 'provider')),
  unsubscribed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribes_business_email_uidx
  ON email_unsubscribes (business_id, normalized_email);
CREATE INDEX IF NOT EXISTS email_unsubscribes_campaign_idx
  ON email_unsubscribes (campaign_id);

CREATE TABLE IF NOT EXISTS email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  source_campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  source_recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  email text NOT NULL,
  normalized_email text NOT NULL,
  reason text NOT NULL
    CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'invalid', 'manual')),
  provider text,
  provider_reference text,
  details jsonb DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  suppressed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_suppressions_business_email_uidx
  ON email_suppressions (business_id, normalized_email);
CREATE INDEX IF NOT EXISTS email_suppressions_active_reason_idx
  ON email_suppressions (business_id, active, reason);
