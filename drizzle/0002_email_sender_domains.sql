CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_sender_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  created_by_user_id uuid REFERENCES users(id),
  provider text NOT NULL DEFAULT 'resend'
    CHECK (provider IN ('resend')),
  domain text NOT NULL,
  provider_domain_id text NOT NULL,
  region text NOT NULL DEFAULT 'sa-east-1'
    CHECK (region IN ('us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1')),
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'pending', 'verified', 'partially_verified', 'partially_failed', 'failed', 'temporary_failure')),
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  spf_status text NOT NULL DEFAULT 'not_started',
  dkim_status text NOT NULL DEFAULT 'not_started',
  dmarc_status text NOT NULL DEFAULT 'missing'
    CHECK (dmarc_status IN ('missing', 'verified', 'invalid', 'lookup_failed')),
  dmarc_record text,
  last_checked_at timestamp,
  verified_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_sender_domains_business_domain_uidx
  ON email_sender_domains (business_id, domain);
CREATE UNIQUE INDEX IF NOT EXISTS email_sender_domains_provider_domain_uidx
  ON email_sender_domains (provider, provider_domain_id);
CREATE INDEX IF NOT EXISTS email_sender_domains_business_status_idx
  ON email_sender_domains (business_id, status);
