import { Router } from "express";
import { db, createPool } from "../../db/index";
import { 
  prospectingSearches, 
  prospects, 
  prospectContacts, 
  businesses, 
  users,
  emailSenderDomains,
  emailCampaigns,
  emailCampaignRecipients,
} from "../../db/schema";
import { eq, and, ilike, or, desc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { ProspectingService } from "../services/ProspectingService";
import { qualifyProspect, generateApproach } from "../services/ProspectScoringService";
import { ensureProspectingImportSchema, importProspectSpreadsheetRows } from "../services/ProspectSpreadsheetImportService";
import {
  getEmailProviderStatus,
  sendEmail,
  EmailProviderConfigurationError,
  EmailDomainValidationError,
  createOrAdoptSendingDomain,
  getSendingDomain,
  verifySendingDomain,
  checkDmarc,
  normalizeSendingDomain,
} from "../services/email/EmailProvider";
import { randomUUID } from "crypto";
import { processEmailCampaignBatch } from "../services/email/EmailCampaignDispatchService";
import {
  processResendWebhook,
  ResendWebhookConfigurationError,
  ResendWebhookSignatureError,
} from "../services/email/ResendWebhookService";
import {
  runEmailDispatchWorker,
  verifyEmailWorkerAuthorization,
  EmailWorkerAuthorizationError,
  EmailWorkerConfigurationError,
} from "../services/email/EmailDispatchWorkerService";

export const prospectingRouter = Router();

// Ensure user belongs to organization owning the business
const ensureBusinessOwnership = async (req: any, res: any, next: any) => {
  const businessId = req.query.businessId || req.body.businessId;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId parameter" });

  const dbUser = await db.query.users.findFirst({
    where: eq(users.uid, user.uid)
  });

  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId as string),
    with: { organization: { with: { members: true } } }
  });

  if (!business) return res.status(404).json({ error: "Business not found" });

  const isMember = business.organization.members.some(m => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });

  req.dbUser = dbUser;
  req.business = business;
  next();
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

type EmailAudienceFilters = {
  origin: 'all' | 'search' | 'spreadsheet';
  status: 'all' | 'new' | 'reviewed' | 'qualified' | 'imported';
  fit: 'all' | 'high' | 'medium' | 'low';
  state: string;
  segment: string;
};

const parseEmailAudienceFilters = (input: any): EmailAudienceFilters => {
  const origin = ['search', 'spreadsheet'].includes(input?.origin) ? input.origin : 'all';
  const status = ['new', 'reviewed', 'qualified', 'imported'].includes(input?.status) ? input.status : 'all';
  const fit = ['high', 'medium', 'low'].includes(input?.fit) ? input.fit : 'all';
  return {
    origin,
    status,
    fit,
    state: String(input?.state || '').trim().toUpperCase().slice(0, 2),
    segment: String(input?.segment || '').trim().slice(0, 160),
  };
};

const emailAudienceWhere = (businessId: string, filters: EmailAudienceFilters) => {
  const conditions = [
    sql`p.business_id = ${businessId}`,
    sql`p.email IS NOT NULL`,
    sql`BTRIM(p.email) <> ''`,
    sql`COALESCE(p.status, 'new') <> 'disqualified'`,
  ];
  if (filters.origin === 'spreadsheet') conditions.push(sql`p.source_type = 'spreadsheet'`);
  if (filters.origin === 'search') conditions.push(sql`COALESCE(p.source_type, 'search') = 'search'`);
  if (filters.status !== 'all') conditions.push(sql`p.status = ${filters.status}`);
  if (filters.fit !== 'all') conditions.push(sql`p.qualification_fit = ${filters.fit}`);
  if (filters.state) conditions.push(sql`UPPER(COALESCE(p.state, '')) = ${filters.state}`);
  if (filters.segment) conditions.push(sql`p.segment ILIKE ${`%${filters.segment}%`}`);
  return sql.join(conditions, sql` AND `);
};

const getEmailAudiencePreview = async (executor: any, businessId: string, filters: EmailAudienceFilters) => {
  const where = emailAudienceWhere(businessId, filters);
  const result: any = await executor.execute(sql`
    WITH scoped AS (
      SELECT LOWER(BTRIM(p.email)) AS normalized_email,
             (BTRIM(p.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$') AS valid
        FROM prospects p
       WHERE ${where}
    ), valid_unique AS (
      SELECT DISTINCT normalized_email FROM scoped WHERE valid
    ), classified AS (
      SELECT v.normalized_email,
             EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.business_id = ${businessId} AND u.normalized_email = v.normalized_email)
             OR EXISTS (SELECT 1 FROM email_suppressions s WHERE s.business_id = ${businessId} AND s.normalized_email = v.normalized_email AND s.active = true) AS blocked
        FROM valid_unique v
    )
    SELECT
      (SELECT COUNT(*)::int FROM scoped) AS total_with_email,
      (SELECT COUNT(*)::int FROM scoped WHERE NOT valid) AS invalid_count,
      ((SELECT COUNT(*) FROM scoped WHERE valid) - (SELECT COUNT(*) FROM valid_unique))::int AS duplicate_count,
      (SELECT COUNT(*)::int FROM classified WHERE blocked) AS suppressed_count,
      (SELECT COUNT(*)::int FROM classified WHERE NOT blocked) AS eligible_count
  `);
  const row = result.rows?.[0] || result[0] || {};
  return {
    totalWithEmail: Number(row.total_with_email || 0),
    invalidCount: Number(row.invalid_count || 0),
    duplicateCount: Number(row.duplicate_count || 0),
    suppressedCount: Number(row.suppressed_count || 0),
    eligibleCount: Number(row.eligible_count || 0),
  };
};

