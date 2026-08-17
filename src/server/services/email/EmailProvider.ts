export interface EmailProviderStatus {
  provider: 'resend';
  apiConfigured: boolean;
  webhookConfigured: boolean;
  configured: boolean;
  missingVariables: string[];
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  sendingDomain: string | null;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  idempotencyKey: string;
}

export interface SendEmailResult {
  provider: 'resend';
  messageId: string;
}

export type ResendRegion = 'us-east-1' | 'eu-west-1' | 'sa-east-1' | 'ap-northeast-1';

export interface SendingDomainDnsRecord {
  record: string;
  name: string;
  type: string;
  ttl?: string;
  status: string;
  value: string;
  priority?: number;
}

export interface SendingDomainResult {
  provider: 'resend';
  providerDomainId: string;
  domain: string;
  region: ResendRegion;
  status: string;
  records: SendingDomainDnsRecord[];
  spfStatus: string;
  dkimStatus: string;
}

export interface DmarcCheckResult {
  status: 'missing' | 'verified' | 'invalid' | 'lookup_failed';
  record: string | null;
  checkedHost: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESEND_API_URL = 'https://api.resend.com';
const RESEND_REGIONS = new Set<ResendRegion>(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']);

function env(name: string) {
  return String(process.env[name] || '').trim();
}

export function getEmailProviderStatus(): EmailProviderStatus {
  const apiKey = env('RESEND_API_KEY');
  const fromAddress = env('EMAIL_FROM_ADDRESS');
  const fromName = env('EMAIL_FROM_NAME');
  const replyTo = env('EMAIL_REPLY_TO');
  const missingVariables: string[] = [];
  if (!apiKey) missingVariables.push('RESEND_API_KEY');
  if (!fromAddress || !EMAIL_PATTERN.test(fromAddress)) missingVariables.push('EMAIL_FROM_ADDRESS');
  if (!fromName) missingVariables.push('EMAIL_FROM_NAME');
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) missingVariables.push('EMAIL_REPLY_TO');

  return {
    provider: 'resend',
    apiConfigured: Boolean(apiKey),
    webhookConfigured: Boolean(env('RESEND_WEBHOOK_SECRET')),
    configured: missingVariables.length === 0,
    missingVariables,
    fromName: fromName || null,
    fromAddress: fromAddress || null,
    replyTo: replyTo || null,
    sendingDomain: fromAddress.includes('@') ? fromAddress.split('@')[1].toLowerCase() : null,
  };
}

export class EmailProviderConfigurationError extends Error {
  constructor(public missingVariables: string[]) {
    super(`Configuração de e-mail incompleta: ${missingVariables.join(', ')}`);
    this.name = 'EmailProviderConfigurationError';
  }
}

export class EmailDomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDomainValidationError';
  }
}

export function normalizeSendingDomain(value: unknown) {
  const domain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!DOMAIN_PATTERN.test(domain)) {
    throw new EmailDomainValidationError('Informe um domínio válido, sem http, caminho ou e-mail. Exemplo: mail.suaempresa.com.br.');
  }
  return domain;
}

function requireResendApiKey() {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) throw new EmailProviderConfigurationError(['RESEND_API_KEY']);
  return apiKey;
}

async function resendRequest(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${RESEND_API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${requireResendApiKey()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MarketingOS/1.0',
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error?.message || `Resend respondeu com status ${response.status}.`);
    }
    return payload;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Tempo limite excedido ao conectar com o Resend.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeRecordStatus(records: SendingDomainDnsRecord[], kind: 'SPF' | 'DKIM') {
  const statuses = records
    .filter(record => String(record.record || '').toUpperCase() === kind)
    .map(record => String(record.status || 'not_started'));
  if (!statuses.length) return 'not_started';
  if (statuses.every(status => status === 'verified')) return 'verified';
  if (statuses.some(status => ['failed', 'temporary_failure'].includes(status))) return 'failed';
  if (statuses.some(status => status === 'verified')) return 'partially_verified';
  if (statuses.some(status => status === 'pending')) return 'pending';
  return statuses[0];
}

function mapDomain(payload: any): SendingDomainResult {
  const records = Array.isArray(payload?.records) ? payload.records : [];
  return {
    provider: 'resend',
    providerDomainId: String(payload?.id || ''),
    domain: normalizeSendingDomain(payload?.name),
    region: RESEND_REGIONS.has(payload?.region) ? payload.region : 'sa-east-1',
    status: String(payload?.status || 'not_started'),
    records,
    spfStatus: summarizeRecordStatus(records, 'SPF'),
    dkimStatus: summarizeRecordStatus(records, 'DKIM'),
  };
}

export async function createSendingDomain(domainValue: unknown, regionValue: unknown = 'sa-east-1') {
  const domain = normalizeSendingDomain(domainValue);
  const region = String(regionValue || 'sa-east-1') as ResendRegion;
  if (!RESEND_REGIONS.has(region)) throw new EmailDomainValidationError('Região de envio inválida.');
  const payload = await resendRequest('/domains', {
    method: 'POST',
    body: JSON.stringify({ name: domain, region, capabilities: { sending: 'enabled', receiving: 'disabled' } }),
  });
  return mapDomain(payload);
}

export async function findSendingDomain(domainValue: unknown) {
  const domain = normalizeSendingDomain(domainValue);
  let after = '';

  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ limit: '100' });
    if (after) query.set('after', after);
    const payload = await resendRequest(`/domains?${query.toString()}`);
    const domains = Array.isArray(payload?.data) ? payload.data : [];
    const match = domains.find((item: any) => String(item?.name || '').trim().toLowerCase() === domain);
    if (match?.id) return getSendingDomain(String(match.id));
    if (!payload?.has_more || !domains.length) return null;
    after = String(domains.at(-1)?.id || '');
    if (!after) return null;
  }

  throw new Error('A listagem de domínios da Resend excedeu o limite de segurança.');
}

