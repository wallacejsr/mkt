/**
 * Vercel Serverless Function — 100% self-contained JavaScript.
 * No TypeScript, no esbuild, no drizzle. Just Express + pg.
 */
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodeCrypto = require('crypto');
const dnsPromises = require('dns').promises;

const app = express();

// CORS + JSON
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json({
  limit: '4mb',
  verify: (req, _res, buffer) => {
    if (req.originalUrl?.startsWith('/api/prospecting/email/webhooks/')) req.rawBody = buffer.toString('utf8');
  },
}));

const JWT_SECRET = process.env.JWT_SECRET || 'mkt-agro-bw-secret-key-2026';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function getDbUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  return url;
}

function createPool() {
  return new Pool({
    connectionString: getDbUrl(),
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000,
  });
}

function verifyToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split('Bearer ')[1], JWT_SECRET); }
  catch { return null; }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESEND_REGIONS = new Set(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']);
function emailEnv(name) { return String(process.env[name] || '').trim(); }
function getResendProviderStatus() {
  const apiKey = emailEnv('RESEND_API_KEY');
  const fromAddress = emailEnv('EMAIL_FROM_ADDRESS');
  const fromName = emailEnv('EMAIL_FROM_NAME');
  const replyTo = emailEnv('EMAIL_REPLY_TO');
  const missingVariables = [];
  if (!apiKey) missingVariables.push('RESEND_API_KEY');
  if (!fromAddress || !EMAIL_PATTERN.test(fromAddress)) missingVariables.push('EMAIL_FROM_ADDRESS');
  if (!fromName) missingVariables.push('EMAIL_FROM_NAME');
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) missingVariables.push('EMAIL_REPLY_TO');
  return {
    provider: 'resend', apiConfigured: Boolean(apiKey), webhookConfigured: Boolean(emailEnv('RESEND_WEBHOOK_SECRET')),
    configured: missingVariables.length === 0, missingVariables,
    fromName: fromName || null, fromAddress: fromAddress || null, replyTo: replyTo || null,
    sendingDomain: fromAddress.includes('@') ? fromAddress.split('@')[1].toLowerCase() : null,
  };
}

async function sendWithResend(input) {
  const status = getResendProviderStatus();
  const fromAddress = String(input.fromAddress || status.fromAddress || '').trim().toLowerCase();
  const fromName = String(input.fromName || status.fromName || '').trim();
  const replyTo = String(input.replyTo || status.replyTo || '').trim().toLowerCase();
  const missingVariables = [];
  if (!status.apiConfigured) missingVariables.push('RESEND_API_KEY');
  if (!EMAIL_PATTERN.test(fromAddress)) missingVariables.push('EMAIL_FROM_ADDRESS');
  if (!fromName) missingVariables.push('EMAIL_FROM_NAME');
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) missingVariables.push('EMAIL_REPLY_TO');
  if (missingVariables.length) {
    const error = new Error(`Configuração de e-mail incompleta: ${missingVariables.join(', ')}`);
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    error.missingVariables = missingVariables;
    throw error;
  }
  if (!EMAIL_PATTERN.test(input.to)) throw new Error('Destinatário de teste inválido.');
  if (!String(input.subject || '').trim() || !String(input.text || '').trim() || !String(input.html || '').trim()) {
    throw new Error('Assunto e conteúdo do e-mail são obrigatórios.');
  }
  if (!String(input.idempotencyKey || '').trim() || String(input.idempotencyKey).length > 256) {
    throw new Error('Chave de idempotência inválida.');
  }
  if (/\r|\n/.test(fromName) || /\r|\n/.test(String(input.subject || ''))) throw new Error('Cabeçalho de e-mail inválido.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${emailEnv('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MarketingOS/1.0',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [String(input.to).toLowerCase()], subject: input.subject, html: input.html, text: input.text,
        reply_to: replyTo || undefined,
        headers: input.headers || undefined,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) throw new Error(payload.message || payload.error?.message || `Resend respondeu com status ${response.status}.`);
    return { provider: 'resend', messageId: String(payload.id) };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Tempo limite excedido ao conectar com o Resend.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function normalizeSendingDomain(value) {
  const domain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!DOMAIN_PATTERN.test(domain)) {
    const error = new Error('Informe um dominio valido, sem http, caminho ou e-mail. Exemplo: mail.suaempresa.com.br.');
    error.code = 'EMAIL_DOMAIN_VALIDATION';
    throw error;
  }
  return domain;
}

async function resendDomainRequest(path, init = {}) {
  const apiKey = emailEnv('RESEND_API_KEY');
  if (!apiKey) {
    const error = new Error('Configuração de e-mail incompleta: RESEND_API_KEY');
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    error.missingVariables = ['RESEND_API_KEY'];
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.resend.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MarketingOS/1.0',
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error?.message || `Resend respondeu com status ${response.status}.`);
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Tempo limite excedido ao conectar com o Resend.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function summarizeDnsRecords(records, kind) {
  const statuses = records.filter(item => String(item.record || '').toUpperCase() === kind).map(item => String(item.status || 'not_started'));
  if (!statuses.length) return 'not_started';
  if (statuses.every(status => status === 'verified')) return 'verified';
  if (statuses.some(status => ['failed', 'temporary_failure'].includes(status))) return 'failed';
  if (statuses.some(status => status === 'verified')) return 'partially_verified';
  if (statuses.some(status => status === 'pending')) return 'pending';
  return statuses[0];
}

function mapResendDomain(payload) {
  const records = Array.isArray(payload.records) ? payload.records : [];
  return {
    provider: 'resend', providerDomainId: String(payload.id || ''), domain: normalizeSendingDomain(payload.name),
    region: RESEND_REGIONS.has(payload.region) ? payload.region : 'sa-east-1', status: String(payload.status || 'not_started'), records,
    spfStatus: summarizeDnsRecords(records, 'SPF'), dkimStatus: summarizeDnsRecords(records, 'DKIM'),
  };
}

async function createResendDomain(domainValue, regionValue = 'sa-east-1') {
  const domain = normalizeSendingDomain(domainValue);
  const region = String(regionValue || 'sa-east-1');
  if (!RESEND_REGIONS.has(region)) {
    const error = new Error('Regiao de envio invalida.');
    error.code = 'EMAIL_DOMAIN_VALIDATION';
    throw error;
  }
  return mapResendDomain(await resendDomainRequest('/domains', {
    method: 'POST', body: JSON.stringify({ name: domain, region, capabilities: { sending: 'enabled', receiving: 'disabled' } }),
  }));
}

async function findResendDomain(domainValue) {
  const domain = normalizeSendingDomain(domainValue);
  let after = '';
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ limit: '100' });
    if (after) query.set('after', after);
    const payload = await resendDomainRequest(`/domains?${query.toString()}`);
    const domains = Array.isArray(payload.data) ? payload.data : [];
    const match = domains.find(item => String(item?.name || '').trim().toLowerCase() === domain);
    if (match?.id) return getResendDomain(String(match.id));
    if (!payload.has_more || !domains.length) return null;
    after = String(domains.at(-1)?.id || '');
    if (!after) return null;
  }
  throw new Error('A listagem de dominios da Resend excedeu o limite de seguranca.');
}

async function createOrAdoptResendDomain(domainValue, regionValue = 'sa-east-1') {
  const existing = await findResendDomain(domainValue);
  if (existing) return { ...existing, adopted: true };
  try {
    return { ...(await createResendDomain(domainValue, regionValue)), adopted: false };
  } catch (error) {
    const concurrentlyCreated = await findResendDomain(domainValue);
    if (concurrentlyCreated) return { ...concurrentlyCreated, adopted: true };
    throw error;
  }
}

async function getResendDomain(providerDomainId) {
  return mapResendDomain(await resendDomainRequest(`/domains/${encodeURIComponent(providerDomainId)}`));
}

async function verifyResendDomain(providerDomainId) {
  await resendDomainRequest(`/domains/${encodeURIComponent(providerDomainId)}/verify`, { method: 'POST' });
  return getResendDomain(providerDomainId);
}

async function checkDomainDmarc(domainValue) {
  const domain = normalizeSendingDomain(domainValue);
  const labels = domain.split('.');
  const commonSecondLevel = new Set(['com', 'net', 'org', 'co', 'gov', 'edu', 'agr']);
  const rootLabelCount = labels.at(-1)?.length === 2 && commonSecondLevel.has(labels.at(-2) || '') ? 3 : 2;
  const organizationalDomain = labels.length > rootLabelCount ? labels.slice(-rootLabelCount).join('.') : domain;
  const candidates = [...new Set([domain, organizationalDomain])];
  let lastLookupError = false;
  for (const candidate of candidates) {
    const checkedHost = `_dmarc.${candidate}`;
    try {
      const answers = await dnsPromises.resolveTxt(checkedHost);
      const records = answers.map(parts => parts.join('')).filter(Boolean);
      const dmarc = records.find(record => /^v=DMARC1\s*;/i.test(record));
      if (dmarc) return { status: 'verified', record: dmarc, checkedHost };
      if (records.length) return { status: 'invalid', record: records.join(' | '), checkedHost };
    } catch (error) {
      if (!['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(error.code)) lastLookupError = true;
    }
  }
  return { status: lastLookupError ? 'lookup_failed' : 'missing', record: null, checkedHost: `_dmarc.${organizationalDomain}` };
}

async function ensureEmailSenderDomainSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS email_sender_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
    business_id uuid NOT NULL REFERENCES businesses(id), created_by_user_id uuid REFERENCES users(id),
    provider text NOT NULL DEFAULT 'resend', domain text NOT NULL, provider_domain_id text NOT NULL,
    region text NOT NULL DEFAULT 'sa-east-1', status text NOT NULL DEFAULT 'not_started',
    dns_records jsonb NOT NULL DEFAULT '[]'::jsonb, spf_status text NOT NULL DEFAULT 'not_started',
    dkim_status text NOT NULL DEFAULT 'not_started', dmarc_status text NOT NULL DEFAULT 'missing', dmarc_record text,
    last_checked_at timestamp, verified_at timestamp, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
  )`);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS email_sender_domains_business_domain_uidx ON email_sender_domains (business_id, domain)');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS email_sender_domains_provider_domain_uidx ON email_sender_domains (provider, provider_domain_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS email_sender_domains_business_status_idx ON email_sender_domains (business_id, status)');
}

async function ensureEmailCampaignSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      business_id uuid NOT NULL REFERENCES businesses(id), created_by_user_id uuid REFERENCES users(id),
      name text NOT NULL, status text NOT NULL DEFAULT 'draft', subject text NOT NULL, preview_text text,
      html_body text, text_body text NOT NULL, sender_name text NOT NULL, sender_email text NOT NULL, reply_to_email text,
      audience_filters jsonb DEFAULT '{}'::jsonb, template_variables jsonb DEFAULT '[]'::jsonb,
      legal_basis text, processing_purpose text, balance_test_reference text, include_unsubscribe boolean NOT NULL DEFAULT true,
      provider text, provider_batch_id text, total_recipients integer NOT NULL DEFAULT 0, queued_count integer NOT NULL DEFAULT 0,
      sent_count integer NOT NULL DEFAULT 0, delivered_count integer NOT NULL DEFAULT 0, opened_count integer NOT NULL DEFAULT 0,
      clicked_count integer NOT NULL DEFAULT 0, bounced_count integer NOT NULL DEFAULT 0, complained_count integer NOT NULL DEFAULT 0,
      unsubscribed_count integer NOT NULL DEFAULT 0, failed_count integer NOT NULL DEFAULT 0,
      scheduled_at timestamp, started_at timestamp, completed_at timestamp, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS email_campaigns_business_status_idx ON email_campaigns (business_id, status);
    CREATE TABLE IF NOT EXISTS email_campaign_recipients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      business_id uuid NOT NULL REFERENCES businesses(id), campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
      prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL, lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
      email text NOT NULL, normalized_email text NOT NULL, recipient_name text, company_name text,
      personalization jsonb DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'queued', provider_message_id text, last_error text,
      attempt_count integer NOT NULL DEFAULT 0, unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(), scheduled_at timestamp,
      last_attempt_at timestamp, sent_at timestamp, delivered_at timestamp, opened_at timestamp, clicked_at timestamp,
      bounced_at timestamp, complained_at timestamp, unsubscribed_at timestamp, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS email_recipients_campaign_email_uidx ON email_campaign_recipients (campaign_id, normalized_email);
    CREATE UNIQUE INDEX IF NOT EXISTS email_recipients_unsubscribe_token_uidx ON email_campaign_recipients (unsubscribe_token);
    CREATE INDEX IF NOT EXISTS email_recipients_provider_message_idx ON email_campaign_recipients (provider_message_id);
    CREATE TABLE IF NOT EXISTS email_campaign_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      business_id uuid NOT NULL REFERENCES businesses(id), campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
      recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE CASCADE, provider text NOT NULL,
      provider_event_id text, event_type text NOT NULL, payload jsonb DEFAULT '{}'::jsonb,
      occurred_at timestamp NOT NULL, created_at timestamp DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS email_events_provider_event_uidx ON email_campaign_events (provider,provider_event_id) WHERE provider_event_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS email_events_campaign_occurred_idx ON email_campaign_events (campaign_id,occurred_at);
    CREATE TABLE IF NOT EXISTS email_unsubscribes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      business_id uuid NOT NULL REFERENCES businesses(id), campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
      recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL, email text NOT NULL, normalized_email text NOT NULL,
      reason text, source text NOT NULL DEFAULT 'link', unsubscribed_at timestamp NOT NULL DEFAULT now(), created_at timestamp DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribes_business_email_uidx ON email_unsubscribes (business_id, normalized_email);
    CREATE TABLE IF NOT EXISTS email_suppressions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      business_id uuid NOT NULL REFERENCES businesses(id), source_campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
      source_recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL, email text NOT NULL, normalized_email text NOT NULL,
      reason text NOT NULL, provider text, provider_reference text, details jsonb DEFAULT '{}'::jsonb, active boolean NOT NULL DEFAULT true,
      suppressed_at timestamp NOT NULL DEFAULT now(), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS email_suppressions_business_email_uidx ON email_suppressions (business_id, normalized_email);
    CREATE TABLE IF NOT EXISTS email_dispatch_worker_state (
      id text PRIMARY KEY DEFAULT 'main',status text NOT NULL DEFAULT 'idle',last_started_at timestamp,last_completed_at timestamp,
      last_error text,campaigns_processed integer NOT NULL DEFAULT 0,recipients_processed integer NOT NULL DEFAULT 0,
      sent_count integer NOT NULL DEFAULT 0,failed_count integer NOT NULL DEFAULT 0,updated_at timestamp DEFAULT now()
    );
    INSERT INTO email_dispatch_worker_state (id,status) VALUES ('main','idle') ON CONFLICT (id) DO NOTHING;
  `);
  await pool.query(`
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS send_rate_per_minute integer NOT NULL DEFAULT 30;
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS daily_limit integer NOT NULL DEFAULT 500;
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 10;
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS last_dispatch_at timestamp;
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS paused_at timestamp;
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
    ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS last_error text;
    CREATE INDEX IF NOT EXISTS email_recipients_campaign_status_attempt_idx ON email_campaign_recipients (campaign_id,status,last_attempt_at);
    CREATE INDEX IF NOT EXISTS email_recipients_business_sent_idx ON email_campaign_recipients (business_id,sent_at);
  `);
}

function parseRawEmailAudienceFilters(input = {}) {
  return {
    origin: ['search', 'spreadsheet'].includes(input.origin) ? input.origin : 'all',
    status: ['new', 'reviewed', 'qualified', 'imported'].includes(input.status) ? input.status : 'all',
    fit: ['high', 'medium', 'low'].includes(input.fit) ? input.fit : 'all',
    state: String(input.state || '').trim().toUpperCase().slice(0, 2),
    segment: String(input.segment || '').trim().slice(0, 160),
  };
}

function rawEmailAudienceWhere(businessId, filters, firstParameter = 1) {
  const values = [businessId];
  const parameter = value => { values.push(value); return `$${firstParameter + values.length - 1}`; };
  const conditions = [
    `p.business_id=$${firstParameter}`, "p.email IS NOT NULL", "BTRIM(p.email)<>''", "COALESCE(p.status,'new')<>'disqualified'",
  ];
  if (filters.origin === 'spreadsheet') conditions.push("p.source_type='spreadsheet'");
  if (filters.origin === 'search') conditions.push("COALESCE(p.source_type,'search')='search'");
  if (filters.status !== 'all') conditions.push(`p.status=${parameter(filters.status)}`);
  if (filters.fit !== 'all') conditions.push(`p.qualification_fit=${parameter(filters.fit)}`);
  if (filters.state) conditions.push(`UPPER(COALESCE(p.state,''))=${parameter(filters.state)}`);
  if (filters.segment) conditions.push(`p.segment ILIKE ${parameter(`%${filters.segment}%`)}`);
  return { clause: conditions.join(' AND '), values };
}