type EmailVisualStyle = 'simple' | 'institutional' | 'cta';

const buildEmailHtml = (textBody: string, visualStyle: EmailVisualStyle, ctaText: string, ctaUrl: string) => {
  const paragraphs = textBody
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(paragraph => `<p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1f2937">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const accent = visualStyle === 'simple' ? '' : `<tr><td height="4" bgcolor="#4f46e5" style="height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>`;
  const cta = visualStyle === 'cta' ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#4f46e5" style="border-radius:4px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:18px;color:#ffffff;text-decoration:none">${escapeHtml(ctaText)}</a></td></tr></table><div style="height:22px;line-height:22px;font-size:0">&nbsp;</div>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">${accent}<tr><td style="padding:${visualStyle === 'simple' ? '0' : '24px 0 0 0'};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1f2937">${paragraphs}${cta}</td></tr></table></td></tr></table>`;
};

prospectingRouter.get('/email/provider-status', requireAuth, ensureBusinessOwnership, async (_req: any, res) => {
  res.json(getEmailProviderStatus());
});

prospectingRouter.post('/email/send-test', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const recipient = String(req.dbUser?.email || '').trim().toLowerCase();
    if (!recipient) return res.status(400).json({ error: 'O usuário atual não possui um e-mail válido para o teste.' });
    const businessName = String(req.business?.name || 'Marketing OS');
    const result = await sendEmail({
      to: recipient,
      subject: `Teste de configuração de e-mail — ${businessName}`,
      text: `Olá! Este é um envio de teste do Marketing OS para confirmar a integração de e-mail da empresa ${businessName}. Nenhuma campanha foi iniciada.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b"><h2>Integração de e-mail configurada</h2><p>Este é um envio de teste do Marketing OS para confirmar a integração de e-mail da empresa <strong>${escapeHtml(businessName)}</strong>.</p><p>Nenhuma campanha foi iniciada e nenhum contato da base recebeu mensagens.</p></div>`,
      idempotencyKey: `provider-test/${req.business.id}/${randomUUID()}`,
    });
    res.json({ success: true, provider: result.provider, messageId: result.messageId, recipient });
  } catch (error: any) {
    if (error instanceof EmailProviderConfigurationError) {
      return res.status(503).json({ error: error.message, missingVariables: error.missingVariables });
    }
    console.error('Email provider test failed:', error);
    res.status(502).json({ error: error.message || 'Falha ao enviar e-mail de teste.' });
  }
});

prospectingRouter.get('/email/domain', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const [domain] = await db.select().from(emailSenderDomains)
      .where(eq(emailSenderDomains.businessId, req.business.id))
      .orderBy(desc(emailSenderDomains.createdAt))
      .limit(1);
    res.json({ domain: domain || null, provider: getEmailProviderStatus() });
  } catch (error: any) {
    console.error('Error loading sending domain:', error);
    res.status(500).json({ error: 'Falha ao carregar a configuração do domínio de envio.' });
  }
});

prospectingRouter.post('/email/domain', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const domainName = normalizeSendingDomain(req.body?.domain);
    const region = String(req.body?.region || 'sa-east-1');
    const [existing] = await db.select({ id: emailSenderDomains.id }).from(emailSenderDomains)
      .where(and(eq(emailSenderDomains.businessId, req.business.id), eq(emailSenderDomains.domain, domainName)))
      .limit(1);
    if (existing) return res.status(409).json({ error: 'Este domínio já está cadastrado para a empresa.' });

    const providerDomain = await createOrAdoptSendingDomain(domainName, region);
    const [providerLink] = await db.select({
      id: emailSenderDomains.id,
      businessId: emailSenderDomains.businessId,
    }).from(emailSenderDomains)
      .where(eq(emailSenderDomains.providerDomainId, providerDomain.providerDomainId))
      .limit(1);
    if (providerLink && providerLink.businessId !== req.business.id) {
      return res.status(409).json({ error: 'Este domínio da Resend já está vinculado a outra empresa.' });
    }
    const [saved] = await db.insert(emailSenderDomains).values({
      organizationId: req.business.organizationId,
      businessId: req.business.id,
      createdByUserId: req.dbUser.id,
      provider: providerDomain.provider,
      domain: providerDomain.domain,
      providerDomainId: providerDomain.providerDomainId,
      region: providerDomain.region,
      status: providerDomain.status,
      dnsRecords: providerDomain.records,
      spfStatus: providerDomain.spfStatus,
      dkimStatus: providerDomain.dkimStatus,
    }).returning();
    res.status(providerDomain.adopted ? 200 : 201).json({ domain: saved, adopted: providerDomain.adopted });
  } catch (error: any) {
    if (error instanceof EmailDomainValidationError) return res.status(400).json({ error: error.message });
    if (error instanceof EmailProviderConfigurationError) {
      return res.status(503).json({ error: error.message, missingVariables: error.missingVariables });
    }
    console.error('Error creating sending domain:', error);
    res.status(502).json({ error: error.message || 'Falha ao cadastrar o domínio de envio.' });
  }
});

