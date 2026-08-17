import { createPool } from '../../../db/index';
import { sendEmail } from './EmailProvider';

type DispatchInput = { campaignId: string; businessId: string; appUrl: string; maxBatchSize?: number };

function normalizedAppUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_URL inválida.');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('APP_URL deve usar HTTPS para disparos reais.');
  }
  return url.origin;
}

function appendUnsubscribe(html: string, text: string, url: string) {
  return {
    html: `${html}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px"><tr><td style="padding:20px 0 0 0;border-top:1px solid #d1d5db;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">Você recebeu este contato comercial por seu endereço profissional. <a href="${url}" style="color:#475569;text-decoration:underline">Não quero receber novos e-mails</a>.</td></tr></table></td></tr></table>`,
    text: `${text}\n\nPara não receber novos contatos comerciais, acesse: ${url}`,
  };
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function processEmailCampaignBatch(input: DispatchInput) {
  const pool = createPool();
  const appUrl = normalizedAppUrl(input.appUrl);
  const client = await pool.connect();
  let campaign: any;
  let recipients: any[] = [];
  try {
    await client.query('BEGIN');
    campaign = (await client.query(
      `SELECT c.*, d.status AS domain_status, d.domain AS sending_domain
         FROM email_campaigns c
         LEFT JOIN LATERAL (
           SELECT status, domain FROM email_sender_domains WHERE business_id=c.business_id ORDER BY created_at DESC LIMIT 1
         ) d ON true
        WHERE c.id=$1 AND c.business_id=$2 FOR UPDATE OF c`,
      [input.campaignId, input.businessId]
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
      `UPDATE email_campaign_recipients SET status='queued', updated_at=NOW()
        WHERE campaign_id=$1 AND status='processing' AND provider_message_id IS NULL
          AND last_attempt_at < NOW() - INTERVAL '15 minutes'`,
      [campaign.id]
    );
    const usage = (await client.query(
      `SELECT COUNT(*) FILTER (WHERE
                (status IN ('sent','delivered','opened','clicked') AND sent_at >= NOW() - INTERVAL '1 minute')
                OR (status='processing' AND last_attempt_at >= NOW() - INTERVAL '1 minute')
              )::int AS minute_count,
              COUNT(*) FILTER (WHERE
                (status IN ('sent','delivered','opened','clicked') AND sent_at >= date_trunc('day', NOW()))
                OR (status='processing' AND last_attempt_at >= date_trunc('day', NOW()))
              )::int AS day_count
         FROM email_campaign_recipients WHERE business_id=$1`,
      [input.businessId]
    )).rows[0];
    const minuteAvailable = Math.max(0, Number(campaign.send_rate_per_minute || 30) - Number(usage.minute_count || 0));
    const dayAvailable = Math.max(0, Number(campaign.daily_limit || 500) - Number(usage.day_count || 0));
    const claimLimit = Math.min(Number(campaign.batch_size || 10), input.maxBatchSize || Number.MAX_SAFE_INTEGER, minuteAvailable, dayAvailable);
    if (claimLimit <= 0) {
      await client.query('COMMIT');
      return {
        status: campaign.status, processed: 0, sent: 0, failed: 0, throttled: true,
        reason: dayAvailable <= 0 ? 'daily_limit' : 'minute_limit', nextAttemptMs: dayAvailable <= 0 ? 3600000 : 15000,
      };
    }
    recipients = (await client.query(
      `WITH candidates AS (
         SELECT id FROM email_campaign_recipients
          WHERE campaign_id=$1 AND status='queued' AND attempt_count < 3
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE email_campaign_recipients r SET status='processing', attempt_count=r.attempt_count+1,
              last_attempt_at=NOW(), updated_at=NOW()
         FROM candidates WHERE r.id=candidates.id RETURNING r.*`,
      [campaign.id, claimLimit]
    )).rows;
    await client.query(
      `UPDATE email_campaigns SET status='sending', started_at=COALESCE(started_at,NOW()),
              last_dispatch_at=NOW(), last_error=NULL, updated_at=NOW() WHERE id=$1`,
      [campaign.id]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }

  let sent = 0;
  let failed = 0;
  await mapWithConcurrency(recipients, 3, async recipient => {
    const unsubscribeUrl = `${appUrl}/api/prospecting/email/unsubscribe/${recipient.unsubscribe_token}`;
    const content = appendUnsubscribe(campaign.html_body, campaign.text_body, unsubscribeUrl);
    try {
      const result = await sendEmail({
        to: recipient.email,
        subject: campaign.subject,
        html: content.html,
        text: content.text,
        fromName: campaign.sender_name,
        fromAddress: campaign.sender_email,
        replyTo: campaign.reply_to_email || undefined,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        idempotencyKey: `campaign/${campaign.id}/recipient/${recipient.id}`,
      });
      sent++;
      await pool.query(
        `UPDATE email_campaign_recipients SET status='sent', provider_message_id=$1, sent_at=NOW(),
                last_error=NULL, updated_at=NOW() WHERE id=$2 AND campaign_id=$3`,
        [result.messageId, recipient.id, campaign.id]
      );
    } catch (error: any) {
      failed++;
      const nextStatus = Number(recipient.attempt_count || 1) >= 3 ? 'failed' : 'queued';
      await pool.query(
        `UPDATE email_campaign_recipients SET status=$1, last_error=$2, updated_at=NOW()
          WHERE id=$3 AND campaign_id=$4 AND status='processing'`,
        [nextStatus, String(error?.message || 'Falha no provedor').slice(0, 1000), recipient.id, campaign.id]
      );
    }
  });

  const summary = (await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='queued')::int AS queued,
            COUNT(*) FILTER (WHERE status='processing')::int AS processing,
            COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
            COUNT(*) FILTER (WHERE status IN ('failed','suppressed'))::int AS failed
       FROM email_campaign_recipients WHERE campaign_id=$1`,
    [campaign.id]
  )).rows[0];
  const completed = Number(summary.queued || 0) === 0 && Number(summary.processing || 0) === 0;
  const status = completed ? 'completed' : 'sending';
  await pool.query(
    `UPDATE email_campaigns SET status=$1, queued_count=$2, sent_count=$3, failed_count=$4,
            completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END,
            updated_at=NOW() WHERE id=$5 AND status NOT IN ('paused','cancelled')`,
    [status, Number(summary.queued || 0), Number(summary.sent || 0), Number(summary.failed || 0), campaign.id]
  );
  return {
    status, processed: recipients.length, sent, failed, throttled: false,
    remaining: Number(summary.queued || 0), totalSent: Number(summary.sent || 0), totalFailed: Number(summary.failed || 0),
    nextAttemptMs: completed ? null : Math.max(2000, Math.ceil(60000 * recipients.length / Number(campaign.send_rate_per_minute || 30))),
  };
}