export async function createOrAdoptSendingDomain(domainValue: unknown, regionValue: unknown = 'sa-east-1') {
  const existing = await findSendingDomain(domainValue);
  if (existing) return { ...existing, adopted: true };

  try {
    return { ...(await createSendingDomain(domainValue, regionValue)), adopted: false };
  } catch (error) {
    // Covers a manual/concurrent creation between the list and create requests.
    const concurrentlyCreated = await findSendingDomain(domainValue);
    if (concurrentlyCreated) return { ...concurrentlyCreated, adopted: true };
    throw error;
  }
}

export async function getSendingDomain(providerDomainId: string) {
  if (!providerDomainId?.trim()) throw new Error('Identificador do domínio no provedor não informado.');
  return mapDomain(await resendRequest(`/domains/${encodeURIComponent(providerDomainId)}`));
}

export async function verifySendingDomain(providerDomainId: string) {
  if (!providerDomainId?.trim()) throw new Error('Identificador do domínio no provedor não informado.');
  await resendRequest(`/domains/${encodeURIComponent(providerDomainId)}/verify`, { method: 'POST' });
  return getSendingDomain(providerDomainId);
}

export async function checkDmarc(domainValue: unknown): Promise<DmarcCheckResult> {
  const domain = normalizeSendingDomain(domainValue);
  const labels = domain.split('.');
  const commonSecondLevel = new Set(['com', 'net', 'org', 'co', 'gov', 'edu', 'agr']);
  const rootLabelCount = labels.at(-1)?.length === 2 && commonSecondLevel.has(labels.at(-2) || '') ? 3 : 2;
  const organizationalDomain = labels.length > rootLabelCount ? labels.slice(-rootLabelCount).join('.') : domain;
  const candidates = [...new Set([domain, organizationalDomain])];
  const { resolveTxt } = await import('node:dns/promises');
  let lastLookupError = false;
  for (const candidate of candidates) {
    const checkedHost = `_dmarc.${candidate}`;
    try {
      const answers = await resolveTxt(checkedHost);
      const records = answers.map(parts => parts.join('')).filter(Boolean);
      const dmarc = records.find(record => /^v=DMARC1\s*;/i.test(record));
      if (dmarc) return { status: 'verified', record: dmarc, checkedHost };
      if (records.length) return { status: 'invalid', record: records.join(' | '), checkedHost };
    } catch (error: any) {
      if (!['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(error?.code)) lastLookupError = true;
    }
  }
  return {
    status: lastLookupError ? 'lookup_failed' : 'missing',
    record: null,
    checkedHost: `_dmarc.${organizationalDomain}`,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const status = getEmailProviderStatus();
  const fromAddress = String(input.fromAddress || status.fromAddress || '').trim().toLowerCase();
  const fromName = String(input.fromName || status.fromName || '').trim();
  const replyTo = String(input.replyTo || status.replyTo || '').trim().toLowerCase();
  const missingVariables: string[] = [];
  if (!status.apiConfigured) missingVariables.push('RESEND_API_KEY');
  if (!EMAIL_PATTERN.test(fromAddress)) missingVariables.push('EMAIL_FROM_ADDRESS');
  if (!fromName) missingVariables.push('EMAIL_FROM_NAME');
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) missingVariables.push('EMAIL_REPLY_TO');
  if (missingVariables.length) throw new EmailProviderConfigurationError(missingVariables);
  if (!EMAIL_PATTERN.test(input.to)) throw new Error('Destinatário de teste inválido.');
  if (!input.subject.trim() || !input.text.trim() || !input.html.trim()) throw new Error('Assunto e conteúdo do e-mail são obrigatórios.');
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 256) throw new Error('Chave de idempotência inválida.');
  if (/\r|\n/.test(fromName) || /\r|\n/.test(input.subject)) throw new Error('Cabeçalho de e-mail inválido.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MarketingOS/1.0',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [input.to.toLowerCase()],
        subject: input.subject.trim(),
        html: input.html,
        text: input.text,
        reply_to: replyTo || undefined,
        headers: input.headers || undefined,
      }),
      signal: controller.signal,
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.id) {
      const message = payload?.message || payload?.error?.message || `Resend respondeu com status ${response.status}.`;
      throw new Error(message);
    }
    return { provider: 'resend', messageId: String(payload.id) };
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Tempo limite excedido ao conectar com o Resend.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