prospectingRouter.post('/email/domain/verify', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const conditions = [eq(emailSenderDomains.businessId, req.business.id)];
    if (req.body?.domainId) conditions.push(eq(emailSenderDomains.id, String(req.body.domainId)));
    const [stored] = await db.select().from(emailSenderDomains)
      .where(and(...conditions))
      .orderBy(desc(emailSenderDomains.createdAt))
      .limit(1);
    if (!stored) return res.status(404).json({ error: 'Domínio de envio não cadastrado.' });

    const providerDomain = req.body?.restart === false
      ? await getSendingDomain(stored.providerDomainId)
      : await verifySendingDomain(stored.providerDomainId);
    const dmarc = await checkDmarc(stored.domain);
    const now = new Date();
    const [updated] = await db.update(emailSenderDomains).set({
      status: providerDomain.status,
      region: providerDomain.region,
      dnsRecords: providerDomain.records,
      spfStatus: providerDomain.spfStatus,
      dkimStatus: providerDomain.dkimStatus,
      dmarcStatus: dmarc.status,
      dmarcRecord: dmarc.record,
      lastCheckedAt: now,
      verifiedAt: providerDomain.status === 'verified' ? (stored.verifiedAt || now) : stored.verifiedAt,
      updatedAt: now,
    }).where(and(eq(emailSenderDomains.id, stored.id), eq(emailSenderDomains.businessId, req.business.id))).returning();
    res.json({
      domain: updated,
      dmarcCheckedHost: dmarc.checkedHost,
      dmarcRecommendation: dmarc.status === 'missing'
        ? { name: dmarc.checkedHost, type: 'TXT', value: 'v=DMARC1; p=none;' }
        : null,
    });
  } catch (error: any) {
    if (error instanceof EmailProviderConfigurationError) {
      return res.status(503).json({ error: error.message, missingVariables: error.missingVariables });
    }
    console.error('Error verifying sending domain:', error);
    res.status(502).json({ error: error.message || 'Falha ao verificar o domínio de envio.' });
  }
});

prospectingRouter.get('/email/campaigns/audience-preview', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const filters = parseEmailAudienceFilters(req.query);
    const preview = await getEmailAudiencePreview(db, req.business.id, filters);
    res.json({ filters, ...preview });
  } catch (error: any) {
    console.error('Error previewing email audience:', error);
    res.status(500).json({ error: 'Falha ao calcular a audiência elegível.' });
  }
});

prospectingRouter.get('/email/campaigns', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const campaigns = await db.select().from(emailCampaigns)
      .where(eq(emailCampaigns.businessId, req.business.id))
      .orderBy(desc(emailCampaigns.createdAt));
    res.json({ campaigns });
  } catch (error: any) {
    console.error('Error listing email campaigns:', error);
    res.status(500).json({ error: 'Falha ao carregar as campanhas de e-mail.' });
  }
});

prospectingRouter.post('/email/campaigns/generate-copy', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const objective = String(req.body?.objective || 'present_platform').slice(0, 80);
    const offer = String(req.body?.offer || '').trim().slice(0, 500);
    const senderName = String(req.body?.senderName || req.dbUser?.name || '').trim().slice(0, 120);
    const brand = String(req.business?.name || 'nossa empresa').trim();
    const objectiveLabels: Record<string, string> = {
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
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: `Crie um e-mail comercial B2B universal em português do Brasil para a empresa ${brand}.
Objetivo: ${objectiveLabel}.
Remetente: ${senderName || 'equipe comercial'}.
Oferta informada: ${offer || 'não informada'}.

Regras: seja curto, claro, ético e consultivo; não finja relacionamento prévio; não invente fatos, preços, clientes, resultados ou garantias; não use nome da empresa destinatária nem campos variáveis; use saudação universal; inclua uma chamada para conversa sem pressão. Retorne somente JSON válido com subject, previewText e textBody.`,
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
  } catch (error: any) {
    console.error('Error generating universal email copy:', error);
    res.status(500).json({ error: error.message || 'Falha ao gerar a abordagem universal.' });
  }
});