function buildRawEmailHtml(textBody, visualStyle = 'simple', ctaText = '', ctaUrl = '') {
  const paragraphs = String(textBody || '').split(/\n{2,}/).filter(Boolean)
    .map(paragraph => `<p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1f2937">${escapeEmailHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const accent = visualStyle === 'simple' ? '' : '<tr><td height="4" bgcolor="#4f46e5" style="height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>';
  const cta = visualStyle === 'cta' ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#4f46e5" style="border-radius:4px"><a href="${escapeEmailHtml(ctaUrl)}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:18px;color:#ffffff;text-decoration:none">${escapeEmailHtml(ctaText)}</a></td></tr></table><div style="height:22px;line-height:22px;font-size:0">&nbsp;</div>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">${accent}<tr><td style="padding:${visualStyle === 'simple' ? '0' : '24px 0 0 0'};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1f2937">${paragraphs}${cta}</td></tr></table></td></tr></table>`;
}

async function rawEmailAudiencePreview(executor, businessId, filters) {
  const audience = rawEmailAudienceWhere(businessId, filters);
  const row = (await executor.query(`
    WITH scoped AS (
      SELECT LOWER(BTRIM(p.email)) AS normalized_email,
             (BTRIM(p.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$') AS valid
        FROM prospects p WHERE ${audience.clause}
    ), valid_unique AS (SELECT DISTINCT normalized_email FROM scoped WHERE valid),
    classified AS (
      SELECT v.normalized_email,
             EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.business_id=$1 AND u.normalized_email=v.normalized_email)
             OR EXISTS (SELECT 1 FROM email_suppressions s WHERE s.business_id=$1 AND s.normalized_email=v.normalized_email AND s.active=true) AS blocked
        FROM valid_unique v
    )
    SELECT (SELECT COUNT(*)::int FROM scoped) AS total_with_email,
           (SELECT COUNT(*)::int FROM scoped WHERE NOT valid) AS invalid_count,
           ((SELECT COUNT(*) FROM scoped WHERE valid)-(SELECT COUNT(*) FROM valid_unique))::int AS duplicate_count,
           (SELECT COUNT(*)::int FROM classified WHERE blocked) AS suppressed_count,
           (SELECT COUNT(*)::int FROM classified WHERE NOT blocked) AS eligible_count
  `, audience.values)).rows[0] || {};
  return {
    totalWithEmail: Number(row.total_with_email || 0), invalidCount: Number(row.invalid_count || 0),
    duplicateCount: Number(row.duplicate_count || 0), suppressedCount: Number(row.suppressed_count || 0),
    eligibleCount: Number(row.eligible_count || 0),
  };
}

function emailCampaignForClient(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, businessId: row.business_id, name: row.name, status: row.status,
    subject: row.subject, previewText: row.preview_text, textBody: row.text_body, senderName: row.sender_name,
    senderEmail: row.sender_email, replyToEmail: row.reply_to_email, audienceFilters: row.audience_filters || {},
    legalBasis: row.legal_basis, processingPurpose: row.processing_purpose, includeUnsubscribe: row.include_unsubscribe,
    totalRecipients: Number(row.total_recipients || 0), queuedCount: Number(row.queued_count || 0), sentCount: Number(row.sent_count || 0),
    deliveredCount: Number(row.delivered_count || 0), openedCount: Number(row.opened_count || 0), clickedCount: Number(row.clicked_count || 0),
    bouncedCount: Number(row.bounced_count || 0), complainedCount: Number(row.complained_count || 0),
    unsubscribedCount: Number(row.unsubscribed_count || 0), failedCount: Number(row.failed_count || 0),
    sendRatePerMinute: Number(row.send_rate_per_minute || 30), dailyLimit: Number(row.daily_limit || 500), batchSize: Number(row.batch_size || 10),
    startedAt: row.started_at, completedAt: row.completed_at, pausedAt: row.paused_at, lastDispatchAt: row.last_dispatch_at,
    lastError: row.last_error, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function dispatchAppUrl(value) {
  const url = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_URL inválida.');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('APP_URL deve usar HTTPS para disparos reais.');
  return url.origin;
}

async function rawMapWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) await worker(items[cursor++]);
  }));
}

