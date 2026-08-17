import * as crypto from 'node:crypto';
import { createPool } from '../../../db/index';
import { processEmailCampaignBatch } from './EmailCampaignDispatchService';

export class EmailWorkerConfigurationError extends Error {}
export class EmailWorkerAuthorizationError extends Error {}

export function verifyEmailWorkerAuthorization(authorization: unknown, secretValue = process.env.CRON_SECRET || '') {
  const secret = String(secretValue).trim();
  if (secret.length < 16) throw new EmailWorkerConfigurationError('CRON_SECRET deve ter pelo menos 16 caracteres.');
  const provided = String(authorization || '').replace(/^Bearer\s+/i, '');
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  if (providedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(providedBytes, expectedBytes)) {
    throw new EmailWorkerAuthorizationError('Worker não autorizado.');
  }
}

export async function runEmailDispatchWorker(appUrl: string) {
  const pool = createPool();
  const lockClient = await pool.connect();
  let locked = false;
  try {
    locked = Boolean((await lockClient.query("SELECT pg_try_advisory_lock(hashtext('marketing_os_email_dispatch_worker')) AS locked")).rows[0]?.locked);
    if (!locked) return { status: 'already_running', campaignsProcessed: 0, recipientsProcessed: 0, sent: 0, failed: 0 };
    await lockClient.query(
      `INSERT INTO email_dispatch_worker_state (id,status,last_started_at,last_error,updated_at)
       VALUES ('main','running',NOW(),NULL,NOW())
       ON CONFLICT (id) DO UPDATE SET status='running',last_started_at=NOW(),last_error=NULL,updated_at=NOW()`
    );
    const campaigns = (await lockClient.query(
      `SELECT id,business_id FROM email_campaigns
       WHERE status IN ('queued','sending') OR (status='scheduled' AND scheduled_at<=NOW())
       ORDER BY COALESCE(last_dispatch_at,scheduled_at,created_at) ASC LIMIT 3`
    )).rows;
    const totals = { campaignsProcessed: 0, recipientsProcessed: 0, sent: 0, failed: 0 };
    const errors: string[] = [];
    for (const campaign of campaigns) {
      try {
        const result = await processEmailCampaignBatch({
          campaignId: campaign.id,
          businessId: campaign.business_id,
          appUrl,
          maxBatchSize: 4,
        });
        totals.campaignsProcessed++;
        totals.recipientsProcessed += Number(result.processed || 0);
        totals.sent += Number(result.sent || 0);
        totals.failed += Number(result.failed || 0);
      } catch (error: any) {
        const message = String(error?.message || 'Falha ao processar campanha').slice(0, 500);
        errors.push(`${campaign.id}: ${message}`);
        await lockClient.query('UPDATE email_campaigns SET last_error=$1,updated_at=NOW() WHERE id=$2', [message, campaign.id]);
      }
    }
    const status = errors.length ? 'partial_failure' : 'completed';
    await lockClient.query(
      `UPDATE email_dispatch_worker_state SET status=$1,last_completed_at=NOW(),last_error=$2,
       campaigns_processed=$3,recipients_processed=$4,sent_count=$5,failed_count=$6,updated_at=NOW() WHERE id='main'`,
      [status, errors.join(' | ') || null, totals.campaignsProcessed, totals.recipientsProcessed, totals.sent, totals.failed]
    );
    return { status, ...totals, errors: errors.length };
  } catch (error: any) {
    if (locked) await lockClient.query(
      `UPDATE email_dispatch_worker_state SET status='failed',last_completed_at=NOW(),last_error=$1,updated_at=NOW() WHERE id='main'`,
      [String(error?.message || 'Falha no worker').slice(0, 1000)]
    ).catch(() => {});
    throw error;
  } finally {
    if (locked) await lockClient.query("SELECT pg_advisory_unlock(hashtext('marketing_os_email_dispatch_worker'))").catch(() => {});
    lockClient.release();
  }
}