prospectingRouter.post('/email/campaigns', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
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
    const filters = parseEmailAudienceFilters(req.body?.audienceFilters || {});
    const testRecipientEmail = String(req.body?.testRecipientEmail || '').trim().toLowerCase().slice(0, 250);
    const emailStyle: EmailVisualStyle = ['institutional', 'cta'].includes(String(req.body?.emailStyle)) ? String(req.body.emailStyle) as EmailVisualStyle : 'simple';
    const ctaText = String(req.body?.ctaText || '').trim().slice(0, 80);
    const ctaUrl = String(req.body?.ctaUrl || '').trim().slice(0, 2000);
    if (!name || !subject || textBody.length < 40 || !senderName) {
      return res.status(400).json({ error: 'Nome, remetente, assunto e uma mensagem com pelo menos 40 caracteres são obrigatórios.' });
    }
    if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(senderLocalPart)) {
      return res.status(400).json({ error: 'O endereço do remetente antes do @ é inválido.' });
    }
    if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
      return res.status(400).json({ error: 'O e-mail de resposta é inválido.' });
    }
    if (testRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipientEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail de teste válido.' });
    }
    if (emailStyle === 'cta' && (!ctaText || !/^https:\/\/[^\s]+$/i.test(ctaUrl))) {
      return res.status(400).json({ error: 'Para usar botão, informe o texto e uma URL HTTPS válida.' });
    }
    if (!['legitimate_interest', 'consent'].includes(legalBasis) || processingPurpose.length < 15) {
      return res.status(400).json({ error: 'Informe a base legal e a finalidade do tratamento dos contatos.' });
    }
    if (legalBasis === 'legitimate_interest' && balanceTestReference.length < 20) {
      return res.status(400).json({ error: 'Registre o teste de balanceamento do legítimo interesse antes de salvar.' });
    }
    if (req.body?.includeUnsubscribe !== true) {
      return res.status(400).json({ error: 'O descadastramento é obrigatório em campanhas de prospecção.' });
    }

    const [sendingDomain] = await db.select().from(emailSenderDomains)
      .where(eq(emailSenderDomains.businessId, req.business.id))
      .orderBy(desc(emailSenderDomains.createdAt)).limit(1);
    if (!sendingDomain) return res.status(409).json({ error: 'Cadastre o domínio de envio antes de criar a campanha.' });
    const senderEmail = `${senderLocalPart}@${sendingDomain.domain}`;
    const where = emailAudienceWhere(req.business.id, filters);

    const campaign = await db.transaction(async tx => {
      const [created] = await tx.insert(emailCampaigns).values({
        organizationId: req.business.organizationId,
        businessId: req.business.id,
        createdByUserId: req.dbUser.id,
        name,
        status: 'draft',
        subject,
        previewText: previewText || null,
        htmlBody: buildEmailHtml(textBody, emailStyle, ctaText, ctaUrl),
        textBody,
        senderName,
        senderEmail,
        replyToEmail: replyToEmail || null,
        audienceFilters: testRecipientEmail ? { ...filters, mode: 'test', testRecipientEmail } : filters,
        templateVariables: { emailStyle, ctaText: ctaText || null, ctaUrl: ctaUrl || null },
        legalBasis,
        processingPurpose,
        balanceTestReference: balanceTestReference || null,
        includeUnsubscribe: true,
        provider: 'resend',
      }).returning();

      if (testRecipientEmail) {
        await tx.insert(emailCampaignRecipients).values({
          organizationId: req.business.organizationId,
          businessId: req.business.id,
          campaignId: created.id,
          email: testRecipientEmail,
          normalizedEmail: testRecipientEmail,
          recipientName: 'Destinatário de teste',
          companyName: 'Teste interno',
          personalization: { companyName: 'Teste interno', testRecipient: true },
          status: 'queued',
        });
      } else {
        await tx.execute(sql`
          WITH ranked AS (
            SELECT p.id, p.company_name, p.legal_name, BTRIM(p.email) AS email,
                   LOWER(BTRIM(p.email)) AS normalized_email,
                   ROW_NUMBER() OVER (PARTITION BY LOWER(BTRIM(p.email)) ORDER BY p.qualification_score DESC NULLS LAST, p.created_at DESC) AS email_rank
              FROM prospects p
             WHERE ${where}
               AND BTRIM(p.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
          )
          INSERT INTO email_campaign_recipients
            (organization_id, business_id, campaign_id, prospect_id, email, normalized_email, recipient_name, company_name, personalization, status)
          SELECT ${req.business.organizationId}, ${req.business.id}, ${created.id}, r.id, r.email, r.normalized_email,
                 COALESCE(NULLIF(r.legal_name, ''), r.company_name), r.company_name,
                 jsonb_build_object('companyName', r.company_name), 'queued'
            FROM ranked r
           WHERE r.email_rank = 1
             AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.business_id = ${req.business.id} AND u.normalized_email = r.normalized_email)
             AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.business_id = ${req.business.id} AND s.normalized_email = r.normalized_email AND s.active = true)
          ON CONFLICT (campaign_id, normalized_email) DO NOTHING
        `);
      }
      const [count] = await tx.select({ value: sql<number>`COUNT(*)::int` }).from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, created.id));
      const [updated] = await tx.update(emailCampaigns).set({ totalRecipients: Number(count?.value || 0), updatedAt: new Date() })
        .where(eq(emailCampaigns.id, created.id)).returning();
      return updated;
    });
    res.status(201).json({ campaign });
  } catch (error: any) {
    console.error('Error creating email campaign draft:', error);
    res.status(500).json({ error: error.message || 'Falha ao salvar o rascunho da campanha.' });
  }
});