async function processRawEmailCampaignBatch(pool, campaignId, businessId, appUrlValue, maxBatchSize) {
  const appUrl = dispatchAppUrl(appUrlValue);
  const client = await pool.connect();
  let campaign;
  let recipients = [];
  try {
    await client.query('BEGIN');
    campaign = (await client.query(
      `SELECT c.*,d.status AS domain_status,d.domain AS sending_domain FROM email_campaigns c
       LEFT JOIN LATERAL (SELECT status,domain FROM email_sender_domains WHERE business_id=c.business_id ORDER BY created_at DESC LIMIT 1) d ON true
       WHERE c.id=$1 AND c.business_id=$2 FOR UPDATE OF c`, [campaignId, businessId]
    )).rows[0];
    if (!campaign) throw new Error('Campanha de e-mail não encontrada.');
    if (campaign.status === 'scheduled') {
      const delay = new Date(campaign.scheduled_at).getTime() - Date.now();
      if (delay > 0) {
        await client.query('COMMIT');
        return { status: 'scheduled', processed: 0, sent: 0, failed: 0, throttled: true, reason: 'scheduled', nextAttemptMs: Math.min(60000, Math.max(2000, delay)) };
      }
      campaign.status = 'queued';
      await client.query("UPDATE email_campaigns SET status='queued',updated_at=NOW() WHERE id=$1", [campaign.id]);
    }
    if (!['queued', 'sending'].includes(campaign.status)) {
      await client.query('COMMIT');
      return { status: campaign.status, processed: 0, sent: 0, failed: 0, throttled: false };
    }
    if (campaign.domain_status !== 'verified') throw new Error('O domínio de envio não está verificado.');
    await client.query(
      `UPDATE email_campaign_recipients SET status='queued',updated_at=NOW() WHERE campaign_id=$1 AND status='processing'
       AND provider_message_id IS NULL AND last_attempt_at < NOW()-INTERVAL '15 minutes'`, [campaign.id]
    );
    const usage = (await client.query(
      `SELECT COUNT(*) FILTER (WHERE
                (status IN ('sent','delivered','opened','clicked') AND sent_at>=NOW()-INTERVAL '1 minute')
                OR (status='processing' AND last_attempt_at>=NOW()-INTERVAL '1 minute')
              )::int AS minute_count,
              COUNT(*) FILTER (WHERE
                (status IN ('sent','delivered','opened','clicked') AND sent_at>=date_trunc('day',NOW()))
                OR (status='processing' AND last_attempt_at>=date_trunc('day',NOW()))
              )::int AS day_count
       FROM email_campaign_recipients WHERE business_id=$1`, [businessId]
    )).rows[0];
    const minuteAvailable = Math.max(0, Number(campaign.send_rate_per_minute || 30) - Number(usage.minute_count || 0));
    const dayAvailable = Math.max(0, Number(campaign.daily_limit || 500) - Number(usage.day_count || 0));
    const claimLimit = Math.min(Number(campaign.batch_size || 10), maxBatchSize || Number.MAX_SAFE_INTEGER, minuteAvailable, dayAvailable);
    if (claimLimit <= 0) {
      await client.query('COMMIT');
      return { status: campaign.status, processed: 0, sent: 0, failed: 0, throttled: true, reason: dayAvailable <= 0 ? 'daily_limit' : 'minute_limit', nextAttemptMs: dayAvailable <= 0 ? 3600000 : 15000 };
    }
    recipients = (await client.query(
      `WITH candidates AS (SELECT id FROM email_campaign_recipients WHERE campaign_id=$1 AND status='queued' AND attempt_count<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $2)
       UPDATE email_campaign_recipients r SET status='processing',attempt_count=r.attempt_count+1,last_attempt_at=NOW(),updated_at=NOW()
       FROM candidates WHERE r.id=candidates.id RETURNING r.*`, [campaign.id, claimLimit]
    )).rows;
    await client.query("UPDATE email_campaigns SET status='sending',started_at=COALESCE(started_at,NOW()),last_dispatch_at=NOW(),last_error=NULL,updated_at=NOW() WHERE id=$1", [campaign.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }

  let sent = 0;
  let failed = 0;
  await rawMapWithConcurrency(recipients, 3, async recipient => {
    const unsubscribeUrl = `${appUrl}/api/prospecting/email/unsubscribe/${recipient.unsubscribe_token}`;
    const html = `${campaign.html_body}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px"><tr><td style="padding:20px 0 0 0;border-top:1px solid #d1d5db;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">Você recebeu este contato comercial por seu endereço profissional. <a href="${unsubscribeUrl}" style="color:#475569;text-decoration:underline">Não quero receber novos e-mails</a>.</td></tr></table></td></tr></table>`;
    const text = `${campaign.text_body}\n\nPara não receber novos contatos comerciais, acesse: ${unsubscribeUrl}`;
    try {
      const result = await sendWithResend({
        to: recipient.email, subject: campaign.subject, html, text, fromName: campaign.sender_name,
        fromAddress: campaign.sender_email, replyTo: campaign.reply_to_email || undefined,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        idempotencyKey: `campaign/${campaign.id}/recipient/${recipient.id}`,
      });
      sent++;
      await pool.query("UPDATE email_campaign_recipients SET status='sent',provider_message_id=$1,sent_at=NOW(),last_error=NULL,updated_at=NOW() WHERE id=$2 AND campaign_id=$3", [result.messageId, recipient.id, campaign.id]);
    } catch (error) {
      failed++;
      const nextStatus = Number(recipient.attempt_count || 1) >= 3 ? 'failed' : 'queued';
      await pool.query("UPDATE email_campaign_recipients SET status=$1,last_error=$2,updated_at=NOW() WHERE id=$3 AND campaign_id=$4 AND status='processing'", [nextStatus, String(error.message || 'Falha no provedor').slice(0, 1000), recipient.id, campaign.id]);
    }
  });
  const summary = (await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='queued')::int AS queued,COUNT(*) FILTER (WHERE status='processing')::int AS processing,
            COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,COUNT(*) FILTER (WHERE status IN ('failed','suppressed'))::int AS failed
     FROM email_campaign_recipients WHERE campaign_id=$1`, [campaign.id]
  )).rows[0];
  const completed = Number(summary.queued || 0) === 0 && Number(summary.processing || 0) === 0;
  const status = completed ? 'completed' : 'sending';
  await pool.query(
    `UPDATE email_campaigns SET status=$1,queued_count=$2,sent_count=$3,failed_count=$4,
     completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END,updated_at=NOW()
     WHERE id=$5 AND status NOT IN ('paused','cancelled')`,
    [status, Number(summary.queued || 0), Number(summary.sent || 0), Number(summary.failed || 0), campaign.id]
  );
  return { status, processed: recipients.length, sent, failed, throttled: false, remaining: Number(summary.queued || 0), totalSent: Number(summary.sent || 0), totalFailed: Number(summary.failed || 0), nextAttemptMs: completed ? null : Math.max(2000, Math.ceil(60000 * recipients.length / Number(campaign.send_rate_per_minute || 30))) };
}

function verifyRawEmailWorkerAuthorization(req) {
  const secret = emailEnv('CRON_SECRET');
  if (secret.length < 16) { const error = new Error('CRON_SECRET deve ter pelo menos 16 caracteres.'); error.code = 'WORKER_CONFIG'; throw error; }
  const provided = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  if (providedBytes.length !== expectedBytes.length || !nodeCrypto.timingSafeEqual(providedBytes, expectedBytes)) {
    const error = new Error('Worker não autorizado.'); error.code = 'WORKER_AUTH'; throw error;
  }
}

async function runRawEmailDispatchWorker(pool, appUrl) {
  const lockClient = await pool.connect();
  let locked = false;
  try {
    locked = Boolean((await lockClient.query("SELECT pg_try_advisory_lock(hashtext('marketing_os_email_dispatch_worker')) AS locked")).rows[0]?.locked);
    if (!locked) return { status: 'already_running', campaignsProcessed: 0, recipientsProcessed: 0, sent: 0, failed: 0 };
    await lockClient.query(
      `INSERT INTO email_dispatch_worker_state (id,status,last_started_at,last_error,updated_at)
       VALUES ('main','running',NOW(),NULL,NOW()) ON CONFLICT (id) DO UPDATE SET
       status='running',last_started_at=NOW(),last_error=NULL,updated_at=NOW()`
    );
    const campaigns = (await lockClient.query(
      `SELECT id,business_id FROM email_campaigns
       WHERE status IN ('queued','sending') OR (status='scheduled' AND scheduled_at<=NOW())
       ORDER BY COALESCE(last_dispatch_at,scheduled_at,created_at) ASC LIMIT 3`
    )).rows;
    const totals = { campaignsProcessed: 0, recipientsProcessed: 0, sent: 0, failed: 0 };
    const errors = [];
    for (const campaign of campaigns) {
      try {
        const result = await processRawEmailCampaignBatch(pool, campaign.id, campaign.business_id, appUrl, 4);
        totals.campaignsProcessed++;
        totals.recipientsProcessed += Number(result.processed || 0);
        totals.sent += Number(result.sent || 0);
        totals.failed += Number(result.failed || 0);
      } catch (error) {
        const message = String(error.message || 'Falha ao processar campanha').slice(0, 500);
        errors.push(`${campaign.id}: ${message}`);
        await lockClient.query('UPDATE email_campaigns SET last_error=$1,updated_at=NOW() WHERE id=$2', [message, campaign.id]);
      }
    }
    const status = errors.length ? 'partial_failure' : 'completed';
    await lockClient.query(
      `UPDATE email_dispatch_worker_state SET status=$1,last_completed_at=NOW(),last_error=$2,campaigns_processed=$3,
       recipients_processed=$4,sent_count=$5,failed_count=$6,updated_at=NOW() WHERE id='main'`,
      [status, errors.join(' | ') || null, totals.campaignsProcessed, totals.recipientsProcessed, totals.sent, totals.failed]
    );
    return { status, ...totals, errors: errors.length };
  } catch (error) {
    if (locked) await lockClient.query(
      "UPDATE email_dispatch_worker_state SET status='failed',last_completed_at=NOW(),last_error=$1,updated_at=NOW() WHERE id='main'",
      [String(error.message || 'Falha no worker').slice(0, 1000)]
    ).catch(() => {});
    throw error;
  } finally {
    if (locked) await lockClient.query("SELECT pg_advisory_unlock(hashtext('marketing_os_email_dispatch_worker'))").catch(() => {});
    lockClient.release();
  }
}

const RESEND_EVENT_TYPES = {
  'email.sent': 'sent', 'email.delivered': 'delivered', 'email.opened': 'opened', 'email.clicked': 'clicked',
  'email.bounced': 'bounced', 'email.complained': 'complained', 'email.failed': 'failed', 'email.suppressed': 'suppressed',
};

function verifyRawResendWebhook(req) {
  const secret = emailEnv('RESEND_WEBHOOK_SECRET');
  if (!secret) { const error = new Error('RESEND_WEBHOOK_SECRET não configurado.'); error.code = 'WEBHOOK_CONFIG'; throw error; }
  const id = String(req.get('svix-id') || '');
  const timestampValue = String(req.get('svix-timestamp') || '');
  const signatureHeader = String(req.get('svix-signature') || '');
  const rawBody = String(req.rawBody || '');
  if (!id || !timestampValue || !signatureHeader || !rawBody) { const error = new Error('Assinatura do webhook ausente.'); error.code = 'WEBHOOK_SIGNATURE'; throw error; }
  const timestamp = Number(timestampValue);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) { const error = new Error('Assinatura expirada.'); error.code = 'WEBHOOK_SIGNATURE'; throw error; }
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  if (!key.length) { const error = new Error('RESEND_WEBHOOK_SECRET inválido.'); error.code = 'WEBHOOK_CONFIG'; throw error; }
  const expected = nodeCrypto.createHmac('sha256', key).update(`${id}.${timestampValue}.${rawBody}`).digest();
  const valid = signatureHeader.split(/\s+/).map(value => value.split(',', 2)).some(([version, encoded]) => {
    if (version !== 'v1') return false;
    try { const received = Buffer.from(encoded || '', 'base64'); return received.length === expected.length && nodeCrypto.timingSafeEqual(received, expected); }
    catch { return false; }
  });
  if (!valid) { const error = new Error('Assinatura inválida.'); error.code = 'WEBHOOK_SIGNATURE'; throw error; }
  try { return { payload: JSON.parse(rawBody), eventId: id }; }
  catch { const error = new Error('Payload JSON inválido.'); error.code = 'WEBHOOK_SIGNATURE'; throw error; }
}

function safeRawResendPayload(payload) {
  return {
    type: payload.type, created_at: payload.created_at,
    data: {
      email_id: payload.data?.email_id, to: Array.isArray(payload.data?.to) ? payload.data.to.slice(0, 5) : [],
      subject: payload.data?.subject, bounce: payload.data?.bounce,
      click: payload.data?.click ? { link: payload.data.click.link, timestamp: payload.data.click.timestamp } : undefined,
    },
  };
}

async function processRawResendWebhook(pool, req, verifiedEvent) {
  const { payload, eventId } = verifiedEvent || verifyRawResendWebhook(req);
  const eventType = RESEND_EVENT_TYPES[String(payload?.type || '')];
  if (!eventType) return { accepted: true, ignored: true, reason: 'unsupported_event' };
  const messageId = String(payload?.data?.email_id || '').trim();
  if (!messageId) return { accepted: true, ignored: true, reason: 'missing_email_id' };
  const occurredAt = new Date(payload.created_at || Date.now());
  if (Number.isNaN(occurredAt.getTime())) { const error = new Error('Data do evento inválida.'); error.code = 'WEBHOOK_SIGNATURE'; throw error; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipient = (await client.query('SELECT * FROM email_campaign_recipients WHERE provider_message_id=$1 FOR UPDATE', [messageId])).rows[0];
    if (!recipient) { await client.query('COMMIT'); return { accepted: true, ignored: true, reason: 'recipient_not_found' }; }
    const inserted = (await client.query(
      `INSERT INTO email_campaign_events (organization_id,business_id,campaign_id,recipient_id,provider,provider_event_id,event_type,payload,occurred_at)
       VALUES ($1,$2,$3,$4,'resend',$5,$6,$7::jsonb,$8)
       ON CONFLICT (provider,provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING RETURNING id`,
      [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, eventId, eventType, JSON.stringify(safeRawResendPayload(payload)), occurredAt]
    )).rows[0];
    if (!inserted) { await client.query('COMMIT'); return { accepted: true, duplicate: true }; }
    const statusSql = {
      sent: "CASE WHEN status IN ('queued','processing') THEN 'sent' ELSE status END",
      delivered: "CASE WHEN status IN ('queued','processing','sent') THEN 'delivered' ELSE status END",
      opened: "CASE WHEN status IN ('bounced','complained','suppressed','unsubscribed','cancelled') THEN status ELSE 'opened' END",
      clicked: "CASE WHEN status IN ('bounced','complained','suppressed','unsubscribed','cancelled') THEN status ELSE 'clicked' END",
      failed: "CASE WHEN status IN ('queued','processing','sent') THEN 'failed' ELSE status END",
      bounced: "'bounced'", complained: "'complained'", suppressed: "'suppressed'",
    };
    const timestampColumn = { sent: 'sent_at', delivered: 'delivered_at', opened: 'opened_at', clicked: 'clicked_at', bounced: 'bounced_at', complained: 'complained_at' }[eventType];
    const timestampUpdate = timestampColumn ? `,${timestampColumn}=CASE WHEN ${timestampColumn} IS NULL OR ${timestampColumn}>$2 THEN $2 ELSE ${timestampColumn} END` : '';
    await client.query(`UPDATE email_campaign_recipients SET status=${statusSql[eventType]}${timestampUpdate},updated_at=NOW() WHERE id=$1`, [recipient.id, occurredAt]);
    if (['bounced', 'complained', 'suppressed'].includes(eventType)) {
      const reason = eventType === 'complained' ? 'complaint' : eventType === 'bounced' ? 'bounce' : 'invalid';
      await client.query(
        `INSERT INTO email_suppressions (organization_id,business_id,source_campaign_id,source_recipient_id,email,normalized_email,reason,provider,provider_reference,details,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'resend',$8,$9::jsonb,true)
         ON CONFLICT (business_id,normalized_email) DO UPDATE SET reason=EXCLUDED.reason,provider='resend',provider_reference=EXCLUDED.provider_reference,
           details=EXCLUDED.details,active=true,suppressed_at=NOW(),updated_at=NOW()`,
        [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, recipient.email, recipient.normalized_email, reason, messageId, JSON.stringify(safeRawResendPayload(payload))]
      );
    }
    await client.query(
      `UPDATE email_campaigns c SET queued_count=s.queued_count,sent_count=s.sent_count,delivered_count=s.delivered_count,
         opened_count=s.opened_count,clicked_count=s.clicked_count,bounced_count=s.bounced_count,complained_count=s.complained_count,
         unsubscribed_count=s.unsubscribed_count,failed_count=s.failed_count,updated_at=NOW()
       FROM (SELECT campaign_id,
         COUNT(*) FILTER (WHERE status IN ('queued','processing'))::int queued_count,
         COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int sent_count,
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int delivered_count,
         COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int opened_count,
         COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int clicked_count,
         COUNT(*) FILTER (WHERE status='bounced')::int bounced_count,
         COUNT(*) FILTER (WHERE status='complained')::int complained_count,
         COUNT(*) FILTER (WHERE status='unsubscribed')::int unsubscribed_count,
         COUNT(*) FILTER (WHERE status IN ('failed','suppressed'))::int failed_count
       FROM email_campaign_recipients WHERE campaign_id=$1 GROUP BY campaign_id) s WHERE c.id=s.campaign_id`,
      [recipient.campaign_id]
    );
    await client.query('COMMIT');
    return { accepted: true, eventType, campaignId: recipient.campaign_id };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

function sendingDomainForClient(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, businessId: row.business_id, createdByUserId: row.created_by_user_id,
    provider: row.provider, domain: row.domain, providerDomainId: row.provider_domain_id, region: row.region, status: row.status,
    dnsRecords: row.dns_records || [], spfStatus: row.spf_status, dkimStatus: row.dkim_status,
    dmarcStatus: row.dmarc_status, dmarcRecord: row.dmarc_record, lastCheckedAt: row.last_checked_at,
    verifiedAt: row.verified_at, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function escapeEmailHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  let hasDb = false;
  try { getDbUrl(); hasDb = true; } catch {}
  res.json({ ok: true, time: new Date().toISOString(), hasDb });
});

// ─── Login ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const pool = createPool();
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

    const member = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool.query('SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1', [member.rows[0].organization_id]);
      business = biz.rows[0] || null;
    }

    const token = jwt.sign({ userId: user.id, uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser, business });
  } catch (e) { console.error('[login]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Register ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const pool = createPool();
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

    const emailNorm = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (existing.rows[0]) return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });

    const hash = await bcrypt.hash(String(password), 10);
    const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const { rows: [newUser] } = await pool.query(
      'INSERT INTO users (uid, email, name, password_hash) VALUES ($1,$2,$3,$4) RETURNING *',
      [uid, emailNorm, name || '', hash]
    );
    const { rows: [org] } = await pool.query('INSERT INTO organizations (name) VALUES ($1) RETURNING *', [`Empresa de ${name || emailNorm.split('@')[0]}`]);
    await pool.query('INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1,$2,$3)', [newUser.id, org.id, 'owner']);
    const { rows: [business] } = await pool.query('INSERT INTO businesses (organization_id, name) VALUES ($1,$2) RETURNING *', [org.id, 'Negócio Principal']);

    const token = jwt.sign({ userId: newUser.id, uid: newUser.uid, email: newUser.email }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = newUser;
    res.json({ token, user: safeUser, business });
  } catch (e) { console.error('[register]', e.message); res.status(400).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [decoded.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const user = rows[0];

    const member = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool.query('SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1', [member.rows[0].organization_id]);
      business = biz.rows[0] || null;
    }
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, business });
  } catch (e) { console.error('[me]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/auth/sync', (_req, res) => res.json({ ok: true }));

// ─── Onboarding Complete ─────────────────────────────────────────────────────
app.post('/api/onboarding/complete', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });

    const { businessId, company, productsList, audience, marketing, objective } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId é obrigatório.' });

    await pool.query(`UPDATE businesses SET segment=$1, description=$2, city=$3, state=$4, website=$5, instagram=$6, whatsapp=$7, service_area=$8, service_type=$9, onboarding_completed=true, onboarding_completed_at=NOW() WHERE id=$10`,
      [company?.segment, company?.description, company?.city, company?.state, company?.website, company?.instagram, company?.whatsapp, company?.serviceArea, company?.serviceType, businessId]);

    if (productsList && productsList.length) {
      for (const p of productsList) {
        await pool.query('INSERT INTO products (business_id, name, type, description, price, ticket_value, main_benefit, differentiators, ideal_customer, is_main) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [businessId, p.name, p.type, p.description, p.price, p.ticketValue, p.mainBenefit, p.differentiators, p.idealCustomer, p.isMain || false]);
      }
    }

    if (audience) {
      await pool.query('INSERT INTO target_audiences (business_id, description, age_range, location, profile, pains, desires, objections, decision_factors) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [businessId, audience.description, audience.ageRange, audience.location, audience.profile, JSON.stringify(audience.pains || []), JSON.stringify(audience.desires || []), JSON.stringify(audience.objections || []), audience.decisionFactors]);
    }

    if (marketing) {
      await pool.query('INSERT INTO marketing_profiles (business_id, channels, post_frequency, monthly_investment, monthly_leads, monthly_sales, main_difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [businessId, JSON.stringify(marketing.channels || []), marketing.postFrequency, marketing.monthlyInvestment, marketing.monthlyLeads, marketing.monthlySales, marketing.mainDifficulty]);
    }

    if (objective) {
      await pool.query('INSERT INTO goals (business_id, goal_type, target_metric, timeframe) VALUES ($1,$2,$3,$4)',
        [businessId, objective.goalType, objective.targetMetric, objective.timeframe]);
    }

    // Try AI strategy generation (best-effort)
    let strategy = null;
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const biz = (await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId])).rows[0];
        const prods = (await pool.query('SELECT * FROM products WHERE business_id = $1', [businessId])).rows;

        const prompt = `Você é um Gerente de Marketing Sênior. Analise esta empresa e crie uma estratégia.
Empresa: ${biz?.name} - ${biz?.segment}. Descrição: ${biz?.description}
Produtos: ${prods.map(p => p.name + ' (' + p.type + ')').join(', ')}
Responda em JSON com: business_summary (string), positioning_statement (string), value_proposition (string).`;

        const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } });
        const parsed = JSON.parse(response.text || '{}');
        const orgResult = await pool.query('SELECT organization_id FROM businesses WHERE id=$1', [businessId]);
        const stratResult = await pool.query('INSERT INTO strategies (business_id, business_summary, positioning_statement, value_proposition) VALUES ($1,$2,$3,$4) RETURNING *',
          [businessId, parsed.business_summary, parsed.positioning_statement, parsed.value_proposition]);
        strategy = stratResult.rows[0];
        await pool.query('INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output) VALUES ($1,$2,$3,$4,$5,$6)',
          [orgResult.rows[0]?.organization_id, businessId, 'initial_strategy', 'gemini', GEMINI_MODEL, JSON.stringify(parsed)]);
      }
    } catch (aiErr) { console.error('[onboarding-ai]', aiErr.message); }

    res.json({ success: true, strategy, message: strategy ? 'Onboarding completo com estratégia!' : 'Onboarding completo!' });
  } catch (e) { console.error('[onboarding]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Strategy ─────────────────────────────────────────────────────────────────
function strategyForClient(row) {
  if (!row) return null;
  return {
    ...row,
    businessId: row.business_id,
    businessSummary: row.business_summary,
    idealCustomerDesc: row.ideal_customer_desc,
    idealCustomerPains: row.ideal_customer_pains || [],
    idealCustomerDesires: row.ideal_customer_desires || [],
    idealCustomerObjections: row.ideal_customer_objections || [],
    positioningStatement: row.positioning_statement,
    valueProposition: row.value_proposition,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

app.get('/api/strategy/current', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const businessId = authorized.business.id;
    const strat = (await pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId])).rows[0];
    if (!strat) return res.json({ strategy: null });
    const [channelsResult, weeksResult, opportunitiesResult, goalResult] = await Promise.all([
      pool.query('SELECT * FROM strategy_channels WHERE strategy_id=$1 ORDER BY priority', [strat.id]),
      pool.query('SELECT * FROM strategy_plan_weeks WHERE strategy_id=$1 ORDER BY week', [strat.id]),
      pool.query('SELECT * FROM opportunities WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
    ]);
    const goal = goalResult.rows[0];
    res.json({
      strategy: strategyForClient(strat),
      channels: channelsResult.rows,
      planWeeks: weeksResult.rows,
      opportunities: opportunitiesResult.rows,
      goal: goal ? {
        ...goal,
        businessId: goal.business_id,
        goalType: goal.goal_type,
        targetMetric: goal.target_metric,
        createdAt: goal.created_at,
      } : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/strategy/regenerate', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    // The frontend sends businessId in the body for this endpoint.
    const requestedBusinessId = String(req.body?.businessId || '');
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const business = (await pool.query(
      `SELECT b.* FROM businesses b
       JOIN organization_members om ON om.organization_id=b.organization_id
       WHERE b.id=$1 AND om.user_id=$2 LIMIT 1`,
      [requestedBusinessId, decoded.userId]
    )).rows[0];
    if (!business) return res.status(403).json({ error: 'Acesso negado a esta empresa.' });

    const [productsResult, audienceResult, marketingResult, goalsResult] = await Promise.all([
      pool.query('SELECT * FROM products WHERE business_id=$1 ORDER BY created_at DESC', [business.id]),
      pool.query('SELECT * FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id]),
      pool.query('SELECT * FROM marketing_profiles WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id]),
      pool.query('SELECT * FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id]),
    ]);
    const context = {
      business: {
        name: business.name,
        segment: business.segment,
        description: business.description,
        city: business.city,
        state: business.state,
        serviceArea: business.service_area,
        serviceType: business.service_type,
      },
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
      currentMarketing: marketingResult.rows[0] || null,
      goal: goalsResult.rows[0] || null,
    };

    let generated;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um gerente de marketing sênior. Crie uma estratégia de marketing prática em português do Brasil baseada somente nos dados reais abaixo. Quando faltar informação, apresente como hipótese, sem inventar fatos, preços ou resultados.

DADOS:
${JSON.stringify(context, null, 2)}

Retorne somente JSON válido neste formato:
{"business_summary":"...","ideal_customer":{"description":"...","main_pains":["..."],"main_desires":["..."],"main_objections":["..."]},"positioning":{"statement":"...","value_proposition":"...","differentiators":["..."]},"priority_channels":[{"channel":"...","priority":1,"reason":"..."}],"opportunities":[{"title":"...","description":"...","impact":"high"}],"plan_30_days":[{"week":1,"objective":"...","actions":["..."]},{"week":2,"objective":"...","actions":["..."]},{"week":3,"objective":"...","actions":["..."]},{"week":4,"objective":"...","actions":["..."]}]}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 5000 },
      });
      generated = JSON.parse(response.text || '{}');
    } else {
      const audience = audienceResult.rows[0] || {};
      const marketingChannels = Array.isArray(marketingResult.rows[0]?.channels) ? marketingResult.rows[0].channels : [];
      const channels = marketingChannels.length ? marketingChannels.slice(0, 3) : ['Instagram', 'LinkedIn', 'WhatsApp'];
      generated = {
        business_summary: `${business.name} atua em ${business.segment || 'seu segmento'}, com foco em ${business.description || 'soluções para seus clientes'}.`,
        ideal_customer: {
          description: audience.profile || audience.description || 'Cliente com necessidade compatível com as soluções da empresa.',
          main_pains: audience.pains || ['Necessidade de encontrar uma solução confiável'],
          main_desires: audience.desires || ['Obter melhores resultados com segurança'],
          main_objections: audience.objections || ['Dúvidas sobre valor e adequação da solução'],
        },
        positioning: {
          statement: `${business.name}: soluções de ${business.segment || 'marketing e negócios'} orientadas às necessidades do cliente.`,
          value_proposition: business.description || `Atendimento especializado em ${business.segment || 'soluções empresariais'}.`,
          differentiators: productsResult.rows.map(product => product.main_benefit).filter(Boolean).slice(0, 3),
        },
        priority_channels: channels.map((channel, index) => ({ channel, priority: index + 1, reason: 'Canal alinhado ao perfil e ao momento atual da empresa.' })),
        opportunities: [{ title: 'Fortalecer presença digital', description: 'Criar uma rotina consistente de conteúdo e acompanhamento de leads.', impact: 'high' }],
        plan_30_days: [1, 2, 3, 4].map(week => ({ week, objective: `Executar a etapa ${week} da estratégia`, actions: [`Planejar as ações da semana ${week}`, 'Produzir conteúdo alinhado ao objetivo', 'Acompanhar leads e registrar resultados'] })),
      };
    }

    if (!generated.business_summary || !generated.positioning || !Array.isArray(generated.plan_30_days)) {
      throw new Error('A IA retornou uma estratégia incompleta. Tente novamente.');
    }

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('UPDATE strategies SET is_active=false WHERE business_id=$1', [business.id]);
    const strategy = (await client.query(
      `INSERT INTO strategies
        (business_id, business_summary, ideal_customer_desc, ideal_customer_pains, ideal_customer_desires,
         ideal_customer_objections, positioning_statement, value_proposition, differentiators, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
      [
        business.id, generated.business_summary, generated.ideal_customer?.description || null,
        JSON.stringify(generated.ideal_customer?.main_pains || []), JSON.stringify(generated.ideal_customer?.main_desires || []),
        JSON.stringify(generated.ideal_customer?.main_objections || []), generated.positioning.statement || null,
        generated.positioning.value_proposition || null, JSON.stringify(generated.positioning.differentiators || []),
      ]
    )).rows[0];
    for (const [index, channel] of (generated.priority_channels || []).slice(0, 5).entries()) {
      await client.query(
        'INSERT INTO strategy_channels (strategy_id, channel, priority, reason) VALUES ($1,$2,$3,$4)',
        [strategy.id, channel.channel, Number(channel.priority || index + 1), channel.reason || null]
      );
    }
    for (const [index, week] of generated.plan_30_days.slice(0, 4).entries()) {
      await client.query(
        'INSERT INTO strategy_plan_weeks (strategy_id, week, objective, actions) VALUES ($1,$2,$3,$4)',
        [strategy.id, Number(week.week || index + 1), week.objective || null, JSON.stringify(week.actions || [])]
      );
    }
    await client.query('DELETE FROM opportunities WHERE business_id=$1', [business.id]);
    for (const opportunity of (generated.opportunities || []).slice(0, 10)) {
      await client.query(
        `INSERT INTO opportunities (business_id, title, description, impact, effort, status)
         VALUES ($1,$2,$3,$4,'medium','open')`,
        [business.id, opportunity.title || 'Oportunidade', opportunity.description || null, ['high', 'medium', 'low'].includes(opportunity.impact) ? opportunity.impact : 'medium']
      );
    }
    await client.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'initial_strategy',$3,$4,$5)`,
      [business.organization_id, business.id, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(generated)]
    );
    await client.query('COMMIT');
    res.json({ success: true, strategy: strategyForClient(strategy) });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[strategy-regenerate]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar a estratégia.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

// ─── Content ──────────────────────────────────────────────────────────────────
function contentForClient(row) {
  if (!row) return null;
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    strategyId: row.strategy_id,
    funnelStage: row.funnel_stage,
    scheduledDate: row.scheduled_date,
    visualDirection: row.visual_direction,
    videoScript: row.video_script,
    generationContext: row.generation_context,
    campaignId: row.campaign_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

async function contentBusiness(pool, req, businessId) {
  const decoded = verifyToken(req);
  if (!decoded) return { error: 401, message: 'Não autenticado.' };
  if (!businessId) return { error: 400, message: 'Empresa não informada.' };
  const business = (await pool.query(
    `SELECT b.* FROM businesses b
     JOIN organization_members om ON om.organization_id=b.organization_id
     WHERE b.id=$1 AND om.user_id=$2 LIMIT 1`,
    [businessId, decoded.userId]
  )).rows[0];
  if (!business) return { error: 403, message: 'Acesso negado a esta empresa.' };
  return { business };
}

app.get('/api/content', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const rows = (await pool.query('SELECT * FROM content_items WHERE business_id=$1 ORDER BY scheduled_date DESC NULLS LAST, created_at DESC', [biz.id])).rows;
    res.json(rows.map(contentForClient));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/content/generate-calendar', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const { businessId, frequencyDesc, objective } = req.body || {};
    const periodDays = Number(req.body?.periodDays || 30);
    const channels = Array.isArray(req.body?.channels)
      ? req.body.channels.map(channel => String(channel).trim()).filter(Boolean).slice(0, 10)
      : [];
    const authorized = await contentBusiness(pool, req, businessId);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    if (![7, 14, 30].includes(periodDays)) return res.status(400).json({ error: 'Período inválido.' });
    if (!channels.length) return res.status(400).json({ error: 'Selecione pelo menos um canal.' });

    const business = authorized.business;
    const [strategyResult, productsResult, audienceResult] = await Promise.all([
      pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT name, type, description, main_benefit, ideal_customer FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
    ]);
    const strategy = strategyResult.rows[0] || null;
    const context = {
      business: {
        name: business.name,
        segment: business.segment,
        description: business.description,
        serviceArea: business.service_area,
      },
      strategy,
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
    };

    const frequencyMatch = String(frequencyDesc || '').match(/(\d+)/);
    const postsPerWeek = /todos os dias/i.test(String(frequencyDesc)) ? 7 : Number(frequencyMatch?.[1] || 3);
    const desiredCount = Math.min(30, Math.max(1, Math.ceil((periodDays / 7) * postsPerWeek)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() + periodDays - 1);

    let items = [];
    let aiOutput = null;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um estrategista de conteúdo sênior. Crie um calendário editorial em português do Brasil.

Configuração:
- Início: ${today.toISOString().slice(0, 10)}
- Período: ${periodDays} dias
- Quantidade exata: ${desiredCount} conteúdos
- Frequência: ${frequencyDesc}
- Canais permitidos: ${channels.join(', ')}
- Objetivo: ${objective || 'autoridade'}

Contexto real da empresa:
${JSON.stringify(context, null, 2)}

Regras:
- Não invente preços, garantias, clientes, depoimentos ou resultados.
- Distribua as datas dentro do período e varie canais e formatos.
- Use somente funnel_stage: awareness, consideration, conversion ou retention.
- Retorne somente JSON válido neste formato:
{"content_items":[{"scheduled_date":"YYYY-MM-DD","title":"...","topic":"...","channel":"...","format":"...","funnel_stage":"awareness","objective":"...","brief":"..."}]}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 5000 },
      });
      aiOutput = JSON.parse(response.text || '{}');
      items = Array.isArray(aiOutput.content_items) ? aiOutput.content_items : [];
    } else {
      const subjects = productsResult.rows.length
        ? productsResult.rows.map(product => product.name)
        : [business.segment || business.name || 'seu mercado'];
      const formats = ['Carrossel', 'Post', 'Vídeo curto', 'Stories'];
      items = Array.from({ length: desiredCount }, (_, index) => {
        const offset = desiredCount === 1 ? 0 : Math.round((index * (periodDays - 1)) / (desiredCount - 1));
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        const subject = subjects[index % subjects.length];
        return {
          scheduled_date: date.toISOString().slice(0, 10),
          title: `${index + 1}. Como ${subject} pode ajudar o cliente ideal`,
          topic: `Conteúdo educativo sobre ${subject}, conectado ao objetivo de ${objective || 'autoridade'}.`,
          channel: channels[index % channels.length],
          format: formats[index % formats.length],
          funnel_stage: index % 4 === 3 ? 'conversion' : index % 3 === 2 ? 'consideration' : 'awareness',
          objective: objective || 'autoridade',
        };
      });
      aiOutput = { content_items: items, fallback: true };
    }

    const allowedStages = new Set(['awareness', 'consideration', 'conversion', 'retention']);
    const allowedChannels = new Set(channels.map(channel => channel.toLowerCase()));
    items = items.slice(0, desiredCount).map((item, index) => {
      const parsedDate = new Date(`${item.scheduled_date}T00:00:00`);
      const fallbackDate = new Date(today);
      fallbackDate.setDate(fallbackDate.getDate() + Math.min(periodDays - 1, index));
      const validDate = !Number.isNaN(parsedDate.getTime()) && parsedDate >= today && parsedDate <= lastDate ? parsedDate : fallbackDate;
      const requestedChannel = String(item.channel || channels[index % channels.length]);
      const channel = allowedChannels.has(requestedChannel.toLowerCase()) ? requestedChannel : channels[index % channels.length];
      return {
        scheduledDate: validDate.toISOString().slice(0, 10),
        title: String(item.title || item.topic || 'Ideia de conteúdo').slice(0, 300),
        topic: String(item.topic || item.brief || '').slice(0, 2000),
        channel,
        format: String(item.format || 'Post').slice(0, 100),
        funnelStage: allowedStages.has(item.funnel_stage) ? item.funnel_stage : 'awareness',
        itemObjective: String(item.objective || objective || '').slice(0, 300),
      };
    });
    if (!items.length) throw new Error('A IA não retornou itens válidos para o calendário.');

    client = await pool.connect();
    await client.query('BEGIN');
    const saved = [];
    for (const item of items) {
      const result = await client.query(
        `INSERT INTO content_items
          (organization_id, business_id, strategy_id, title, topic, channel, format, funnel_stage, objective, scheduled_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'idea') RETURNING *`,
        [business.organization_id, businessId, strategy?.id || null, item.title, item.topic, item.channel, item.format, item.funnelStage, item.itemObjective, item.scheduledDate]
      );
      saved.push(contentForClient(result.rows[0]));
    }
    await client.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'content_calendar',$3,$4,$5)`,
      [business.organization_id, businessId, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(aiOutput)]
    );
    await client.query('COMMIT');
    res.json({ success: true, items: saved });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[content-calendar]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar o calendário.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.post('/api/content', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await contentBusiness(pool, req, req.body?.businessId);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const business = authorized.business;
    const strategy = (await pool.query('SELECT id FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id])).rows[0];
    const row = (await pool.query(
      `INSERT INTO content_items (organization_id, business_id, strategy_id, title, topic, channel, format, funnel_stage, objective, scheduled_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [business.organization_id, business.id, strategy?.id || null, req.body.title || 'Novo Conteúdo', req.body.topic || null, req.body.channel || null, req.body.format || null, req.body.funnelStage || null, req.body.objective || null, req.body.scheduledDate || null, req.body.status || 'idea']
    )).rows[0];
    res.json(contentForClient(row));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

async function authorizedContentItem(pool, req, itemId) {
  const decoded = verifyToken(req);
  if (!decoded) return { error: 401, message: 'Não autenticado.' };
  const item = (await pool.query(
    `SELECT ci.* FROM content_items ci
     JOIN businesses b ON b.id=ci.business_id
     JOIN organization_members om ON om.organization_id=b.organization_id
     WHERE ci.id=$1 AND om.user_id=$2 LIMIT 1`,
    [itemId, decoded.userId]
  )).rows[0];
  if (!item) return { error: 404, message: 'Conteúdo não encontrado.' };
  return { item };
}

app.post('/api/content/:id/generate', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const item = authorized.item;
    const [businessResult, strategyResult, productsResult, audienceResult] = await Promise.all([
      pool.query('SELECT * FROM businesses WHERE id=$1', [item.business_id]),
      pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [item.business_id]),
      pool.query('SELECT name, type, description, main_benefit, differentiators FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [item.business_id]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [item.business_id]),
    ]);
    const business = businessResult.rows[0];
    const context = {
      business: { name: business.name, segment: business.segment, description: business.description },
      strategy: strategyResult.rows[0] || null,
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
    };

    let generated;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um copywriter sênior. Crie um conteúdo em português do Brasil usando somente os dados fornecidos. Não invente preços, descontos, depoimentos, garantias ou resultados.

ITEM:
- Título/Tema: ${item.title || item.topic || ''}
- Briefing: ${item.topic || ''}
- Canal: ${item.channel || ''}
- Formato: ${item.format || ''}
- Etapa do funil: ${item.funnel_stage || ''}
- Objetivo: ${item.objective || ''}

CONTEXTO:
${JSON.stringify(context, null, 2)}

Retorne somente JSON válido:
{"title":"...","hook":"...","body":"...","caption":"...","cta":"...","hashtags":["..."],"visual_direction":"...","video_script":"..."}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 3000 },
      });
      generated = JSON.parse(response.text || '{}');
    } else {
      generated = {
        title: item.title || item.topic || 'Novo conteúdo',
        hook: `Você já pensou em como ${item.topic || business.segment || 'esta solução'} pode apoiar seus objetivos?`,
        body: `${business.name} atua com ${business.segment || 'soluções especializadas'} e ajuda clientes a encontrar alternativas alinhadas às suas necessidades. ${item.topic || business.description || ''}`.trim(),
        caption: item.topic || business.description || '',
        cta: 'Entre em contato para saber mais.',
        hashtags: [],
        visual_direction: `Utilizar identidade visual da marca em uma composição adequada para ${item.channel || 'o canal selecionado'}.`,
        video_script: '',
      };
    }
    if (!generated.body && !generated.caption) throw new Error('A IA não retornou um conteúdo válido.');

    const updated = (await pool.query(
      `UPDATE content_items SET title=$1, hook=$2, body=$3, caption=$4, cta=$5, hashtags=$6,
       visual_direction=$7, video_script=$8, status='draft', updated_at=NOW() WHERE id=$9 RETURNING *`,
      [
        generated.title || item.title, generated.hook || null, generated.body || null, generated.caption || null,
        generated.cta || null, JSON.stringify(Array.isArray(generated.hashtags) ? generated.hashtags : []),
        generated.visual_direction || null, generated.video_script || null, item.id,
      ]
    )).rows[0];
    await pool.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'content_item',$3,$4,$5)`,
      [item.organization_id, item.business_id, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(generated)]
    );
    res.json(contentForClient(updated));
  } catch (e) {
    console.error('[content-generate]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar o conteúdo.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/content/:id/refine', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const currentText = String(req.body?.currentText || '').trim();
    const instruction = String(req.body?.instruction || '').trim();
    if (!currentText || !instruction) return res.status(400).json({ error: 'Texto e instrução são obrigatórios.' });
    if (currentText.length > 12000 || instruction.length > 1000) return res.status(400).json({ error: 'Texto muito extenso para refinamento.' });

    let refinedText;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Você é um editor de texto de marketing. Reescreva somente o texto abaixo seguindo a instrução, preservando fatos e sem inventar preços, promessas ou resultados. Responda apenas com o texto final.\n\nINSTRUÇÃO: ${instruction}\n\nTEXTO:\n${currentText}`,
        config: { maxOutputTokens: 2000 },
      });
      refinedText = String(response.text || '').trim();
    } else {
      refinedText = currentText;
    }
    if (!refinedText) throw new Error('A IA não retornou o texto refinado.');
    res.json({ refinedText });
  } catch (e) {
    console.error('[content-refine]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível refinar o texto.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/content/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    res.json(contentForClient(authorized.item));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.put('/api/content/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const current = authorized.item;
    const body = req.body || {};
    const status = ['idea', 'draft', 'ready', 'published'].includes(body.status) ? body.status : current.status;
    const publishedAt = status === 'published' && current.status !== 'published' ? new Date() : current.published_at;
    const updated = (await pool.query(
      `UPDATE content_items SET title=$1, topic=$2, channel=$3, format=$4, funnel_stage=$5, objective=$6,
       scheduled_date=$7, status=$8, hook=$9, body=$10, caption=$11, cta=$12, hashtags=$13,
       visual_direction=$14, video_script=$15, published_at=$16, updated_at=NOW()
       WHERE id=$17 RETURNING *`,
      [
        String(body.title ?? current.title).slice(0, 500), body.topic ?? current.topic, body.channel ?? current.channel,
        body.format ?? current.format, body.funnelStage ?? current.funnel_stage, body.objective ?? current.objective,
        body.scheduledDate || null, status, body.hook ?? current.hook, body.body ?? current.body,
        body.caption ?? current.caption, body.cta ?? current.cta,
        JSON.stringify(Array.isArray(body.hashtags) ? body.hashtags : (current.hashtags || [])),
        body.visualDirection ?? current.visual_direction, body.videoScript ?? current.video_script,
        publishedAt, current.id,
      ]
    )).rows[0];
    res.json(contentForClient(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
app.get('/api/businesses/:id/context', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await contentBusiness(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const businessId = authorized.business.id;
    const [products, audiences, profiles] = await Promise.all([
      pool.query('SELECT * FROM products WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM marketing_profiles WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
    ]);
    res.json({
      products: products.rows.map(product => ({
        ...product,
        businessId: product.business_id,
        ticketValue: product.ticket_value,
        mainBenefit: product.main_benefit,
        idealCustomer: product.ideal_customer,
        isMain: product.is_main,
      })),
      targetAudiences: audiences.rows.map(audience => ({
        ...audience,
        businessId: audience.business_id,
        ageRange: audience.age_range,
        decisionFactors: audience.decision_factors,
      })),
      marketingProfiles: profiles.rows.map(profile => ({
        ...profile,
        businessId: profile.business_id,
        postFrequency: profile.post_frequency,
        monthlyInvestment: profile.monthly_investment,
        monthlyLeads: profile.monthly_leads,
        monthlySales: profile.monthly_sales,
        mainDifficulty: profile.main_difficulty,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

function campaignForClient(row) {
  if (!row) return null;
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    strategyId: row.strategy_id,
    productId: row.product_id,
    targetAudience: row.target_audience,
    mainArgument: row.main_argument,
    startDate: row.start_date,
    endDate: row.end_date,
    primaryMetric: row.primary_metric,
    investmentSpent: Number(row.investment_spent || 0),
    revenueGenerated: Number(row.revenue_generated || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    leads: Number(row.leads || 0),
    sales: Number(row.sales || 0),
    channels: Array.isArray(row.channels) ? row.channels : [],
    assets: Array.isArray(row.assets) ? row.assets : [],
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
  };
}

app.get('/api/campaigns', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const rows = (await pool.query(
      `SELECT c.*,
              COALESCE(json_agg(cc.*) FILTER (WHERE cc.id IS NOT NULL), '[]') AS channels
       FROM campaigns c
       LEFT JOIN campaign_channels cc ON cc.campaign_id=c.id
       WHERE c.business_id=$1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [biz.id]
    )).rows;
    res.json(rows.map(campaignForClient));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/campaigns/generate', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const businessId = authorized.business.id;
    const setup = req.body || {};
    const objective = String(setup.objective || '').trim();
    const channels = Array.isArray(setup.channels)
      ? setup.channels.map(channel => String(channel).trim()).filter(Boolean).slice(0, 10)
      : [];
    if (!objective) return res.status(400).json({ error: 'Selecione o objetivo da campanha.' });
    if (!channels.length) return res.status(400).json({ error: 'Selecione pelo menos um canal.' });

    const [businessResult, productsResult, audienceResult, strategyResult] = await Promise.all([
      pool.query('SELECT * FROM businesses WHERE id=$1', [businessId]),
      pool.query('SELECT * FROM products WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
    ]);
    const business = businessResult.rows[0];
    const selectedProduct = setup.productId
      ? productsResult.rows.find(product => product.id === setup.productId) || null
      : null;
    const context = {
      business: {
        name: business.name,
        segment: business.segment,
        description: business.description,
        city: business.city,
        state: business.state,
      },
      product: selectedProduct,
      audience: setup.customAudience || audienceResult.rows[0] || null,
      strategy: strategyResult.rows[0] || null,
    };

    let result;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um estrategista de campanhas sênior. Crie uma campanha prática em português do Brasil.

Configuração:
- Nome sugerido pelo usuário: ${setup.name || 'não informado'}
- Objetivo: ${objective}
- Canais: ${channels.join(', ')}
- Período: ${setup.startDate || 'não informado'} até ${setup.endDate || 'não informado'}
- Orçamento: ${setup.budget || 'não informado'}
- Meta: ${setup.targetMetric || 'não informada'}
- Instruções: ${setup.instructions || 'nenhuma'}

Contexto real:
${JSON.stringify(context, null, 2)}

Não invente preços, descontos, depoimentos, garantias ou resultados. Se não houver produto selecionado, faça uma campanha institucional.
Retorne somente JSON válido:
{"campaign_name":"...","campaign_summary":"...","target_audience":{"description":"...","main_pain":"...","main_desire":"...","main_objection":"..."},"offer":{"description":"...","value_proposition":"...","urgency":"..."},"main_argument":"...","messaging":{"main_message":"...","supporting_arguments":["..."]},"plan_actions":["..."]}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 3000 },
      });
      result = JSON.parse(response.text || '{}');
    } else {
      const focus = selectedProduct?.name || business.segment || business.name;
      result = {
        campaign_name: setup.name || `Campanha de ${objective}`,
        campaign_summary: `Campanha focada em ${objective} para apresentar ${focus} ao público-alvo da empresa.`,
        target_audience: setup.customAudience || audienceResult.rows[0] || { description: 'Público-alvo cadastrado pela empresa' },
        offer: {
          description: `Apresentação da proposta de valor de ${focus}.`,
          value_proposition: selectedProduct?.main_benefit || strategyResult.rows[0]?.value_proposition || business.description,
          urgency: 'Incentivar o contato para conhecer a solução.',
        },
        main_argument: selectedProduct?.main_benefit || `Solução alinhada às necessidades do público de ${business.segment || business.name}.`,
        messaging: {
          main_message: `Conheça como ${focus} pode apoiar seus objetivos.`,
          supporting_arguments: ['Atendimento alinhado à necessidade do cliente', 'Solução apresentada de forma clara e consultiva'],
        },
        plan_actions: channels.map(channel => `Preparar e revisar a comunicação para ${channel}`),
      };
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const campaign = (await client.query(
      `INSERT INTO campaigns
        (organization_id, business_id, strategy_id, product_id, name, objective, description, target_audience, offer, main_argument, messaging, budget, start_date, end_date, primary_metric, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft') RETURNING *`,
      [
        business.organization_id, businessId, strategyResult.rows[0]?.id || null, selectedProduct?.id || null,
        String(result.campaign_name || setup.name || 'Nova Campanha').slice(0, 300), objective,
        result.campaign_summary || null, JSON.stringify(result.target_audience || {}), JSON.stringify(result.offer || {}),
        result.main_argument || null, JSON.stringify(result.messaging || {}), setup.budget || null,
        setup.startDate || null, setup.endDate || null, setup.targetMetric || null,
      ]
    )).rows[0];

    const savedChannels = [];
    for (const channel of channels) {
      const saved = (await client.query(
        'INSERT INTO campaign_channels (campaign_id, channel, status) VALUES ($1,$2,$3) RETURNING *',
        [campaign.id, channel, 'planned']
      )).rows[0];
      savedChannels.push(saved);
    }
    const savedTasks = [];
    const actions = Array.isArray(result.plan_actions) ? result.plan_actions.slice(0, 20) : [];
    for (const action of actions) {
      const saved = (await client.query(
        "INSERT INTO campaign_tasks (campaign_id, title, status) VALUES ($1,$2,'todo') RETURNING *",
        [campaign.id, String(action).slice(0, 500)]
      )).rows[0];
      savedTasks.push(saved);
    }
    await client.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'campaign_generation',$3,$4,$5)`,
      [business.organization_id, businessId, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(result)]
    );
    await client.query('COMMIT');
    res.json(campaignForClient({ ...campaign, channels: savedChannels, tasks: savedTasks, assets: [] }));
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[campaign-generate]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar a campanha.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const campaign = (await pool.query('SELECT * FROM campaigns WHERE id=$1 AND business_id=$2', [req.params.id, authorized.business.id])).rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const [channels, assets, tasks, product] = await Promise.all([
      pool.query('SELECT * FROM campaign_channels WHERE campaign_id=$1 ORDER BY id', [campaign.id]),
      pool.query('SELECT * FROM campaign_assets WHERE campaign_id=$1 ORDER BY created_at DESC', [campaign.id]),
      pool.query('SELECT * FROM campaign_tasks WHERE campaign_id=$1 ORDER BY id', [campaign.id]),
      campaign.product_id ? pool.query('SELECT * FROM products WHERE id=$1', [campaign.product_id]) : Promise.resolve({ rows: [] }),
    ]);
    res.json(campaignForClient({ ...campaign, channels: channels.rows, assets: assets.rows, tasks: tasks.rows, product: product.rows[0] || null }));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.put('/api/campaigns/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const current = (await pool.query('SELECT * FROM campaigns WHERE id=$1 AND business_id=$2', [req.params.id, authorized.business.id])).rows[0];
    if (!current) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const body = req.body || {};
    const updated = (await pool.query(
      `UPDATE campaigns SET status=$1, impressions=$2, clicks=$3, leads=$4, sales=$5,
       investment_spent=$6, revenue_generated=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [
        body.status ?? current.status,
        Number(body.impressions ?? current.impressions ?? 0), Number(body.clicks ?? current.clicks ?? 0),
        Number(body.leads ?? current.leads ?? 0), Number(body.sales ?? current.sales ?? 0),
        Number(body.investmentSpent ?? current.investment_spent ?? 0), Number(body.revenueGenerated ?? current.revenue_generated ?? 0),
        current.id,
      ]
    )).rows[0];
    res.json(campaignForClient(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Leads ────────────────────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    res.json((await pool.query('SELECT * FROM leads WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── B2B Prospecting ─────────────────────────────────────────────────────────
app.get('/api/prospecting/email/provider-status', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    res.json(getResendProviderStatus());
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/send-test', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const decoded = verifyToken(req);
    const user = (await pool.query('SELECT email FROM users WHERE id=$1 LIMIT 1', [decoded.userId])).rows[0];
    const recipient = String(user?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(recipient)) return res.status(400).json({ error: 'O usuário atual não possui um e-mail válido para o teste.' });
    const businessName = authorized.business.name || 'Marketing OS';
    const result = await sendWithResend({
      to: recipient,
      subject: `Teste de configuração de e-mail — ${businessName}`,
      text: `Olá! Este é um envio de teste do Marketing OS para confirmar a integração de e-mail da empresa ${businessName}. Nenhuma campanha foi iniciada.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b"><h2>Integração de e-mail configurada</h2><p>Este é um envio de teste do Marketing OS para confirmar a integração de e-mail da empresa <strong>${escapeEmailHtml(businessName)}</strong>.</p><p>Nenhuma campanha foi iniciada e nenhum contato da base recebeu mensagens.</p></div>`,
      idempotencyKey: `provider-test/${authorized.business.id}/${nodeCrypto.randomUUID()}`,
    });
    res.json({ success: true, provider: result.provider, messageId: result.messageId, recipient });
  } catch (e) {
    if (e.code === 'EMAIL_PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: e.message, missingVariables: e.missingVariables });
    console.error('[email-provider-test]', e.message);
    res.status(502).json({ error: e.message || 'Falha ao enviar e-mail de teste.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/email/domain', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailSenderDomainSchema(pool);
    const domain = (await pool.query(
      'SELECT * FROM email_sender_domains WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1',
      [authorized.business.id]
    )).rows[0];
    res.json({ domain: sendingDomainForClient(domain), provider: getResendProviderStatus() });
  } catch (e) {
    console.error('[email-domain-get]', e.message);
    res.status(500).json({ error: 'Falha ao carregar a configuração do domínio de envio.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/domain', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailSenderDomainSchema(pool);
    const domainName = normalizeSendingDomain(req.body?.domain);
    const existing = (await pool.query(
      'SELECT id FROM email_sender_domains WHERE business_id=$1 AND domain=$2 LIMIT 1',
      [authorized.business.id, domainName]
    )).rows[0];
    if (existing) return res.status(409).json({ error: 'Este domínio já está cadastrado para a empresa.' });

    const providerDomain = await createOrAdoptResendDomain(domainName, req.body?.region || 'sa-east-1');
    const providerLink = (await pool.query(
      'SELECT id,business_id FROM email_sender_domains WHERE provider=$1 AND provider_domain_id=$2 LIMIT 1',
      [providerDomain.provider, providerDomain.providerDomainId]
    )).rows[0];
    if (providerLink && providerLink.business_id !== authorized.business.id) {
      return res.status(409).json({ error: 'Este dominio da Resend ja esta vinculado a outra empresa.' });
    }
    const decoded = verifyToken(req);
    const saved = (await pool.query(
      `INSERT INTO email_sender_domains
        (organization_id, business_id, created_by_user_id, provider, domain, provider_domain_id, region, status, dns_records, spf_status, dkim_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        authorized.business.organization_id, authorized.business.id, decoded.userId, providerDomain.provider,
        providerDomain.domain, providerDomain.providerDomainId, providerDomain.region, providerDomain.status,
        JSON.stringify(providerDomain.records), providerDomain.spfStatus, providerDomain.dkimStatus,
      ]
    )).rows[0];
    res.status(providerDomain.adopted ? 200 : 201).json({
      domain: sendingDomainForClient(saved), adopted: providerDomain.adopted,
    });
  } catch (e) {
    if (e.code === 'EMAIL_DOMAIN_VALIDATION') return res.status(400).json({ error: e.message });
    if (e.code === 'EMAIL_PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: e.message, missingVariables: e.missingVariables });
    console.error('[email-domain-create]', e.message);
    res.status(502).json({ error: e.message || 'Falha ao cadastrar o domínio de envio.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/domain/verify', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailSenderDomainSchema(pool);
    const values = [authorized.business.id];
    let where = 'business_id=$1';
    if (req.body?.domainId) {
      values.push(String(req.body.domainId));
      where += ' AND id=$2';
    }
    const stored = (await pool.query(
      `SELECT * FROM email_sender_domains WHERE ${where} ORDER BY created_at DESC LIMIT 1`, values
    )).rows[0];
    if (!stored) return res.status(404).json({ error: 'Domínio de envio não cadastrado.' });

    const providerDomain = req.body?.restart === false
      ? await getResendDomain(stored.provider_domain_id)
      : await verifyResendDomain(stored.provider_domain_id);
    const dmarc = await checkDomainDmarc(stored.domain);
    const updated = (await pool.query(
      `UPDATE email_sender_domains SET status=$1, region=$2, dns_records=$3, spf_status=$4, dkim_status=$5,
       dmarc_status=$6, dmarc_record=$7, last_checked_at=NOW(),
       verified_at=CASE WHEN $1='verified' THEN COALESCE(verified_at, NOW()) ELSE verified_at END, updated_at=NOW()
       WHERE id=$8 AND business_id=$9 RETURNING *`,
      [
        providerDomain.status, providerDomain.region, JSON.stringify(providerDomain.records), providerDomain.spfStatus,
        providerDomain.dkimStatus, dmarc.status, dmarc.record, stored.id, authorized.business.id,
      ]
    )).rows[0];
    res.json({
      domain: sendingDomainForClient(updated),
      dmarcCheckedHost: dmarc.checkedHost,
      dmarcRecommendation: dmarc.status === 'missing'
        ? { name: dmarc.checkedHost, type: 'TXT', value: 'v=DMARC1; p=none;' }
        : null,
    });
  } catch (e) {
    if (e.code === 'EMAIL_PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: e.message, missingVariables: e.missingVariables });
    console.error('[email-domain-verify]', e.message);
    res.status(502).json({ error: e.message || 'Falha ao verificar o domínio de envio.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/email/campaigns/audience-preview', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailCampaignSchema(pool);
    const filters = parseRawEmailAudienceFilters(req.query);
    res.json({ filters, ...(await rawEmailAudiencePreview(pool, authorized.business.id, filters)) });
  } catch (e) {
    console.error('[email-audience-preview]', e.message);
    res.status(500).json({ error: 'Falha ao calcular a audiência elegível.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/email/campaigns', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailCampaignSchema(pool);
    const rows = (await pool.query('SELECT * FROM email_campaigns WHERE business_id=$1 ORDER BY created_at DESC', [authorized.business.id])).rows;
    res.json({ campaigns: rows.map(emailCampaignForClient) });
  } catch (e) {
    console.error('[email-campaign-list]', e.message);
    res.status(500).json({ error: 'Falha ao carregar as campanhas de e-mail.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/campaigns/generate-copy', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const decoded = verifyToken(req);
    const user = (await pool.query('SELECT name FROM users WHERE id=$1', [decoded.userId])).rows[0];
    const objective = String(req.body?.objective || 'present_platform').slice(0, 80);
    const offer = String(req.body?.offer || '').trim().slice(0, 500);
    const senderName = String(req.body?.senderName || user?.name || '').trim().slice(0, 120);
    const brand = String(authorized.business.name || 'nossa empresa').trim();
    const objectiveLabels = {
      present_platform: 'apresentar a empresa e sua proposta de valor',
      advertise_products: 'convidar empresas para anunciar produtos ou serviços',
      partnership: 'propor uma parceria comercial',
      schedule_meeting: 'agendar uma conversa comercial breve',
    };
    const objectiveLabel = objectiveLabels[objective] || objectiveLabels.present_platform;
    let copy = {
      subject: `Uma oportunidade de parceria com a ${brand}`,
      previewText: `Uma conversa objetiva sobre como a ${brand} pode apoiar sua empresa.`,
      textBody: `Olá,\n\nSou ${senderName || 'da equipe comercial'} da ${brand}. Gostaria de apresentar nossa atuação e entender se existe aderência com os objetivos comerciais da sua empresa.${offer ? `\n\nNosso foco neste contato é: ${offer}.` : ''}\n\nSe fizer sentido, podemos marcar uma conversa breve de 10 minutos nos próximos dias?\n\nAtenciosamente,\n${senderName || `Equipe ${brand}`}`,
    };
    let source = 'template';
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Crie um e-mail comercial B2B universal em português do Brasil para a empresa ${brand}.
Objetivo: ${objectiveLabel}. Remetente: ${senderName || 'equipe comercial'}. Oferta: ${offer || 'não informada'}.
Seja curto, claro, ético e consultivo. Não finja relacionamento prévio e não invente fatos, preços, clientes, resultados ou garantias. Não use o nome da empresa destinatária nem campos variáveis. Use saudação universal e uma chamada para conversa sem pressão. Retorne somente JSON válido com subject, previewText e textBody.`,
        config: { responseMimeType: 'application/json', maxOutputTokens: 1200 },
      });
      const generated = JSON.parse(response.text || '{}');
      if (generated.subject && generated.previewText && generated.textBody) {
        copy = {
          subject: String(generated.subject).trim().slice(0, 200),
          previewText: String(generated.previewText).trim().slice(0, 240),
          textBody: String(generated.textBody).trim().slice(0, 20000),
        };
        source = 'gemini';
      }
    }
    res.json({ ...copy, source });
  } catch (e) {
    console.error('[email-campaign-copy]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao gerar a abordagem universal.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/campaigns', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailSenderDomainSchema(pool);
    await ensureEmailCampaignSchema(pool);
    const decoded = verifyToken(req);
    const name = String(req.body?.name || '').trim().slice(0, 200);
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    const previewText = String(req.body?.previewText || '').trim().slice(0, 240);
    const textBody = String(req.body?.textBody || '').trim().slice(0, 20000);
    const senderName = String(req.body?.senderName || '').trim().slice(0, 120);
    const senderLocalPart = String(req.body?.senderLocalPart || 'contato').trim().toLowerCase();
    const replyToEmail = String(req.body?.replyToEmail || '').trim().toLowerCase().slice(0, 250);
    const legalBasis = String(req.body?.legalBasis || 'legitimate_interest');
    const processingPurpose = String(req.body?.processingPurpose || '').trim().slice(0, 1000);
    const balanceTestReference = String(req.body?.balanceTestReference || '').trim().slice(0, 2000);
    const filters = parseRawEmailAudienceFilters(req.body?.audienceFilters || {});
    const testRecipientEmail = String(req.body?.testRecipientEmail || '').trim().toLowerCase().slice(0, 250);
    const emailStyle = ['institutional', 'cta'].includes(String(req.body?.emailStyle)) ? String(req.body.emailStyle) : 'simple';
    const ctaText = String(req.body?.ctaText || '').trim().slice(0, 80);
    const ctaUrl = String(req.body?.ctaUrl || '').trim().slice(0, 2000);
    if (!name || !subject || textBody.length < 40 || !senderName) return res.status(400).json({ error: 'Nome, remetente, assunto e uma mensagem com pelo menos 40 caracteres são obrigatórios.' });
    if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(senderLocalPart)) return res.status(400).json({ error: 'O endereço do remetente antes do @ é inválido.' });
    if (replyToEmail && !EMAIL_PATTERN.test(replyToEmail)) return res.status(400).json({ error: 'O e-mail de resposta é inválido.' });
    if (testRecipientEmail && !EMAIL_PATTERN.test(testRecipientEmail)) return res.status(400).json({ error: 'Informe um e-mail de teste válido.' });
    if (emailStyle === 'cta' && (!ctaText || !/^https:\/\/[^\s]+$/i.test(ctaUrl))) return res.status(400).json({ error: 'Para usar botão, informe o texto e uma URL HTTPS válida.' });
    if (!['legitimate_interest', 'consent'].includes(legalBasis) || processingPurpose.length < 15) return res.status(400).json({ error: 'Informe a base legal e a finalidade do tratamento dos contatos.' });
    if (legalBasis === 'legitimate_interest' && balanceTestReference.length < 20) return res.status(400).json({ error: 'Registre o teste de balanceamento do legítimo interesse antes de salvar.' });
    if (req.body?.includeUnsubscribe !== true) return res.status(400).json({ error: 'O descadastramento é obrigatório em campanhas de prospecção.' });
    const domain = (await pool.query('SELECT * FROM email_sender_domains WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [authorized.business.id])).rows[0];
    if (!domain) return res.status(409).json({ error: 'Cadastre o domínio de envio antes de criar a campanha.' });
    const senderEmail = `${senderLocalPart}@${domain.domain}`;
    const htmlBody = buildRawEmailHtml(textBody, emailStyle, ctaText, ctaUrl);

    client = await pool.connect();
    await client.query('BEGIN');
    const campaign = (await client.query(
      `INSERT INTO email_campaigns
       (organization_id,business_id,created_by_user_id,name,status,subject,preview_text,html_body,text_body,sender_name,sender_email,reply_to_email,audience_filters,template_variables,legal_basis,processing_purpose,balance_test_reference,include_unsubscribe,provider)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,true,'resend') RETURNING *`,
      [authorized.business.organization_id, authorized.business.id, decoded.userId, name, subject, previewText || null, htmlBody, textBody, senderName, senderEmail, replyToEmail || null, JSON.stringify(testRecipientEmail ? { ...filters, mode: 'test', testRecipientEmail } : filters), JSON.stringify({ emailStyle, ctaText: ctaText || null, ctaUrl: ctaUrl || null }), legalBasis, processingPurpose, balanceTestReference || null]
    )).rows[0];
    if (testRecipientEmail) {
      await client.query(
        `INSERT INTO email_campaign_recipients
          (organization_id,business_id,campaign_id,email,normalized_email,recipient_name,company_name,personalization,status)
         VALUES ($1,$2,$3,$4,$4,'Destinatário de teste','Teste interno',$5::jsonb,'queued')`,
        [authorized.business.organization_id, authorized.business.id, campaign.id, testRecipientEmail, JSON.stringify({ companyName: 'Teste interno', testRecipient: true })]
      );
    } else {
      const audience = rawEmailAudienceWhere(authorized.business.id, filters, 4);
      await client.query(
      `WITH ranked AS (
         SELECT p.id,p.company_name,p.legal_name,BTRIM(p.email) AS email,LOWER(BTRIM(p.email)) AS normalized_email,
                ROW_NUMBER() OVER (PARTITION BY LOWER(BTRIM(p.email)) ORDER BY p.qualification_score DESC NULLS LAST,p.created_at DESC) AS email_rank
           FROM prospects p WHERE ${audience.clause}
             AND BTRIM(p.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
       )
       INSERT INTO email_campaign_recipients
         (organization_id,business_id,campaign_id,prospect_id,email,normalized_email,recipient_name,company_name,personalization,status)
       SELECT $1,$2,$3,r.id,r.email,r.normalized_email,COALESCE(NULLIF(r.legal_name,''),r.company_name),r.company_name,
              jsonb_build_object('companyName',r.company_name),'queued'
         FROM ranked r WHERE r.email_rank=1
          AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.business_id=$2 AND u.normalized_email=r.normalized_email)
          AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.business_id=$2 AND s.normalized_email=r.normalized_email AND s.active=true)
       ON CONFLICT (campaign_id,normalized_email) DO NOTHING`,
        [authorized.business.organization_id, authorized.business.id, campaign.id, ...audience.values]
      );
    }
    const total = Number((await client.query('SELECT COUNT(*)::int AS count FROM email_campaign_recipients WHERE campaign_id=$1', [campaign.id])).rows[0]?.count || 0);
    const updated = (await client.query('UPDATE email_campaigns SET total_recipients=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [total, campaign.id])).rows[0];
    await client.query('COMMIT');
    res.status(201).json({ campaign: emailCampaignForClient(updated) });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[email-campaign-create]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao salvar o rascunho da campanha.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.post('/api/prospecting/email/campaigns/:campaignId/start', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailSenderDomainSchema(pool); await ensureEmailCampaignSchema(pool);
    if (req.body?.confirmation !== 'INICIAR') return res.status(400).json({ error: 'Confirmação de início ausente.' });
    const campaign = (await pool.query('SELECT * FROM email_campaigns WHERE id=$1 AND business_id=$2', [req.params.campaignId, authorized.business.id])).rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campanha de e-mail não encontrada.' });
    if (campaign.status !== 'draft') return res.status(409).json({ error: 'Somente campanhas em rascunho podem ser iniciadas.' });
    if (Number(req.body?.expectedRecipientCount) !== Number(campaign.total_recipients)) return res.status(409).json({ error: 'A audiência mudou. Revise a quantidade antes de iniciar.' });
    if (!Number(campaign.total_recipients)) return res.status(409).json({ error: 'A campanha não possui destinatários elegíveis.' });
    const domain = (await pool.query('SELECT * FROM email_sender_domains WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [authorized.business.id])).rows[0];
    if (!domain || domain.status !== 'verified') return res.status(409).json({ error: 'Verifique SPF e DKIM do domínio antes de iniciar.' });
    if (!String(campaign.sender_email).toLowerCase().endsWith(`@${String(domain.domain).toLowerCase()}`)) return res.status(409).json({ error: 'O remetente não pertence ao domínio verificado.' });
    if (!getResendProviderStatus().apiConfigured) return res.status(503).json({ error: 'RESEND_API_KEY não configurada.', missingVariables: ['RESEND_API_KEY'] });
    const rate = Math.min(100, Math.max(1, Number(req.body?.sendRatePerMinute || 30)));
    const dailyLimit = Math.min(10000, Math.max(1, Number(req.body?.dailyLimit || 500)));
    const batchSize = Math.min(25, Math.max(1, Number(req.body?.batchSize || 10)));
    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;
    if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 30000 || scheduledAt.getTime() > Date.now() + 366 * 86400000)) return res.status(400).json({ error: 'Data de agendamento inválida.' });
    const updated = (await pool.query(
      `UPDATE email_campaigns SET status=$1,send_rate_per_minute=$2,daily_limit=$3,batch_size=$4,scheduled_at=$5,
       queued_count=total_recipients,paused_at=NULL,last_error=NULL,updated_at=NOW()
       WHERE id=$6 AND business_id=$7 AND status='draft' RETURNING *`,
      [scheduledAt ? 'scheduled' : 'queued', rate, dailyLimit, batchSize, scheduledAt, campaign.id, authorized.business.id]
    )).rows[0];
    res.json({ campaign: emailCampaignForClient(updated) });
  } catch (e) { console.error('[email-campaign-start]', e.message); res.status(500).json({ error: e.message || 'Falha ao iniciar a campanha.' }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/campaigns/:campaignId/process', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailSenderDomainSchema(pool); await ensureEmailCampaignSchema(pool);
    if (!process.env.APP_URL) return res.status(503).json({ error: 'APP_URL não configurada para os links de descadastramento.' });
    res.json(await processRawEmailCampaignBatch(pool, req.params.campaignId, authorized.business.id, process.env.APP_URL));
  } catch (e) {
    console.error('[email-campaign-process]', e.message);
    res.status(e.code === 'EMAIL_PROVIDER_NOT_CONFIGURED' ? 503 : 500).json({ error: e.message || 'Falha ao processar o lote.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/campaigns/:campaignId/pause', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailCampaignSchema(pool);
    const campaign = (await pool.query("UPDATE email_campaigns SET status='paused',paused_at=NOW(),updated_at=NOW() WHERE id=$1 AND business_id=$2 AND status IN ('queued','sending','scheduled') RETURNING *", [req.params.campaignId, authorized.business.id])).rows[0];
    if (!campaign) return res.status(409).json({ error: 'A campanha não está em execução.' });
    res.json({ campaign: emailCampaignForClient(campaign) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/campaigns/:campaignId/resume', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailCampaignSchema(pool);
    if (req.body?.confirmation !== 'RETOMAR') return res.status(400).json({ error: 'Confirmação de retomada ausente.' });
    const campaign = (await pool.query("UPDATE email_campaigns SET status=CASE WHEN scheduled_at > NOW() THEN 'scheduled' ELSE 'queued' END,paused_at=NULL,updated_at=NOW() WHERE id=$1 AND business_id=$2 AND status='paused' RETURNING *", [req.params.campaignId, authorized.business.id])).rows[0];
    if (!campaign) return res.status(409).json({ error: 'A campanha não está pausada.' });
    res.json({ campaign: emailCampaignForClient(campaign) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/campaigns/:campaignId/cancel', async (req, res) => {
  const pool = createPool(); let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailCampaignSchema(pool);
    if (req.body?.confirmation !== 'CANCELAR') return res.status(400).json({ error: 'Confirmação de cancelamento ausente.' });
    client = await pool.connect(); await client.query('BEGIN');
    const campaign = (await client.query("UPDATE email_campaigns SET status='cancelled',queued_count=0,cancelled_at=NOW(),updated_at=NOW() WHERE id=$1 AND business_id=$2 AND status IN ('draft','queued','sending','paused','scheduled') RETURNING *", [req.params.campaignId, authorized.business.id])).rows[0];
    if (!campaign) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'A campanha não pode ser cancelada.' }); }
    await client.query("UPDATE email_campaign_recipients SET status='cancelled',updated_at=NOW() WHERE campaign_id=$1 AND status IN ('queued','processing')", [campaign.id]);
    await client.query('COMMIT'); res.json({ campaign: emailCampaignForClient(campaign) });
  } catch (e) { if (client) await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ error: e.message || 'Falha ao cancelar a campanha.' }); }
  finally { client?.release(); pool.end().catch(() => {}); }
});

app.get('/api/prospecting/email/worker', async (req, res) => {
  let pool;
  try {
    verifyRawEmailWorkerAuthorization(req);
    const appUrl = emailEnv('APP_URL');
    if (!appUrl) { const error = new Error('APP_URL não configurada.'); error.code = 'WORKER_CONFIG'; throw error; }
    pool = createPool();
    await ensureEmailSenderDomainSchema(pool); await ensureEmailCampaignSchema(pool);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await runRawEmailDispatchWorker(pool, appUrl));
  } catch (error) {
    if (error.code === 'WORKER_AUTH') return res.status(401).json({ error: error.message });
    if (error.code === 'WORKER_CONFIG') return res.status(503).json({ error: error.message });
    console.error('[email-dispatch-worker]', error.message);
    res.status(500).json({ error: 'Falha ao executar o worker de e-mails.' });
  } finally { pool?.end().catch(() => {}); }
});

app.get('/api/prospecting/email/worker/status', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    await ensureEmailCampaignSchema(pool);
    const [state, workload] = await Promise.all([
      pool.query("SELECT * FROM email_dispatch_worker_state WHERE id='main'"),
      pool.query(
        `SELECT COUNT(DISTINCT c.id)::int AS active_campaigns,
                COUNT(r.id) FILTER (WHERE r.status IN ('queued','processing'))::int AS pending_recipients
         FROM email_campaigns c LEFT JOIN email_campaign_recipients r ON r.campaign_id=c.id
         WHERE c.business_id=$1 AND c.status IN ('scheduled','queued','sending')`,
        [authorized.business.id]
      ),
    ]);
    const row = state.rows[0] || {};
    res.json({
      configured: emailEnv('CRON_SECRET').length >= 16, status: row.status || 'never_run',
      lastStartedAt: row.last_started_at || null, lastCompletedAt: row.last_completed_at || null,
      lastError: row.last_error || null, activeCampaigns: Number(workload.rows[0]?.active_campaigns || 0),
      pendingRecipients: Number(workload.rows[0]?.pending_recipients || 0),
    });
  } catch (error) { res.status(500).json({ error: error.message || 'Falha ao consultar o worker.' }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/email/webhooks/resend', async (req, res) => {
  let pool;
  try {
    const verifiedEvent = verifyRawResendWebhook(req);
    pool = createPool();
    await ensureEmailCampaignSchema(pool);
    res.status(200).json(await processRawResendWebhook(pool, req, verifiedEvent));
  } catch (error) {
    if (error.code === 'WEBHOOK_CONFIG') return res.status(503).json({ error: error.message });
    if (error.code === 'WEBHOOK_SIGNATURE') return res.status(400).json({ error: error.message });
    console.error('[resend-webhook]', error.message);
    res.status(500).json({ error: 'Falha ao processar o evento de e-mail.' });
  } finally { pool?.end().catch(() => {}); }
});

async function rawUnsubscribeHandler(req, res) {
  const token = String(req.params.token || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) return res.status(400).send('Link de descadastramento inválido.');
  const pool = createPool(); let client;
  try {
    await ensureEmailCampaignSchema(pool); client = await pool.connect(); await client.query('BEGIN');
    const recipient = (await client.query('SELECT * FROM email_campaign_recipients WHERE unsubscribe_token=$1 FOR UPDATE', [token])).rows[0];
    if (!recipient) { await client.query('ROLLBACK'); return res.status(404).send('Link de descadastramento não encontrado.'); }
    await client.query(
      `INSERT INTO email_unsubscribes (organization_id,business_id,campaign_id,recipient_id,email,normalized_email,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (business_id,normalized_email) DO UPDATE SET
       campaign_id=EXCLUDED.campaign_id,recipient_id=EXCLUDED.recipient_id,source=EXCLUDED.source,unsubscribed_at=NOW()`,
      [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, recipient.email, recipient.normalized_email, req.method === 'POST' ? 'one_click' : 'link']
    );
    await client.query(
      `INSERT INTO email_campaign_events (organization_id,business_id,campaign_id,recipient_id,provider,event_type,payload,occurred_at)
       VALUES ($1,$2,$3,$4,'internal','unsubscribed',$5::jsonb,NOW())`,
      [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, JSON.stringify({ source: req.method === 'POST' ? 'one_click' : 'link' })]
    );
    await client.query("UPDATE email_campaign_recipients SET status='unsubscribed',unsubscribed_at=NOW(),updated_at=NOW() WHERE business_id=$1 AND normalized_email=$2 AND status<>'cancelled'", [recipient.business_id, recipient.normalized_email]);
    await client.query(
      `UPDATE email_campaigns c SET unsubscribed_count=s.total,updated_at=NOW()
       FROM (SELECT campaign_id,COUNT(*) FILTER (WHERE status='unsubscribed')::int total
             FROM email_campaign_recipients WHERE business_id=$1 AND normalized_email=$2 GROUP BY campaign_id) s
       WHERE c.id=s.campaign_id`,
      [recipient.business_id, recipient.normalized_email]
    );
    await client.query('COMMIT');
    if (req.method === 'POST') return res.status(200).send('OK');
    res.status(200).type('html').send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Descadastrado</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:80px auto;padding:24px;color:#1e293b"><h1>Descadastramento confirmado</h1><p>Este endereço não receberá novos e-mails de prospecção desta empresa.</p></body></html>');
  } catch (e) { if (client) await client.query('ROLLBACK').catch(() => {}); res.status(500).send('Não foi possível concluir o descadastramento.'); }
  finally { client?.release(); pool.end().catch(() => {}); }
}

app.get('/api/prospecting/email/unsubscribe/:token', rawUnsubscribeHandler);
app.post('/api/prospecting/email/unsubscribe/:token', rawUnsubscribeHandler);

function prospectingSearchForClient(row) {
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    userId: row.user_id,
    radiusKm: row.radius_km,
    requestedLimit: Number(row.requested_limit || 0),
    totalFound: Number(row.total_found || 0),
    totalWithEmail: Number(row.total_with_email || 0),
    totalWithPhone: Number(row.total_with_phone || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function prospectForClient(row) {
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    searchId: row.search_id,
    companyName: row.company_name,
    legalName: row.legal_name,
    taxId: row.tax_id,
    address: row.address,
    neighborhood: row.neighborhood,
    postalCode: row.postal_code,
    notes: row.notes,
    sourceType: row.source_type,
    importBatchKey: row.import_batch_key,
    importFileName: row.import_file_name,
    importedAt: row.imported_at,
    emailType: row.email_type,
    websiteStatus: row.website_status,
    sourceUrl: row.source_url,
    contactSource: row.contact_source,
    qualificationScore: row.qualification_score == null ? null : Number(row.qualification_score),
    qualificationReason: row.qualification_reason,
    qualificationFit: row.qualification_fit,
    possibleNeed: row.possible_need,
    crmLeadId: row.crm_lead_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let prospectingImportSchemaReady = false;
async function ensureProspectingImportSchema(pool) {
  if (prospectingImportSchemaReady) return;
  await pool.query(`
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tax_id text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS neighborhood text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS postal_code text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'search';
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS import_batch_key text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS import_file_name text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS imported_at timestamp;
    CREATE INDEX IF NOT EXISTS prospects_business_source_idx ON prospects (business_id, source_type);
    CREATE INDEX IF NOT EXISTS prospects_business_tax_id_idx ON prospects (business_id, tax_id);
  `);
  prospectingImportSchemaReady = true;
}

function cleanSpreadsheetValue(value, maxLength = 500) {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function digitsOnly(value, maxLength = 20) {
  const valueDigits = String(value ?? '').replace(/\D/g, '');
  return valueDigits && !/^0+$/.test(valueDigits) ? valueDigits.slice(0, maxLength) : null;
}

function defaultProspectApproach(business, prospect, options = {}) {
  const senderName = cleanSpreadsheetValue(options.senderName, 100) || 'um consultor comercial';
  const commercialName = cleanSpreadsheetValue(options.commercialName, 140) || cleanSpreadsheetValue(business.name, 140) || 'nossa empresa';
  const channel = ['email', 'whatsapp', 'linkedin'].includes(options.channel) ? options.channel : 'email';
  const objective = ['present_platform', 'advertise_products', 'partnership', 'schedule_meeting'].includes(options.objective) ? options.objective : 'present_platform';
  const offerProduct = cleanSpreadsheetValue(options.offerProduct, 220);
  const location = [prospect.city, prospect.state].filter(Boolean).join(', ');
  const prospectContext = `${prospect.company_name}${prospect.segment ? ` atua no segmento de ${prospect.segment}` : ''}${location ? ` em ${location}` : ''}`;
  const isAgro = /agro|rural|pecu|revenda/i.test([commercialName, business.segment, business.description, prospect.segment].filter(Boolean).join(' '));
  const valueProposition = offerProduct
    ? `podemos apoiar sua empresa com ${offerProduct}`
    : isAgro
      ? 'conectamos empresas do agronegócio a produtores e compradores rurais, ampliando a visibilidade de produtos e ofertas'
      : `ajudamos empresas a ampliar sua presença comercial com ${business.segment || 'soluções especializadas'}`;
  const objectiveSentence = {
    present_platform: `Gostaria de apresentar como ${valueProposition}.`,
    advertise_products: `Gostaria de mostrar como a ${prospect.company_name} pode divulgar seus produtos e ofertas para novos compradores.`,
    partnership: `Acredito que pode existir uma oportunidade de parceria comercial entre nossas empresas.`,
    schedule_meeting: `Gostaria de entender os objetivos comerciais da empresa e avaliar se podemos contribuir.`,
  }[objective];
  const cta = channel === 'whatsapp'
    ? 'Faz sentido conversarmos por alguns minutos nesta semana?'
    : channel === 'linkedin'
      ? 'Se fizer sentido, podemos trocar algumas ideias por aqui?'
      : 'Você teria disponibilidade para uma conversa breve, de 10 minutos, nesta semana?';

  if (channel === 'whatsapp') {
    return {
      subject: '',
      opening: `Olá! Tudo bem? Sou ${senderName}, da ${commercialName}.`,
      message: `Vi que a ${prospectContext}. ${objectiveSentence}`,
      cta,
    };
  }
  if (channel === 'linkedin') {
    return {
      subject: '',
      opening: `Olá! Sou ${senderName}, da ${commercialName}.`,
      message: `Conheci o perfil da ${prospect.company_name}${prospect.segment ? ` no segmento de ${prospect.segment}` : ''}. ${objectiveSentence}`,
      cta,
    };
  }
  return {
    subject: objective === 'advertise_products' ? `Mais visibilidade para os produtos da ${prospect.company_name}` : `Uma oportunidade para a ${prospect.company_name}`,
    opening: `Olá, equipe da ${prospect.company_name}. Tudo bem? Sou ${senderName}, da ${commercialName}.`,
    message: `Identifiquei que a ${prospectContext}. ${objectiveSentence}`,
    cta,
  };
}

function parseGeminiJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned || '{}');
}

function normalizeProspectingText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function discoverProspectingCompanies(params) {
  const query = [params.segment, params.keywords, params.city, params.state, params.country].filter(Boolean).join(' ');
  const limit = Math.min(50, Math.max(1, Number(params.limit || 25)));
  let companies = [];

  if (process.env.GEOAPIFY_API_KEY) {
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.searchParams.set('text', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('apiKey', process.env.GEOAPIFY_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`O provedor Geoapify respondeu com status ${response.status}.`);
    const data = await response.json();
    companies = (Array.isArray(data.features) ? data.features : []).map(feature => {
      const p = feature.properties || {};
      return {
        companyName: p.name || p.company || p.legal_name,
        legalName: p.legal_name || null,
        segment: params.segment,
        description: p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(', '),
        city: p.city || p.municipality || p.county || params.city || null,
        state: p.state || p.state_code || params.state || null,
        country: p.country || params.country || 'Brasil',
        website: p.website || p.contact?.website || p.url || null,
        phone: p.phone || p.contact?.phone || p.contact?.mobile || null,
        email: p.email || p.contact?.email || null,
        sourceUrl: p.website || p.contact?.website || null,
        contactSource: 'Geoapify',
        resultType: p.result_type || p.place_type || null,
      };
    });
  }

  if (!companies.length && process.env.GOOGLE_PLACES_API_KEY) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`O provedor Google Places respondeu com status ${response.status}.`);
    const data = await response.json();
    const places = (Array.isArray(data.results) ? data.results : []).slice(0, limit);
    companies = await Promise.all(places.map(async place => {
      let details = {};
      if (place.place_id) {
        try {
          const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
          detailsUrl.searchParams.set('place_id', place.place_id);
          detailsUrl.searchParams.set('fields', 'name,website,formatted_phone_number,international_phone_number');
          detailsUrl.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY);
          const detailsResponse = await fetch(detailsUrl, { signal: AbortSignal.timeout(8000) });
          if (detailsResponse.ok) details = (await detailsResponse.json()).result || {};
        } catch { /* Keep the public text-search result when details time out. */ }
      }
      return {
        companyName: details.name || place.name,
        legalName: null,
        segment: params.segment,
        description: place.formatted_address || place.vicinity || null,
        city: params.city || null,
        state: params.state || null,
        country: params.country || 'Brasil',
        website: details.website || null,
        phone: details.formatted_phone_number || details.international_phone_number || null,
        email: null,
        sourceUrl: details.website || null,
        contactSource: 'Google Places',
      };
    }));
  }

  if (!process.env.GEOAPIFY_API_KEY && !process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error('Configure GEOAPIFY_API_KEY ou GOOGLE_PLACES_API_KEY para realizar buscas reais.');
  }

  const invalidNames = new Set([
    normalizeProspectingText(params.city), normalizeProspectingText(params.state),
    normalizeProspectingText(params.country), 'brasil', 'brazil',
  ].filter(Boolean));
  const seen = new Set();
  return companies.filter(company => {
    const name = String(company.companyName || '').trim();
    if (['city', 'county', 'state', 'country', 'postcode', 'street'].includes(String(company.resultType || '').toLowerCase())) return false;
    if (name.length < 2 || invalidNames.has(normalizeProspectingText(name))) return false;
    const signature = `${normalizeProspectingText(name)}:${normalizeProspectingText(company.city)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).slice(0, limit);
}

app.post('/api/prospecting/search', async (req, res) => {
  const pool = createPool();
  let searchRecord;
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const decoded = verifyToken(req);
    const segment = String(req.body?.segment || '').trim();
    if (!segment) return res.status(400).json({ error: 'Segmento é obrigatório para realizar a busca.' });
    const requestedLimit = Math.min(50, Math.max(1, Number(req.body?.requestedLimit || 25)));
    const params = {
      segment,
      city: String(req.body?.city || '').trim(),
      state: String(req.body?.state || '').trim(),
      country: String(req.body?.country || 'Brasil').trim() || 'Brasil',
      keywords: String(req.body?.keywords || '').trim(),
      radiusKm: req.body?.radiusKm ? Number(req.body.radiusKm) : null,
      limit: requestedLimit,
    };
    searchRecord = (await pool.query(
      `INSERT INTO prospecting_searches
        (organization_id, business_id, user_id, segment, city, state, country, radius_km, keywords, requested_limit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'running') RETURNING *`,
      [authorized.business.organization_id, authorized.business.id, decoded.userId, segment, params.city || null, params.state || null, params.country, params.radiusKm, params.keywords || null, requestedLimit]
    )).rows[0];

    const discovered = await discoverProspectingCompanies(params);
    client = await pool.connect();
    await client.query('BEGIN');
    const saved = [];
    for (const company of discovered) {
      const contactPoints = [company.email, company.phone, company.website].filter(Boolean).length;
      const score = Math.min(100, 35 + contactPoints * 15 + (company.description ? 10 : 0));
      const fit = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
      let domain = null;
      try { domain = company.website ? new URL(company.website).hostname.replace(/^www\./, '') : null; } catch { /* Invalid public URL */ }
      const row = (await client.query(
        `INSERT INTO prospects
          (organization_id, business_id, search_id, company_name, legal_name, segment, description, city, state, country,
           website, domain, phone, email, email_type, website_status, source_url, contact_source, confidence,
           qualification_score, qualification_reason, qualification_fit, possible_need, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
        [
          authorized.business.organization_id, authorized.business.id, searchRecord.id, company.companyName, company.legalName,
          segment, company.description, company.city, company.state, company.country, company.website, domain, company.phone,
          company.email, company.email ? 'general' : null, company.website ? (company.email || company.phone ? 'contact_found' : 'website_found_no_contact') : 'no_website_found',
          company.sourceUrl, company.contactSource, contactPoints >= 2 ? 'high' : 'medium', score,
          `Pontuação baseada na completude dos dados públicos encontrados (${contactPoints} meios de contato).`, fit,
          `Possível interesse em soluções relacionadas a ${authorized.business.segment || authorized.business.name}.`, fit === 'high' ? 'qualified' : 'new',
        ]
      )).rows[0];
      saved.push(row);
    }
    const totalWithEmail = saved.filter(item => item.email).length;
    const totalWithPhone = saved.filter(item => item.phone).length;
    await client.query(
      `UPDATE prospecting_searches SET status='completed', total_found=$1, total_with_email=$2,
       total_with_phone=$3, completed_at=NOW(), updated_at=NOW() WHERE id=$4`,
      [saved.length, totalWithEmail, totalWithPhone, searchRecord.id]
    );
    await client.query('COMMIT');
    res.json({ searchId: searchRecord.id, totalFound: saved.length, totalWithEmail, totalWithPhone });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (searchRecord?.id) await pool.query("UPDATE prospecting_searches SET status='failed', updated_at=NOW() WHERE id=$1", [searchRecord.id]).catch(() => {});
    console.error('[prospecting-search]', e.message);
    res.status(e.name === 'TimeoutError' ? 504 : 500).json({ error: e.message || 'Falha ao executar busca de prospecção.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.get('/api/prospecting/searches', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const rows = (await pool.query('SELECT * FROM prospecting_searches WHERE business_id=$1 ORDER BY created_at DESC', [authorized.business.id])).rows;
    res.json({ searches: rows.map(prospectingSearchForClient) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/searches/:searchId', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const search = (await pool.query('SELECT * FROM prospecting_searches WHERE id=$1 AND business_id=$2', [req.params.searchId, authorized.business.id])).rows[0];
    if (!search) return res.status(404).json({ error: 'Busca de prospecção não encontrada.' });
    const prospects = (await pool.query('SELECT * FROM prospects WHERE search_id=$1 AND business_id=$2 ORDER BY qualification_score DESC NULLS LAST, created_at DESC', [search.id, authorized.business.id])).rows;
    res.json({ search: prospectingSearchForClient(search), prospects: prospects.map(prospectForClient) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/prospects', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    if (req.query.origin === 'spreadsheet' || req.query.origin === 'search') await ensureProspectingImportSchema(pool);
    const conditions = ['business_id=$1'];
    const values = [authorized.business.id];
    const add = (condition, value) => { values.push(value); conditions.push(condition.replace('?', `$${values.length}`)); };
    if (req.query.hasEmail === 'true') conditions.push("email IS NOT NULL AND email<>''");
    if (req.query.hasPhone === 'true') conditions.push("phone IS NOT NULL AND phone<>''");
    if (req.query.hasWebsite === 'true') conditions.push("website IS NOT NULL AND website<>''");
    if (req.query.status) add('status=?', String(req.query.status));
    if (req.query.fit) add('qualification_fit=?', String(req.query.fit));
    if (req.query.origin === 'spreadsheet') conditions.push("source_type='spreadsheet'");
    if (req.query.origin === 'search') conditions.push("COALESCE(source_type, 'search')='search'");
    if (req.query.state) add('state ILIKE ?', String(req.query.state).trim());
    if (req.query.segment) add('segment ILIKE ?', `%${String(req.query.segment).trim()}%`);
    if (req.query.search) add("(company_name ILIKE ? OR city ILIKE ? OR email ILIKE ? OR website ILIKE ?)", `%${String(req.query.search).trim()}%`);
    // Expand the single search placeholder safely for all four searchable columns.
    if (req.query.search) {
      const searchValue = values.pop();
      conditions.pop();
      const placeholders = [];
      for (let i = 0; i < 4; i++) { values.push(searchValue); placeholders.push(`$${values.length}`); }
      conditions.push(`(company_name ILIKE ${placeholders[0]} OR city ILIKE ${placeholders[1]} OR email ILIKE ${placeholders[2]} OR website ILIKE ${placeholders[3]})`);
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(25, Number(req.query.pageSize || (req.query.origin === 'spreadsheet' ? 100 : 200))));
    const count = Number((await pool.query(`SELECT COUNT(*) FROM prospects WHERE ${conditions.join(' AND ')}`, values)).rows[0]?.count || 0);
    const queryValues = [...values, pageSize, (page - 1) * pageSize];
    const rows = (await pool.query(`SELECT * FROM prospects WHERE ${conditions.join(' AND ')} ORDER BY qualification_score DESC NULLS LAST, created_at DESC LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`, queryValues)).rows;
    res.json({ prospects: rows.map(prospectForClient), pagination: { page, pageSize, total: count, totalPages: Math.max(1, Math.ceil(count / pageSize)) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/import-spreadsheet', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const inputRows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 250) : [];
    if (!inputRows.length) return res.status(400).json({ error: 'Nenhuma empresa foi enviada para importação.' });
    await ensureProspectingImportSchema(pool);

    const existingRows = (await pool.query(
      `SELECT tax_id, LOWER(COALESCE(email,'')) AS email,
              regexp_replace(COALESCE(phone,''), '\\D', '', 'g') AS phone,
              LOWER(COALESCE(company_name,'')) || '|' || LOWER(COALESCE(city,'')) AS name_city
         FROM prospects WHERE business_id=$1`,
      [authorized.business.id]
    )).rows;
    const known = new Set();
    for (const item of existingRows) {
      if (item.tax_id) known.add(`tax:${digitsOnly(item.tax_id, 20)}`);
      if (item.email) known.add(`email:${item.email}`);
      if (item.phone) known.add(`phone:${item.phone}`);
      if (item.name_city !== '|') known.add(`name:${item.name_city}`);
    }

    const accepted = [];
    let duplicates = 0;
    let invalid = 0;
    for (const raw of inputRows) {
      const companyName = cleanSpreadsheetValue(raw?.companyName, 250);
      if (!companyName) { invalid++; continue; }
      const taxId = digitsOnly(raw?.taxId, 20);
      const email = cleanSpreadsheetValue(raw?.email, 250)?.toLowerCase() || null;
      const phone = digitsOnly(raw?.phone, 20);
      const city = cleanSpreadsheetValue(raw?.city, 120);
      const signatures = [
        taxId ? `tax:${taxId}` : null,
        email ? `email:${email}` : null,
        phone ? `phone:${phone}` : null,
        `name:${companyName.toLowerCase()}|${String(city || '').toLowerCase()}`,
      ].filter(Boolean);
      if (signatures.some(signature => known.has(signature))) { duplicates++; continue; }
      signatures.forEach(signature => known.add(signature));
      accepted.push({
        companyName, taxId, email, phone, city,
        address: cleanSpreadsheetValue(raw?.address, 500),
        neighborhood: cleanSpreadsheetValue(raw?.neighborhood, 150),
        state: cleanSpreadsheetValue(raw?.state, 40)?.toUpperCase() || null,
        postalCode: digitsOnly(raw?.postalCode, 12),
        segment: cleanSpreadsheetValue(raw?.segment, 200),
        notes: cleanSpreadsheetValue(raw?.notes, 4000),
      });
    }

    if (accepted.length) {
      const fileName = cleanSpreadsheetValue(req.body?.fileName, 250) || 'Planilha importada';
      const batchKey = cleanSpreadsheetValue(req.body?.batchKey, 100) || `${Date.now()}`;
      const params = [];
      const tuples = accepted.map(item => {
        const score = Math.min(70, 20 + [item.taxId, item.email, item.phone, item.address].filter(Boolean).length * 10);
        const values = [
          authorized.business.organization_id, authorized.business.id, item.companyName, item.companyName,
          item.segment, item.city, item.state, 'Brasil', item.phone, item.email, item.taxId, item.address,
          item.neighborhood, item.postalCode, item.notes, 'spreadsheet', batchKey, fileName,
          item.email ? 'general' : null, item.email || item.phone ? 'contact_found' : 'no_website_found',
          `Planilha: ${fileName}`, item.email && item.phone ? 'high' : 'medium', score,
          'Importado de planilha; aguardando qualificação comercial.', score >= 60 ? 'medium' : 'low', 'new',
        ];
        const placeholders = values.map(value => { params.push(value); return `$${params.length}`; });
        return `(${placeholders.join(',')}, NOW(), NOW(), NOW())`;
      });
      await pool.query(
        `INSERT INTO prospects
          (organization_id, business_id, company_name, legal_name, segment, city, state, country, phone, email,
           tax_id, address, neighborhood, postal_code, notes, source_type, import_batch_key, import_file_name,
           email_type, website_status, contact_source, confidence, qualification_score, qualification_reason,
           qualification_fit, status, imported_at, created_at, updated_at)
         VALUES ${tuples.join(',')}`,
        params
      );
    }
    res.json({ imported: accepted.length, duplicates, invalid });
  } catch (e) {
    console.error('[prospecting-spreadsheet-import]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao importar a planilha.' });
  } finally { pool.end().catch(() => {}); }
});

app.patch('/api/prospecting/prospects/status', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 250) : [];
    const allowed = new Set(['new', 'reviewed', 'qualified', 'disqualified']);
    const status = String(req.body?.status || '');
    if (!ids.length || !allowed.has(status)) return res.status(400).json({ error: 'Seleção ou status inválido.' });
    const updated = await pool.query(
      'UPDATE prospects SET status=$1, updated_at=NOW() WHERE business_id=$2 AND id=ANY($3::uuid[]) AND crm_lead_id IS NULL RETURNING id',
      [status, authorized.business.id, ids]
    );
    res.json({ updatedCount: updated.rowCount || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/prospects/:id/generate-approach', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const prospect = (await pool.query(
      'SELECT * FROM prospects WHERE id=$1 AND business_id=$2 LIMIT 1',
      [req.params.id, authorized.business.id]
    )).rows[0];
    if (!prospect) return res.status(404).json({ error: 'Prospect não encontrado.' });

    const fallback = defaultProspectApproach(authorized.business, prospect, req.body || {});
    let approach = fallback;
    let source = 'template';
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const channel = ['email', 'whatsapp', 'linkedin'].includes(req.body?.channel) ? req.body.channel : 'email';
        const objectiveLabels = {
          present_platform: 'apresentar a plataforma', advertise_products: 'convidar a empresa para anunciar produtos',
          partnership: 'propor uma parceria', schedule_meeting: 'agendar uma conversa',
        };
        const prompt = `Crie uma abordagem comercial B2B curta, ética e personalizada em português do Brasil para ${channel}.
Não invente relacionamento anterior, resultados ou fatos. Não envie nada; produza apenas uma minuta.
Evite frases artificiais, repetição do nome das empresas e cópia literal da descrição do negócio.
Para WhatsApp use no máximo 550 caracteres. Para LinkedIn use no máximo 700. Para e-mail use no máximo 1200.

NOSSA EMPRESA:
- Nome comercial: ${cleanSpreadsheetValue(req.body?.commercialName, 140) || authorized.business.name}
- Remetente: ${cleanSpreadsheetValue(req.body?.senderName, 100) || 'consultor comercial'}
- Segmento: ${authorized.business.segment || 'não informado'}
- Descrição: ${authorized.business.description || 'não informada'}
- Oferta: ${cleanSpreadsheetValue(req.body?.offerProduct, 200) || 'solução principal da empresa'}
- Objetivo: ${objectiveLabels[req.body?.objective] || objectiveLabels.present_platform}

PROSPECT:
- Empresa: ${prospect.company_name}
- Segmento: ${prospect.segment || 'não informado'}
- Cidade/UF: ${[prospect.city, prospect.state].filter(Boolean).join('/') || 'não informado'}
- Observações: ${cleanSpreadsheetValue(prospect.notes || prospect.description, 600) || 'sem observações'}

Responda somente em JSON:
{"subject":"assunto","opening":"saudação","message":"mensagem","cta":"chamada para ação"}`;
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: { responseMimeType: 'application/json', maxOutputTokens: 700 },
        });
        const generated = parseGeminiJson(response.text);
        approach = {
          subject: cleanSpreadsheetValue(generated.subject, 200) || fallback.subject,
          opening: cleanSpreadsheetValue(generated.opening, 300) || fallback.opening,
          message: cleanSpreadsheetValue(generated.message, 1800) || fallback.message,
          cta: cleanSpreadsheetValue(generated.cta, 400) || fallback.cta,
        };
        source = 'gemini';
      } catch (aiError) {
        console.warn('[prospecting-generate-approach-ai]', aiError.message);
      }
    }
    res.json({ approach, source });
  } catch (e) {
    console.error('[prospecting-generate-approach]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao gerar proposta de abordagem.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/prospects/:id/qualify', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const prospect = (await pool.query(
      'SELECT * FROM prospects WHERE id=$1 AND business_id=$2 LIMIT 1',
      [req.params.id, authorized.business.id]
    )).rows[0];
    if (!prospect) return res.status(404).json({ error: 'Prospect não encontrado.' });
    let score = 35;
    if (prospect.tax_id) score += 10;
    if (prospect.email) score += 15;
    if (prospect.phone) score += 15;
    if (prospect.segment) score += 10;
    if (prospect.city) score += 5;
    score = Math.min(100, score);
    const fit = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    const reason = `Qualificação baseada na completude dos dados disponíveis: ${[prospect.email && 'e-mail', prospect.phone && 'telefone', prospect.tax_id && 'CNPJ/CPF', prospect.segment && 'segmento'].filter(Boolean).join(', ') || 'cadastro básico'}.`;
    const updated = (await pool.query(
      `UPDATE prospects SET qualification_score=$1, qualification_fit=$2, qualification_reason=$3,
       possible_need=$4, status=$5, updated_at=NOW() WHERE id=$6 AND business_id=$7 RETURNING *`,
      [score, fit, reason, `Possível interesse em ${authorized.business.segment || 'soluções comerciais e de marketing'}.`, fit === 'high' ? 'qualified' : 'reviewed', prospect.id, authorized.business.id]
    )).rows[0];
    res.json({ prospect: prospectForClient(updated), qualification: { score, fit, reason } });
  } catch (e) {
    console.error('[prospecting-qualify]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao qualificar prospect.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/prospects/import', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 250) : [];
    if (!ids.length) return res.status(400).json({ error: 'Nenhum prospect selecionado para importação.' });
    client = await pool.connect();
    await client.query('BEGIN');
    const prospects = (await client.query('SELECT * FROM prospects WHERE business_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE', [authorized.business.id, ids])).rows;
    let importedCount = 0;
    for (const prospect of prospects) {
      if (prospect.crm_lead_id) continue;
      const duplicateConditions = ['LOWER(company_name)=LOWER($2)'];
      const duplicateValues = [authorized.business.id, prospect.company_name];
      if (prospect.email) {
        duplicateValues.push(prospect.email);
        duplicateConditions.push(`LOWER(email)=LOWER($${duplicateValues.length})`);
      }
      if (prospect.phone) {
        duplicateValues.push(String(prospect.phone).replace(/\D/g, ''));
        duplicateConditions.push(`regexp_replace(COALESCE(phone,''), '\\D', '', 'g')=$${duplicateValues.length}`);
      }
      const existingLead = (await client.query(
        `SELECT id FROM leads WHERE business_id=$1 AND (${duplicateConditions.join(' OR ')}) LIMIT 1`,
        duplicateValues
      )).rows[0];
      if (existingLead) {
        await client.query("UPDATE prospects SET status='imported', crm_lead_id=$1, updated_at=NOW() WHERE id=$2", [existingLead.id, prospect.id]);
        continue;
      }
      const lead = (await client.query(
        `INSERT INTO leads (organization_id, business_id, name, company_name, email, phone, source, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,'Prospecção','new',$7) RETURNING id`,
        [authorized.business.organization_id, authorized.business.id, prospect.company_name, prospect.company_name, prospect.email, prospect.phone, `Importado da prospecção. ${prospect.qualification_reason || ''}`]
      )).rows[0];
      await client.query("UPDATE prospects SET status='imported', crm_lead_id=$1, updated_at=NOW() WHERE id=$2", [lead.id, prospect.id]);
      importedCount++;
    }
    await client.query('COMMIT');
    res.json({ importedCount });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally { client?.release(); pool.end().catch(() => {}); }
});

app.post('/api/prospecting/prospects/export', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 1000) : [];
    const result = ids.length
      ? await pool.query('SELECT * FROM prospects WHERE business_id=$1 AND id=ANY($2::uuid[]) ORDER BY company_name', [authorized.business.id, ids])
      : await pool.query('SELECT * FROM prospects WHERE business_id=$1 ORDER BY company_name', [authorized.business.id]);
    const csv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = result.rows.map(item => [item.company_name, item.tax_id, item.segment, item.city, item.state, item.website, item.email, item.phone, item.qualification_score, item.qualification_fit, item.status, item.import_file_name].map(csv).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
    res.send('\uFEFF' + ['Empresa,CNPJ/CPF,Segmento,Cidade,Estado,Site,Email,Telefone,Pontuação,Aderência,Status,Arquivo de origem', ...rows].join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/prospects/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const prospect = (await pool.query('SELECT * FROM prospects WHERE id=$1 AND business_id=$2', [req.params.id, authorized.business.id])).rows[0];
    if (!prospect) return res.status(404).json({ error: 'Prospect não encontrado.' });
    const contacts = (await pool.query('SELECT * FROM prospect_contacts WHERE prospect_id=$1 ORDER BY is_primary DESC, created_at', [prospect.id])).rows;
    res.json({ prospect: prospectForClient(prospect), contacts: contacts.map(contact => ({ ...contact, prospectId: contact.prospect_id, sourceUrl: contact.source_url, isPrimary: contact.is_primary, createdAt: contact.created_at })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Recommendations ──────────────────────────────────────────────────────────
app.get('/api/recommendations', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    res.json((await pool.query("SELECT * FROM recommendations WHERE business_id=$1 AND status='active' ORDER BY priority_score DESC", [biz.id])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Marketing Assistant ─────────────────────────────────────────────────────
app.post('/api/assistant/chat', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });

    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Digite uma mensagem para o assistente.' });
    if (message.length > 2000) return res.status(400).json({ error: 'A mensagem deve ter no máximo 2.000 caracteres.' });

    const businessId = authorized.business.id;
    const [businessResult, productsResult, audienceResult, goalsResult, campaignsResult, leadStatsResult] = await Promise.all([
      pool.query('SELECT name, segment, description, city, state, service_area, service_type FROM businesses WHERE id=$1', [businessId]),
      pool.query('SELECT name, type, description, main_benefit, ideal_customer FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT goal_type, target_metric, timeframe FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 5', [businessId]),
      pool.query('SELECT name, objective, status, budget, leads, sales FROM campaigns WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='new')::int AS new_count,
                COUNT(*) FILTER (WHERE status='proposal')::int AS proposals,
                COUNT(*) FILTER (WHERE status='customer')::int AS customers,
                COUNT(*) FILTER (WHERE status='lost')::int AS lost
         FROM leads WHERE business_id=$1`,
        [businessId]
      ),
    ]);

    const context = {
      business: businessResult.rows[0],
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
      goals: goalsResult.rows,
      campaigns: campaignsResult.rows,
      pipeline: leadStatsResult.rows[0],
    };

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    const history = rawHistory
      .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .map(item => ({ role: item.role, content: item.content.slice(0, 2000) }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const stats = context.pipeline || {};
      const answer = Number(stats.total || 0) === 0
        ? `Ainda não há leads cadastrados para ${context.business?.name || 'a empresa'}. Minha recomendação é começar definindo um perfil de cliente ideal e cadastrar os primeiros contatos no CRM. Depois disso, poderei analisar conversão, propostas e prioridades com mais precisão.`
        : `O funil atual possui ${stats.total || 0} leads, ${stats.proposals || 0} propostas e ${stats.customers || 0} clientes. Como ação imediata, revise as propostas abertas, registre o próximo contato de cada lead e concentre os esforços nos contatos com maior potencial de fechamento.`;
      return res.json({ answer, source: 'business-data' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Você é o Assistente de Marketing e Vendas do Marketing OS.
Responda em português do Brasil, de forma prática, clara e direta.
Use os dados da empresa abaixo como fonte principal. Não invente números, resultados ou fatos ausentes.
Quando faltarem dados, diga isso claramente e sugira o próximo passo.
Você pode ajudar com estratégia, conteúdo, campanhas, prospecção, CRM e análise do funil.
Não afirme que executou, publicou, enviou ou alterou algo; você apenas orienta.

DADOS DA EMPRESA:
${JSON.stringify(context, null, 2)}

HISTÓRICO RECENTE:
${history.map(item => `${item.role === 'user' ? 'Usuário' : 'Assistente'}: ${item.content}`).join('\n') || 'Sem histórico anterior.'}

PERGUNTA ATUAL:
${message}

Forneça uma resposta útil e, quando fizer sentido, finalize com até 3 próximos passos objetivos.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: 1200 },
    });
    const answer = String(response.text || '').trim();
    if (!answer) throw new Error('O assistente não retornou uma resposta.');
    res.json({ answer, source: 'gemini' });
  } catch (e) {
    console.error('[assistant-chat]', e.message);
    res.status(500).json({ error: 'Não foi possível gerar a resposta agora. Tente novamente.' });
  } finally { pool.end().catch(() => {}); }
});

// ─── Analytics ────────────────────────────────────────────────────────────────
function analyticsPeriod(period, customStart, customEnd) {
  const now = new Date();
  let end = new Date(now);
  let start = new Date(now);

  if (period === '7d') start.setDate(now.getDate() - 7);
  else if (period === '90d') start.setDate(now.getDate() - 90);
  else if (period === 'this_month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === 'custom' && customStart && customEnd) {
    start = new Date(customStart + 'T00:00:00');
    end = new Date(customEnd + 'T23:59:59.999');
  } else start.setDate(now.getDate() - 30);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error('Período de Analytics inválido.');
  }

  // Prevent oversized custom reports from exhausting a serverless invocation.
  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    throw new Error('O período máximo permitido é de 366 dias.');
  }

  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return { start, end, previousStart, previousEnd };
}

async function getAuthorizedBusiness(pool, req) {
  const decoded = verifyToken(req);
  if (!decoded) return { error: 401, message: 'Não autenticado.' };
  const member = (await pool.query(
    'SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1',
    [decoded.userId]
  )).rows[0];
  if (!member) return { error: 404, message: 'Organização não encontrada.' };
  const business = (await pool.query(
    'SELECT * FROM businesses WHERE organization_id=$1 LIMIT 1',
    [member.organization_id]
  )).rows[0];
  if (!business) return { error: 404, message: 'Empresa não encontrada.' };
  if (req.query.businessId && req.query.businessId !== business.id) {
    return { error: 403, message: 'Acesso negado a esta empresa.' };
  }
  return { business };
}

app.get('/api/analytics/overview', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });

    const businessId = authorized.business.id;
    const period = String(req.query.period || '30d');
    const comparePrevious = String(req.query.comparePrevious || 'true') === 'true';
    const { start, end, previousStart, previousEnd } = analyticsPeriod(
      period,
      req.query.customStart,
      req.query.customEnd
    );

    const [allLeadsResult, currentLeadsResult, convertedResult, campaignsResult, contentResult] = await Promise.all([
      pool.query('SELECT * FROM leads WHERE business_id=$1', [businessId]),
      pool.query('SELECT * FROM leads WHERE business_id=$1 AND created_at BETWEEN $2 AND $3', [businessId, start, end]),
      pool.query("SELECT * FROM leads WHERE business_id=$1 AND status='customer' AND converted_at BETWEEN $2 AND $3", [businessId, start, end]),
      pool.query('SELECT * FROM campaigns WHERE business_id=$1', [businessId]),
      pool.query('SELECT * FROM content_items WHERE business_id=$1', [businessId]),
    ]);

    const allLeads = allLeadsResult.rows;
    const currentLeads = currentLeadsResult.rows;
    const converted = convertedResult.rows;
    const businessCampaigns = campaignsResult.rows;
    const content = contentResult.rows;

    let previousLeads = [];
    let previousConverted = [];
    if (comparePrevious) {
      const previous = await Promise.all([
        pool.query('SELECT * FROM leads WHERE business_id=$1 AND created_at BETWEEN $2 AND $3', [businessId, previousStart, previousEnd]),
        pool.query("SELECT * FROM leads WHERE business_id=$1 AND status='customer' AND converted_at BETWEEN $2 AND $3", [businessId, previousStart, previousEnd]),
      ]);
      previousLeads = previous[0].rows;
      previousConverted = previous[1].rows;
    }

    const numeric = value => Number(value || 0);
    const parseInvestment = campaign => {
      if (numeric(campaign.investment_spent) > 0) return numeric(campaign.investment_spent);
      const normalized = String(campaign.budget || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
      return Number.parseFloat(normalized) || 0;
    };
    const revenueOf = list => list.reduce((sum, lead) => sum + numeric(lead.actual_value), 0);
    const change = (current, previous) => previous === 0 ? null : ((current - previous) / previous) * 100;

    const totalLeads = currentLeads.length;
    const totalCustomers = converted.length;
    const conversionRate = totalLeads ? (totalCustomers / totalLeads) * 100 : 0;
    const attributedRevenue = revenueOf(converted);
    const totalInvestment = businessCampaigns.reduce((sum, campaign) => sum + parseInvestment(campaign), 0);
    const activeLeads = allLeads.filter(lead => !['customer', 'lost'].includes(lead.status));
    const potentialPipelineValue = activeLeads.reduce((sum, lead) => sum + numeric(lead.potential_value), 0);

    const previousConversionRate = previousLeads.length ? (previousConverted.length / previousLeads.length) * 100 : 0;
    const stages = Object.fromEntries(['new', 'contacted', 'interested', 'proposal', 'customer', 'lost'].map(status => [status, { count: 0, value: 0 }]));
    const lostCounts = {};
    const sourceCounts = {};
    let conversionDays = 0;
    let conversionDates = 0;

    for (const lead of allLeads) {
      if (stages[lead.status]) {
        stages[lead.status].count++;
        stages[lead.status].value += numeric(lead.potential_value || lead.actual_value);
      }
      if (lead.status === 'lost') {
        const reason = lead.lost_reason || 'Outros / Não informado';
        lostCounts[reason] = (lostCounts[reason] || 0) + 1;
      }
      const source = lead.source || 'Outros';
      sourceCounts[source] ||= { leads: 0, customers: 0, revenue: 0, potential: 0 };
      sourceCounts[source].leads++;
      if (lead.status === 'customer') {
        sourceCounts[source].customers++;
        sourceCounts[source].revenue += numeric(lead.actual_value);
        if (lead.created_at && lead.converted_at) {
          conversionDays += Math.max(0, (new Date(lead.converted_at) - new Date(lead.created_at)) / 86400000);
          conversionDates++;
        }
      } else if (lead.status !== 'lost') sourceCounts[source].potential += numeric(lead.potential_value);
    }

    const totalLost = Object.values(lostCounts).reduce((sum, count) => sum + count, 0);
    const lostReasons = Object.entries(lostCounts).map(([reason, count]) => ({
      reason, count, percentage: totalLost ? (count / totalLost) * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    const campaigns = businessCampaigns.map(campaign => {
      const campaignLeads = allLeads.filter(lead => lead.campaign_id === campaign.id);
      const customers = campaignLeads.filter(lead => lead.status === 'customer');
      const investment = parseInvestment(campaign);
      const revenue = revenueOf(customers);
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        investment,
        crm: {
          leads: campaignLeads.length,
          customers: customers.length,
          conversionRate: campaignLeads.length ? (customers.length / campaignLeads.length) * 100 : 0,
          revenue,
          cpl: campaignLeads.length && investment ? investment / campaignLeads.length : null,
          cac: customers.length && investment ? investment / customers.length : null,
          roas: investment ? revenue / investment : null,
        },
        manual: { leads: campaign.leads, revenue: campaign.revenue_generated },
        hasDiscrepancy: campaign.leads != null && numeric(campaign.leads) !== campaignLeads.length,
      };
    });

    const channels = Object.entries(sourceCounts).map(([channel, values]) => ({
      channel,
      leads: values.leads,
      customers: values.customers,
      conversionRate: values.leads ? (values.customers / values.leads) * 100 : 0,
      revenue: values.revenue,
      potentialValue: values.potential,
    })).sort((a, b) => b.leads - a.leads);

    const distribution = {};
    for (const item of content) distribution[item.channel || 'Outros'] = (distribution[item.channel || 'Outros'] || 0) + 1;
    const published = content.filter(item => item.status === 'published').length;

    const timelineMap = {};
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      timelineMap[key] = { date: key, leads: 0, customers: 0, revenue: 0 };
    }
    for (const lead of currentLeads) {
      const key = new Date(lead.created_at).toISOString().slice(0, 10);
      if (timelineMap[key]) timelineMap[key].leads++;
    }
    for (const lead of converted) {
      const key = new Date(lead.converted_at).toISOString().slice(0, 10);
      if (timelineMap[key]) {
        timelineMap[key].customers++;
        timelineMap[key].revenue += numeric(lead.actual_value);
      }
    }

    res.json({
      period,
      startDate: start,
      endDate: end,
      overview: {
        totalLeads,
        totalCustomers,
        conversionRate,
        attributedRevenue,
        potentialPipelineValue,
        totalInvestment,
        cpl: totalLeads && totalInvestment ? totalInvestment / totalLeads : null,
        cac: totalCustomers && totalInvestment ? totalInvestment / totalCustomers : null,
        roas: totalInvestment ? attributedRevenue / totalInvestment : null,
        changes: {
          leads: change(totalLeads, previousLeads.length),
          customers: change(totalCustomers, previousConverted.length),
          conversionRate: change(conversionRate, previousConversionRate),
          revenue: change(attributedRevenue, revenueOf(previousConverted)),
        },
      },
      pipeline: { stages, avgConversionTimeDays: conversionDates ? conversionDays / conversionDates : null },
      lostReasons,
      campaigns,
      channels,
      contentExecution: {
        planned: content.length,
        published,
        percentage: content.length ? (published / content.length) * 100 : 0,
        distribution,
      },
      timeline: Object.values(timelineMap),
    });
  } catch (e) {
    console.error('[analytics-overview]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao carregar Analytics.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/analytics/export', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const leads = (await pool.query('SELECT * FROM leads WHERE business_id=$1 ORDER BY created_at DESC', [authorized.business.id])).rows;
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = leads.map(lead => [
      lead.id, lead.name, lead.company_name, lead.email, lead.phone, lead.status, lead.source,
      lead.potential_value, lead.actual_value, lead.created_at?.toISOString?.() || lead.created_at,
      lead.converted_at?.toISOString?.() || lead.converted_at,
    ].map(csvCell).join(','));
    const header = 'ID,Nome,Empresa,Email,Telefone,Status,Origem,Valor Potencial,Valor Real,Data Criação,Data Conversão';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
    res.send('\uFEFF' + [header, ...rows].join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/analytics/insights', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const counts = (await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='customer')::int AS customers,
              COUNT(*) FILTER (WHERE status='proposal')::int AS proposals
       FROM leads WHERE business_id=$1`,
      [authorized.business.id]
    )).rows[0];
    const observation = counts.total
      ? `Há ${counts.total} leads, ${counts.proposals} propostas e ${counts.customers} clientes registrados.`
      : 'Ainda não há leads suficientes para gerar uma análise detalhada.';
    res.json({ insights: [{
      title: counts.total ? 'Panorama comercial' : 'Comece pela base de dados',
      observation,
      recommended_action: counts.total ? 'Revise as propostas abertas e mantenha os próximos contatos atualizados.' : 'Cadastre ou importe leads para acompanhar conversão e desempenho.',
      confidence: 'high',
    }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/analytics/summary', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json({});
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json({});
    const totalLeads = (await pool.query('SELECT COUNT(*) as count FROM leads WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const totalCampaigns = (await pool.query('SELECT COUNT(*) as count FROM campaigns WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const totalContent = (await pool.query('SELECT COUNT(*) as count FROM content_items WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const conversions = (await pool.query("SELECT COUNT(*) as count FROM leads WHERE business_id=$1 AND status='customer'", [biz.id])).rows[0]?.count || 0;
    res.json({ totalLeads: +totalLeads, totalCampaigns: +totalCampaigns, totalContent: +totalContent, conversions: +conversions });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada: ' + req.method + ' ' + req.url });
});

module.exports = app;
