import * as crypto from 'node:crypto';
import { createPool } from '../../../db/index';

type WebhookHeaders = { id: string; timestamp: string; signature: string };

export class ResendWebhookConfigurationError extends Error {}
export class ResendWebhookSignatureError extends Error {}

function secretBytes(secret: string) {
  const encoded = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length) throw new ResendWebhookConfigurationError('RESEND_WEBHOOK_SECRET inválido.');
  return bytes;
}

export function verifyResendWebhook(rawBody: string, headers: WebhookHeaders, secretValue = process.env.RESEND_WEBHOOK_SECRET || '') {
  const secret = String(secretValue).trim();
  if (!secret) throw new ResendWebhookConfigurationError('RESEND_WEBHOOK_SECRET não configurado.');
  if (!headers.id || !headers.timestamp || !headers.signature) throw new ResendWebhookSignatureError('Cabeçalhos de assinatura ausentes.');
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw new ResendWebhookSignatureError('Assinatura expirada.');
  }
  const expected = crypto.createHmac('sha256', secretBytes(secret))
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest();
  const signatures = headers.signature.split(/\s+/).map(value => value.split(',', 2)).filter(([version]) => version === 'v1');
  const valid = signatures.some(([, encoded]) => {
    try {
      const received = Buffer.from(encoded || '', 'base64');
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    } catch { return false; }
  });
  if (!valid) throw new ResendWebhookSignatureError('Assinatura inválida.');
  try { return JSON.parse(rawBody); }
  catch { throw new ResendWebhookSignatureError('Payload JSON inválido.'); }
}

const EVENT_TYPES: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

function safePayload(payload: any) {
  return {
    type: payload.type,
    created_at: payload.created_at,
    data: {
      email_id: payload.data?.email_id,
      to: Array.isArray(payload.data?.to) ? payload.data.to.slice(0, 5) : [],
      subject: payload.data?.subject,
      bounce: payload.data?.bounce,
      click: payload.data?.click ? { link: payload.data.click.link, timestamp: payload.data.click.timestamp } : undefined,
    },
  };
}

export async function processResendWebhook(rawBody: string, headers: WebhookHeaders) {
  const payload = verifyResendWebhook(rawBody, headers);
  const eventType = EVENT_TYPES[String(payload?.type || '')];
  if (!eventType) return { accepted: true, ignored: true, reason: 'unsupported_event' };
  const providerMessageId = String(payload?.data?.email_id || '').trim();
  if (!providerMessageId) return { accepted: true, ignored: true, reason: 'missing_email_id' };
  const occurredAt = new Date(payload.created_at || Date.now());
  if (Number.isNaN(occurredAt.getTime())) throw new ResendWebhookSignatureError('Data do evento inválida.');

  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipient = (await client.query(
      'SELECT * FROM email_campaign_recipients WHERE provider_message_id=$1 FOR UPDATE',
      [providerMessageId]
    )).rows[0];
    if (!recipient) {
      await client.query('COMMIT');
      return { accepted: true, ignored: true, reason: 'recipient_not_found' };
    }
    const inserted = (await client.query(
      `INSERT INTO email_campaign_events
        (organization_id,business_id,campaign_id,recipient_id,provider,provider_event_id,event_type,payload,occurred_at)
       VALUES ($1,$2,$3,$4,'resend',$5,$6,$7::jsonb,$8)
       ON CONFLICT (provider,provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, headers.id, eventType, JSON.stringify(safePayload(payload)), occurredAt]
    )).rows[0];
    if (!inserted) {
      await client.query('COMMIT');
      return { accepted: true, duplicate: true };
    }

    const statusSql: Record<string, string> = {
      sent: "CASE WHEN status IN ('queued','processing') THEN 'sent' ELSE status END",
      delivered: "CASE WHEN status IN ('queued','processing','sent') THEN 'delivered' ELSE status END",
      opened: "CASE WHEN status IN ('bounced','complained','suppressed','unsubscribed','cancelled') THEN status ELSE 'opened' END",
      clicked: "CASE WHEN status IN ('bounced','complained','suppressed','unsubscribed','cancelled') THEN status ELSE 'clicked' END",
      failed: "CASE WHEN status IN ('queued','processing','sent') THEN 'failed' ELSE status END",
      bounced: "'bounced'",
      complained: "'complained'",
      suppressed: "'suppressed'",
    };
    const timestampColumn: Record<string, string | undefined> = {
      sent: 'sent_at', delivered: 'delivered_at', opened: 'opened_at', clicked: 'clicked_at',
      bounced: 'bounced_at', complained: 'complained_at',
    };
    const timestampUpdate = timestampColumn[eventType]
      ? `, ${timestampColumn[eventType]}=CASE WHEN ${timestampColumn[eventType]} IS NULL OR ${timestampColumn[eventType]}>$2 THEN $2 ELSE ${timestampColumn[eventType]} END`
      : '';
    await client.query(
      `UPDATE email_campaign_recipients SET status=${statusSql[eventType]}${timestampUpdate}, updated_at=NOW() WHERE id=$1`,
      [recipient.id, occurredAt]
    );

    if (['bounced', 'complained', 'suppressed'].includes(eventType)) {
      const reason = eventType === 'complained' ? 'complaint' : eventType === 'bounced' ? 'bounce' : 'invalid';
      await client.query(
        `INSERT INTO email_suppressions
          (organization_id,business_id,source_campaign_id,source_recipient_id,email,normalized_email,reason,provider,provider_reference,details,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'resend',$8,$9::jsonb,true)
         ON CONFLICT (business_id,normalized_email) DO UPDATE SET
           reason=EXCLUDED.reason, provider='resend', provider_reference=EXCLUDED.provider_reference,
           details=EXCLUDED.details, active=true, suppressed_at=NOW(), updated_at=NOW()`,
        [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, recipient.email,
          recipient.normalized_email, reason, providerMessageId, JSON.stringify(safePayload(payload))]
      );
    }

    await client.query(
      `UPDATE email_campaigns c SET
         queued_count=s.queued_count, sent_count=s.sent_count, delivered_count=s.delivered_count,
         opened_count=s.opened_count, clicked_count=s.clicked_count, bounced_count=s.bounced_count,
         complained_count=s.complained_count, unsubscribed_count=s.unsubscribed_count,
         failed_count=s.failed_count, updated_at=NOW()
       FROM (
         SELECT campaign_id,
           COUNT(*) FILTER (WHERE status IN ('queued','processing'))::int queued_count,
           COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int sent_count,
           COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int delivered_count,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int opened_count,
           COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int clicked_count,
           COUNT(*) FILTER (WHERE status='bounced')::int bounced_count,
           COUNT(*) FILTER (WHERE status='complained')::int complained_count,
           COUNT(*) FILTER (WHERE status='unsubscribed')::int unsubscribed_count,
           COUNT(*) FILTER (WHERE status IN ('failed','suppressed'))::int failed_count
         FROM email_campaign_recipients WHERE campaign_id=$1 GROUP BY campaign_id
       ) s WHERE c.id=s.campaign_id`,
      [recipient.campaign_id]
    );
    await client.query('COMMIT');
    return { accepted: true, eventType, campaignId: recipient.campaign_id };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