prospectingRouter.post('/email/campaigns/:campaignId/start', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    if (req.body?.confirmation !== 'INICIAR') return res.status(400).json({ error: 'Confirmação de início ausente.' });
    const [campaign] = await db.select().from(emailCampaigns).where(and(
      eq(emailCampaigns.id, req.params.campaignId), eq(emailCampaigns.businessId, req.business.id)
    )).limit(1);
    if (!campaign) return res.status(404).json({ error: 'Campanha de e-mail não encontrada.' });
    if (campaign.status !== 'draft') return res.status(409).json({ error: 'Somente campanhas em rascunho podem ser iniciadas.' });
    if (Number(req.body?.expectedRecipientCount) !== Number(campaign.totalRecipients)) {
      return res.status(409).json({ error: 'A audiência mudou. Revise a quantidade de destinatários antes de iniciar.' });
    }
    if (!campaign.totalRecipients) return res.status(409).json({ error: 'A campanha não possui destinatários elegíveis.' });
    const [domain] = await db.select().from(emailSenderDomains).where(eq(emailSenderDomains.businessId, req.business.id))
      .orderBy(desc(emailSenderDomains.createdAt)).limit(1);
    if (!domain || domain.status !== 'verified') return res.status(409).json({ error: 'Verifique SPF e DKIM do domínio antes de iniciar.' });
    if (!campaign.senderEmail.toLowerCase().endsWith(`@${domain.domain.toLowerCase()}`)) {
      return res.status(409).json({ error: 'O remetente da campanha não pertence ao domínio verificado.' });
    }
    const provider = getEmailProviderStatus();
    if (!provider.apiConfigured) return res.status(503).json({ error: 'RESEND_API_KEY não configurada.', missingVariables: ['RESEND_API_KEY'] });
    const rate = Math.min(100, Math.max(1, Number(req.body?.sendRatePerMinute || 30)));
    const dailyLimit = Math.min(10000, Math.max(1, Number(req.body?.dailyLimit || 500)));
    const batchSize = Math.min(25, Math.max(1, Number(req.body?.batchSize || 10)));
    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;
    if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 30000 || scheduledAt.getTime() > Date.now() + 366 * 86400000)) {
      return res.status(400).json({ error: 'Data de agendamento inválida.' });
    }
    const [updated] = await db.update(emailCampaigns).set({
      status: scheduledAt ? 'scheduled' : 'queued', sendRatePerMinute: rate, dailyLimit, batchSize, scheduledAt,
      queuedCount: campaign.totalRecipients,
      pausedAt: null, lastError: null, updatedAt: new Date(),
    }).where(and(eq(emailCampaigns.id, campaign.id), eq(emailCampaigns.businessId, req.business.id), eq(emailCampaigns.status, 'draft'))).returning();
    res.json({ campaign: updated });
  } catch (error: any) {
    console.error('Error starting email campaign:', error);
    res.status(500).json({ error: error.message || 'Falha ao iniciar a campanha.' });
  }
});

prospectingRouter.post('/email/campaigns/:campaignId/process', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const appUrl = String(process.env.APP_URL || '').trim();
    if (!appUrl) return res.status(503).json({ error: 'APP_URL não configurada para os links de descadastramento.' });
    const result = await processEmailCampaignBatch({ campaignId: req.params.campaignId, businessId: req.business.id, appUrl });
    res.json(result);
  } catch (error: any) {
    console.error('Error processing email campaign batch:', error);
    res.status(error instanceof EmailProviderConfigurationError ? 503 : 500).json({ error: error.message || 'Falha ao processar o lote.' });
  }
});

prospectingRouter.post('/email/campaigns/:campaignId/pause', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const [campaign] = await db.update(emailCampaigns).set({ status: 'paused', pausedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(emailCampaigns.id, req.params.campaignId), eq(emailCampaigns.businessId, req.business.id), inArray(emailCampaigns.status, ['queued', 'sending', 'scheduled'])))
    .returning();
  if (!campaign) return res.status(409).json({ error: 'A campanha não está em execução.' });
  res.json({ campaign });
});

prospectingRouter.post('/email/campaigns/:campaignId/resume', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  if (req.body?.confirmation !== 'RETOMAR') return res.status(400).json({ error: 'Confirmação de retomada ausente.' });
  const [pausedCampaign] = await db.select().from(emailCampaigns).where(and(
    eq(emailCampaigns.id, req.params.campaignId),
    eq(emailCampaigns.businessId, req.business.id),
    eq(emailCampaigns.status, 'paused')
  )).limit(1);
  if (!pausedCampaign) return res.status(409).json({ error: 'A campanha não está pausada.' });
  const resumeStatus = pausedCampaign.scheduledAt && pausedCampaign.scheduledAt.getTime() > Date.now() ? 'scheduled' : 'queued';
  const [campaign] = await db.update(emailCampaigns).set({ status: resumeStatus, pausedAt: null, updatedAt: new Date() })
    .where(and(eq(emailCampaigns.id, req.params.campaignId), eq(emailCampaigns.businessId, req.business.id), eq(emailCampaigns.status, 'paused')))
    .returning();
  if (!campaign) return res.status(409).json({ error: 'A campanha não está pausada.' });
  res.json({ campaign });
});

prospectingRouter.post('/email/campaigns/:campaignId/cancel', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  if (req.body?.confirmation !== 'CANCELAR') return res.status(400).json({ error: 'Confirmação de cancelamento ausente.' });
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const campaign = (await client.query(
      `UPDATE email_campaigns SET status='cancelled',queued_count=0,cancelled_at=NOW(),updated_at=NOW()
        WHERE id=$1 AND business_id=$2 AND status IN ('draft','queued','sending','paused','scheduled') RETURNING *`,
      [req.params.campaignId, req.business.id]
    )).rows[0];
    if (!campaign) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'A campanha não pode ser cancelada.' }); }
    await client.query(
      `UPDATE email_campaign_recipients SET status='cancelled',updated_at=NOW()
        WHERE campaign_id=$1 AND status IN ('queued','processing')`, [campaign.id]
    );
    await client.query('COMMIT');
    res.json({ campaign });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message || 'Falha ao cancelar a campanha.' });
  } finally { client.release(); }
});

prospectingRouter.post('/email/webhooks/resend', async (req: any, res) => {
  try {
    const result = await processResendWebhook(String(req.rawBody || ''), {
      id: String(req.get('svix-id') || ''),
      timestamp: String(req.get('svix-timestamp') || ''),
      signature: String(req.get('svix-signature') || ''),
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof ResendWebhookConfigurationError) return res.status(503).json({ error: error.message });
    if (error instanceof ResendWebhookSignatureError) return res.status(400).json({ error: error.message });
    console.error('Error processing Resend webhook:', error);
    return res.status(500).json({ error: 'Falha ao processar o evento de e-mail.' });
  }
});

prospectingRouter.get('/email/worker', async (req: any, res) => {
  try {
    verifyEmailWorkerAuthorization(req.get('authorization'));
    const appUrl = String(process.env.APP_URL || '').trim();
    if (!appUrl) throw new EmailWorkerConfigurationError('APP_URL não configurada.');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(await runEmailDispatchWorker(appUrl));
  } catch (error: any) {
    if (error instanceof EmailWorkerAuthorizationError) return res.status(401).json({ error: error.message });
    if (error instanceof EmailWorkerConfigurationError) return res.status(503).json({ error: error.message });
    console.error('Error running email dispatch worker:', error);
    return res.status(500).json({ error: 'Falha ao executar o worker de e-mails.' });
  }
});

prospectingRouter.get('/email/worker/status', requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const pool = createPool();
    const [state, workload] = await Promise.all([
      pool.query("SELECT * FROM email_dispatch_worker_state WHERE id='main'"),
      pool.query(
        `SELECT COUNT(DISTINCT c.id)::int AS active_campaigns,
                COUNT(r.id) FILTER (WHERE r.status IN ('queued','processing'))::int AS pending_recipients
         FROM email_campaigns c LEFT JOIN email_campaign_recipients r ON r.campaign_id=c.id
         WHERE c.business_id=$1 AND c.status IN ('scheduled','queued','sending')`,
        [req.business.id]
      ),
    ]);
    const row = state.rows[0] || {};
    return res.json({
      configured: String(process.env.CRON_SECRET || '').trim().length >= 16,
      status: row.status || 'never_run',
      lastStartedAt: row.last_started_at || null,
      lastCompletedAt: row.last_completed_at || null,
      lastError: row.last_error || null,
      activeCampaigns: Number(workload.rows[0]?.active_campaigns || 0),
      pendingRecipients: Number(workload.rows[0]?.pending_recipients || 0),
    });
  } catch (error: any) {
    console.error('Error reading email worker status:', error);
    return res.status(500).json({ error: 'Falha ao consultar o worker.' });
  }
});

const unsubscribeHandler = async (req: any, res: any) => {
  const token = String(req.params.token || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return res.status(400).send('Link de descadastramento inválido.');
  }
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipient = (await client.query('SELECT * FROM email_campaign_recipients WHERE unsubscribe_token=$1 FOR UPDATE', [token])).rows[0];
    if (!recipient) { await client.query('ROLLBACK'); return res.status(404).send('Link de descadastramento não encontrado.'); }
    await client.query(
      `INSERT INTO email_unsubscribes (organization_id,business_id,campaign_id,recipient_id,email,normalized_email,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (business_id,normalized_email) DO UPDATE SET campaign_id=EXCLUDED.campaign_id,
         recipient_id=EXCLUDED.recipient_id,source=EXCLUDED.source,unsubscribed_at=NOW()`,
      [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id, recipient.email, recipient.normalized_email, req.method === 'POST' ? 'one_click' : 'link']
    );
    await client.query(
      `INSERT INTO email_campaign_events
        (organization_id,business_id,campaign_id,recipient_id,provider,event_type,payload,occurred_at)
       VALUES ($1,$2,$3,$4,'internal','unsubscribed',$5::jsonb,NOW())`,
      [recipient.organization_id, recipient.business_id, recipient.campaign_id, recipient.id,
        JSON.stringify({ source: req.method === 'POST' ? 'one_click' : 'link' })]
    );
    await client.query(
      `UPDATE email_campaign_recipients SET status='unsubscribed',unsubscribed_at=NOW(),updated_at=NOW()
        WHERE business_id=$1 AND normalized_email=$2 AND status NOT IN ('cancelled')`,
      [recipient.business_id, recipient.normalized_email]
    );
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
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).send('Não foi possível concluir o descadastramento.');
  } finally { client.release(); }
};

prospectingRouter.get('/email/unsubscribe/:token', unsubscribeHandler);
prospectingRouter.post('/email/unsubscribe/:token', unsubscribeHandler);

/**
 * POST /api/prospecting/search
 * Starts a new B2B prospecting search
 */
prospectingRouter.post("/search", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { segment, city, state, country, radiusKm, keywords, requestedLimit } = req.body;

    if (!segment || !segment.trim()) {
      return res.status(400).json({ error: "Segmento é obrigatório para realizar a busca." });
    }

    const searchResult = await ProspectingService.executeSearch({
      organizationId: req.business.organizationId,
      businessId: req.business.id,
      userId: req.dbUser.id,
      segment: segment.trim(),
      city: city?.trim(),
      state: state?.trim(),
      country: country?.trim() || 'Brasil',
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      keywords: keywords?.trim(),
      requestedLimit: requestedLimit ? Number(requestedLimit) : 25,
    });

    res.json(searchResult);
  } catch (error: any) {
    console.error("Error starting prospecting search:", error);
    res.status(500).json({ error: error.message || "Falha ao executar busca de prospecção." });
  }
});

/**
 * GET /api/prospecting/searches
 * Lists recent searches for the business
 */
prospectingRouter.get("/searches", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const searches = await db.select().from(prospectingSearches)
      .where(eq(prospectingSearches.businessId, req.business.id))
      .orderBy(desc(prospectingSearches.createdAt));

    res.json({ searches });
  } catch (error: any) {
    console.error("Error fetching prospecting searches:", error);
    res.status(500).json({ error: "Falha ao carregar histórico de buscas." });
  }
});

/**
 * GET /api/prospecting/searches/:searchId
 * Gets search detail and associated prospects
 */
prospectingRouter.get("/searches/:searchId", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { searchId } = req.params;

    const [searchRecord] = await db.select().from(prospectingSearches)
      .where(and(
        eq(prospectingSearches.id, searchId),
        eq(prospectingSearches.businessId, req.business.id)
      ))
      .limit(1);

    if (!searchRecord) {
      return res.status(404).json({ error: "Busca de prospecção não encontrada." });
    }

    const prospectList = await db.select().from(prospects)
      .where(and(
        eq(prospects.searchId, searchId),
        eq(prospects.businessId, req.business.id)
      ))
      .orderBy(desc(prospects.qualificationScore));

    res.json({ search: searchRecord, prospects: prospectList });
  } catch (error: any) {
    console.error("Error fetching search details:", error);
    res.status(500).json({ error: "Falha ao carregar detalhes da busca." });
  }
});

/**
 * GET /api/prospecting/prospects
 * Lists all prospects for business with filters
 */
prospectingRouter.get("/prospects", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { hasEmail, hasPhone, hasWebsite, status, search, fit, origin, state, segment } = req.query;

    if (origin === 'spreadsheet' || origin === 'search') await ensureProspectingImportSchema();

    const conditions: any[] = [eq(prospects.businessId, req.business.id)];

    if (hasEmail === 'true') {
      conditions.push(sql`${prospects.email} IS NOT NULL AND ${prospects.email} != ''`);
    }
    if (hasPhone === 'true') {
      conditions.push(sql`${prospects.phone} IS NOT NULL AND ${prospects.phone} != ''`);
    }
    if (hasWebsite === 'true') {
      conditions.push(sql`${prospects.website} IS NOT NULL AND ${prospects.website} != ''`);
    }
    if (status) {
      conditions.push(eq(prospects.status, status as string));
    }
    if (fit) {
      conditions.push(eq(prospects.qualificationFit, fit as string));
    }
    if (origin === 'spreadsheet') conditions.push(eq(prospects.sourceType, 'spreadsheet'));
    if (origin === 'search') conditions.push(or(eq(prospects.sourceType, 'search'), sql`${prospects.sourceType} IS NULL`));
    if (state) conditions.push(ilike(prospects.state, String(state)));
    if (segment) conditions.push(ilike(prospects.segment, `%${String(segment)}%`));
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = `%${search.trim()}%`;
      conditions.push(or(
        ilike(prospects.companyName, q),
        ilike(prospects.city, q),
        ilike(prospects.email, q),
        ilike(prospects.website, q)
      ));
    }

    const allProspects = await db.select().from(prospects)
      .where(and(...conditions))
      .orderBy(desc(prospects.qualificationScore), desc(prospects.createdAt));
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(25, Number(req.query.pageSize || 100)));
    const prospectList = allProspects.slice((page - 1) * pageSize, page * pageSize);
    res.json({
      prospects: prospectList,
      pagination: { page, pageSize, total: allProspects.length, totalPages: Math.max(1, Math.ceil(allProspects.length / pageSize)) },
    });
  } catch (error: any) {
    console.error("Error listing prospects:", error);
    res.status(500).json({ error: "Falha ao carregar lista de prospects." });
  }
});

prospectingRouter.post("/import-spreadsheet", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'Nenhuma empresa foi enviada para importação.' });
    const result = await importProspectSpreadsheetRows({
      organizationId: req.business.organizationId,
      businessId: req.business.id,
      rows,
      fileName: req.body?.fileName,
      batchKey: req.body?.batchKey,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Error importing spreadsheet:', error);
    res.status(500).json({ error: error.message || 'Falha ao importar a planilha.' });
  }
});

prospectingRouter.patch("/prospects/status", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 250) : [];
    const status = String(req.body?.status || '');
    if (!ids.length || !['new', 'reviewed', 'qualified', 'disqualified'].includes(status)) {
      return res.status(400).json({ error: 'Seleção ou status inválido.' });
    }
    const updated = await db.update(prospects).set({ status, updatedAt: new Date() })
      .where(and(eq(prospects.businessId, req.business.id), inArray(prospects.id, ids), sql`${prospects.crmLeadId} IS NULL`))
      .returning({ id: prospects.id });
    res.json({ updatedCount: updated.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Falha ao atualizar os prospects.' });
  }
});

/**
 * GET /api/prospecting/prospects/:id
 * Gets full prospect details and associated contacts
 */
prospectingRouter.get("/prospects/:id", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [prospectRecord] = await db.select().from(prospects)
      .where(and(
        eq(prospects.id, id),
        eq(prospects.businessId, req.business.id)
      ))
      .limit(1);

    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect não encontrado." });
    }

    const contactsList = await db.select().from(prospectContacts)
      .where(eq(prospectContacts.prospectId, id));

    res.json({ prospect: prospectRecord, contacts: contactsList });
  } catch (error: any) {
    console.error("Error fetching prospect details:", error);
    res.status(500).json({ error: "Falha ao carregar detalhes do prospect." });
  }
});

/**
 * POST /api/prospecting/prospects/:id/qualify
 * Re-runs AI qualification for a specific prospect
 */
prospectingRouter.post("/prospects/:id/qualify", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [prospectRecord] = await db.select().from(prospects)
      .where(and(
        eq(prospects.id, id),
        eq(prospects.businessId, req.business.id)
      ))
      .limit(1);

    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect não encontrado." });
    }

    const qualification = await qualifyProspect(
      {
        name: req.business.name,
        segment: req.business.segment || undefined,
        description: req.business.description || undefined,
      },
      {
        companyName: prospectRecord.companyName,
        segment: prospectRecord.segment || undefined,
        city: prospectRecord.city || undefined,
        state: prospectRecord.state || undefined,
        description: prospectRecord.description || undefined,
        website: prospectRecord.website || undefined,
      }
    );

    const [updated] = await db.update(prospects)
      .set({
        qualificationScore: qualification.score,
        qualificationReason: qualification.reason,
        qualificationFit: qualification.fit,
        possibleNeed: qualification.possibleNeed,
        status: qualification.fit === 'high' ? 'qualified' : prospectRecord.status,
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, id))
      .returning();

    res.json({ prospect: updated, qualification });
  } catch (error: any) {
    console.error("Error qualifying prospect:", error);
    res.status(500).json({ error: "Falha ao qualificar prospect." });
  }
});

/**
 * POST /api/prospecting/prospects/:id/generate-approach
 * Generates an outreach email approach suggestion without sending
 */
prospectingRouter.post("/prospects/:id/generate-approach", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { id } = req.params;
    const options = req.body || {};

    const [prospectRecord] = await db.select().from(prospects)
      .where(and(
        eq(prospects.id, id),
        eq(prospects.businessId, req.business.id)
      ))
      .limit(1);

    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect não encontrado." });
    }

    const approach = await generateApproach(
      {
        name: req.business.name,
        segment: req.business.segment || undefined,
        description: req.business.description || undefined,
      },
      {
        companyName: prospectRecord.companyName,
        segment: prospectRecord.segment || undefined,
        city: prospectRecord.city || undefined,
        description: prospectRecord.description || undefined,
        website: prospectRecord.website || undefined,
      },
      options
    );
    const { source = 'template', ...approachContent } = approach;
    res.json({ approach: approachContent, source });
  } catch (error: any) {
    console.error("Error generating approach:", error);
    res.status(500).json({ error: "Falha ao gerar proposta de abordagem." });
  }
});

/**
 * POST /api/prospecting/prospects/import
 * Bulk imports prospects as CRM leads
 */
prospectingRouter.post("/prospects/import", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { prospectIds } = req.body;

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({ error: "Nenhum prospect selecionado para importação." });
    }

    const result = await ProspectingService.importProspectsToCRM(
      req.business.id,
      req.business.organizationId,
      prospectIds
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error importing prospects to CRM:", error);
    res.status(500).json({ error: "Falha ao importar prospects para o CRM." });
  }
});

/**
 * POST /api/prospecting/prospects/export
 * Exports selected or all prospects as CSV
 */
prospectingRouter.post("/prospects/export", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { prospectIds } = req.body;

    const csvData = await ProspectingService.exportProspectsCSV(
      req.business.id,
      Array.isArray(prospectIds) ? prospectIds : undefined
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
    res.send(csvData);
  } catch (error: any) {
    console.error("Error exporting prospects CSV:", error);
    res.status(500).json({ error: "Falha ao exportar CSV de prospects." });
  }
});
