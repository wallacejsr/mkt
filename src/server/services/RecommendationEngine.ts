import { db } from '../../db/index';
import {
  recommendations,
  leads,
  campaigns,
  campaignTasks,
  contentItems,
  strategies,
  goals,
  businesses,
  aiGenerations,
  prospects
} from '../../db/schema';
import { eq, and, ne, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

export interface RecommendationEvaluated {
  fingerprint: string;
  type: string;
  category: 'sales' | 'content' | 'campaign' | 'strategy' | 'opportunity';
  title: string;
  description: string;
  reason?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number;
  impact: 'low' | 'medium' | 'high';
  sourceType: 'lead' | 'campaign' | 'content' | 'strategy' | 'pipeline' | 'goal';
  sourceId?: string | null;
  actionType?: string;
  actionUrl?: string;
  metadata?: any;
}

export class RecommendationEngine {
  /**
   * Calculates MD5 fingerprint for deduplication
   */
  public static calculateFingerprint(businessId: string, type: string, sourceType: string, sourceId?: string | null): string {
    const raw = `${businessId}:${type}:${sourceType}:${sourceId || 'aggregate'}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * Deterministic Priority Score calculation (0 - 100)
   */
  public static calculatePriorityScore(
    priority: 'low' | 'medium' | 'high' | 'critical',
    financialValue: number = 0,
    isStrategic: boolean = false,
    daysStagnant: number = 0
  ): number {
    // 1. Urgency (0 - 40)
    let urgencyScore = 10;
    if (priority === 'critical') urgencyScore = 40;
    else if (priority === 'high') urgencyScore = 30;
    else if (priority === 'medium') urgencyScore = 20;

    // 2. Financial Impact (0 - 30)
    let financialScore = 0;
    if (financialValue > 50000) financialScore = 30;
    else if (financialValue > 10000) financialScore = 20;
    else if (financialValue > 1000) financialScore = 10;
    else if (financialValue > 0) financialScore = 5;

    // 3. Strategic Impact (0 - 20)
    const strategicScore = isStrategic ? 20 : 0;

    // 4. Age / Stagnation (0 - 10)
    const ageScore = Math.min(10, Math.floor(daysStagnant * 2));

    const total = urgencyScore + financialScore + strategicScore + ageScore;
    return Math.min(100, Math.max(0, total));
  }

  /**
   * Evaluates all business modules and syncs database recommendations
   */
  public static async evaluateBusiness(businessId: string): Promise<any[]> {
    // 1. Fetch business info
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId),
    });
    if (!business) return [];

    const organizationId = business.organizationId;
    const now = new Date();
    const nowTime = now.getTime();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Fetch related modules
    const allLeads = await db.select().from(leads).where(eq(leads.businessId, businessId));
    const allCampaigns = await db.select().from(campaigns).where(eq(campaigns.businessId, businessId));
    const allContent = await db.select().from(contentItems).where(eq(contentItems.businessId, businessId));
    const activeStrategy = await db.query.strategies.findFirst({
      where: and(eq(strategies.businessId, businessId), eq(strategies.isActive, true)),
    });
    const businessGoals = await db.select().from(goals).where(eq(goals.businessId, businessId));

    const evaluatedList: RecommendationEvaluated[] = [];

    // ==========================================
    // A. SALES & LEADS RULES
    // ==========================================
    let stagnantLeadsCount = 0;
    let totalStagnantValue = 0;
    let proposalLeadsCount = 0;
    let totalProposalValue = 0;

    for (const lead of allLeads) {
      if (lead.status === 'customer' || lead.status === 'lost') continue;

      const createdAtTime = lead.createdAt ? new Date(lead.createdAt).getTime() : nowTime;
      const lastContactTime = lead.lastContactAt ? new Date(lead.lastContactAt).getTime() : createdAtTime;
      const hoursSinceCreated = (nowTime - createdAtTime) / (1000 * 60 * 60);
      const hoursSinceLastContact = (nowTime - lastContactTime) / (1000 * 60 * 60);
      const daysSinceLastContact = Math.floor(hoursSinceLastContact / 24);
      const leadValue = lead.potentialValue || 0;

      if (hoursSinceLastContact > 48) {
        stagnantLeadsCount++;
        totalStagnantValue += leadValue;
      }

      if (lead.status === 'proposal') {
        proposalLeadsCount++;
        totalProposalValue += leadValue;
      }

      // REGRA 3 — PRÓXIMA AÇÃO ATRASADA
      if (lead.nextActionAt) {
        const nextActionTime = new Date(lead.nextActionAt).getTime();
        if (nextActionTime < nowTime) {
          const fingerprint = this.calculateFingerprint(businessId, 'next_action_overdue', 'lead', lead.id);
          const score = this.calculatePriorityScore('critical', leadValue, false, daysSinceLastContact);
          evaluatedList.push({
            fingerprint,
            type: 'next_action_overdue',
            category: 'sales',
            title: `Próxima ação atrasada: ${lead.name}`,
            description: `Ação "${lead.nextAction || 'Follow-up'}" agendada estava vencida desde ${new Date(lead.nextActionAt).toLocaleDateString('pt-BR')}.`,
            reason: 'O lead possui uma atividade de follow-up com data anterior a hoje.',
            priority: 'critical',
            priorityScore: score,
            impact: leadValue > 10000 ? 'high' : 'medium',
            sourceType: 'lead',
            sourceId: lead.id,
            actionType: 'open_lead',
            actionUrl: `/leads?leadId=${lead.id}`,
            metadata: { leadId: lead.id, leadName: lead.name, potentialValue: leadValue }
          });
          continue; // Avoid duplicate alerts per single lead
        }
      }

      // REGRA 1 — LEAD NOVO SEM CONTATO (> 24h)
      if (lead.status === 'new' && hoursSinceCreated > 24 && !lead.lastContactAt) {
        const fingerprint = this.calculateFingerprint(businessId, 'new_lead_uncontacted', 'lead', lead.id);
        const score = this.calculatePriorityScore('high', leadValue, false, Math.floor(hoursSinceCreated / 24));
        evaluatedList.push({
          fingerprint,
          type: 'new_lead_uncontacted',
          category: 'sales',
          title: 'Lead aguardando primeiro contato',
          description: `O lead "${lead.name}" entrou há mais de 24h e ainda não recebeu nenhum contato inicial.`,
          reason: 'Leads contatados nas primeiras 24h têm maior taxa de conversão.',
          priority: 'high',
          priorityScore: score,
          impact: leadValue > 10000 ? 'high' : 'medium',
          sourceType: 'lead',
          sourceId: lead.id,
          actionType: 'open_lead',
          actionUrl: `/leads?leadId=${lead.id}`,
          metadata: { leadId: lead.id, leadName: lead.name }
        });
        continue;
      }

      // REGRA 4 — PROPOSTA PARADA (> 3 dias)
      if (lead.status === 'proposal' && hoursSinceLastContact > 72) {
        const fingerprint = this.calculateFingerprint(businessId, 'proposal_stagnant', 'lead', lead.id);
        const score = this.calculatePriorityScore('high', leadValue, true, daysSinceLastContact);
        const valFormatted = leadValue > 0 ? ` (Valor: R$ ${leadValue.toLocaleString('pt-BR')})` : '';
        evaluatedList.push({
          fingerprint,
          type: 'proposal_stagnant',
          category: 'sales',
          title: `Proposta aguardando follow-up: ${lead.name}`,
          description: `Proposta enviada para "${lead.name}"${valFormatted} está sem novidades há mais de 3 dias.`,
          reason: 'Propostas sem acompanhamento frequente correm risco de esfriar.',
          priority: 'high',
          priorityScore: score,
          impact: leadValue > 20000 ? 'high' : 'medium',
          sourceType: 'lead',
          sourceId: lead.id,
          actionType: 'open_lead',
          actionUrl: `/leads?leadId=${lead.id}`,
          metadata: { leadId: lead.id, leadName: lead.name, potentialValue: leadValue }
        });
        continue;
      }

      // REGRA 2 — LEAD SEM FOLLOW-UP (> 48h)
      if (hoursSinceLastContact > 48) {
        const fingerprint = this.calculateFingerprint(businessId, 'stagnant_lead', 'lead', lead.id);
        const score = this.calculatePriorityScore('high', leadValue, false, daysSinceLastContact);
        evaluatedList.push({
          fingerprint,
          type: 'stagnant_lead',
          category: 'sales',
          title: `Lead sem contato há mais de 48h: ${lead.name}`,
          description: `Sem registros de interação com "${lead.name}" há ${daysSinceLastContact} dias.`,
          reason: 'Interação contínua mantém o interesse do cliente aquecido.',
          priority: 'high',
          priorityScore: score,
          impact: leadValue > 10000 ? 'high' : 'medium',
          sourceType: 'lead',
          sourceId: lead.id,
          actionType: 'open_lead',
          actionUrl: `/leads?leadId=${lead.id}`,
          metadata: { leadId: lead.id, leadName: lead.name, potentialValue: leadValue }
        });
      }
    }

    // REGRA 16 — REGRA AGREGADA — PIPELINE EM RISCO (>=3 leads parados)
    if (stagnantLeadsCount >= 3) {
      const fingerprint = this.calculateFingerprint(businessId, 'pipeline_at_risk', 'pipeline', 'all');
      const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalStagnantValue);
      const score = this.calculatePriorityScore('critical', totalStagnantValue, true, 3);
      evaluatedList.push({
        fingerprint,
        type: 'pipeline_at_risk',
        category: 'sales',
        title: `${formattedVal} em oportunidades precisam de atenção`,
        description: `${stagnantLeadsCount} leads estão sem registros de contato ou atualização há mais de 48 horas.`,
        reason: 'O acúmulo de leads parados compromete a previsibilidade do funil de vendas.',
        priority: 'critical',
        priorityScore: score,
        impact: 'high',
        sourceType: 'pipeline',
        sourceId: 'all',
        actionType: 'view_leads',
        actionUrl: '/leads',
        metadata: { stagnantLeadsCount, totalStagnantValue }
      });
    }

    // REGRA 17 — REGRA — MUITAS PROPOSTAS (>= 3 propostas)
    if (proposalLeadsCount >= 3) {
      const fingerprint = this.calculateFingerprint(businessId, 'many_proposals', 'pipeline', 'proposals');
      const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalProposalValue);
      const score = this.calculatePriorityScore('high', totalProposalValue, true, 2);
      evaluatedList.push({
        fingerprint,
        type: 'many_proposals',
        category: 'opportunity',
        title: `Você possui ${proposalLeadsCount} propostas em aberto (${formattedVal})`,
        description: `Existem ${proposalLeadsCount} propostas ativas aguardando fechamento, representando ${formattedVal} em potencial.`,
        reason: 'Focar o esforço comercial no fechamento dessas propostas é a rota mais rápida para receita.',
        priority: 'high',
        priorityScore: score,
        impact: 'high',
        sourceType: 'pipeline',
        sourceId: 'proposals',
        actionType: 'view_proposals',
        actionUrl: '/leads?status=proposal',
        metadata: { proposalLeadsCount, totalProposalValue }
      });
    }

    // REGRA 17B — PROSPECTS QUALIFICADOS PENDENTES DE IMPORTAÇÃO PARA O CRM
    try {
      const pendingQualifiedProspects = await db.select().from(prospects)
        .where(and(
          eq(prospects.businessId, businessId),
          eq(prospects.status, 'qualified')
        ));

      if (pendingQualifiedProspects.length > 0) {
        const count = pendingQualifiedProspects.length;
        const fingerprint = this.calculateFingerprint(businessId, 'pending_qualified_prospects', 'pipeline', 'prospecting');
        evaluatedList.push({
          fingerprint,
          type: 'pending_qualified_prospects',
          category: 'opportunity',
          title: `Prospects qualificados aguardando importação para o CRM`,
          description: `Você possui ${count} prospects com alta compatibilidade identificados na prospecção que ainda não foram adicionados ao CRM.`,
          reason: 'Importar prospects qualificados para o CRM permite iniciar o contato comercial rapidamente.',
          priority: 'high',
          priorityScore: 85,
          impact: 'high',
          sourceType: 'pipeline',
          sourceId: 'prospecting',
          actionType: 'view_prospects',
          actionUrl: '/prospecting',
          metadata: { qualifiedProspectsCount: count }
        });
      }
    } catch (e) {
      console.warn("Could not fetch pending prospects for recommendation:", e);
    }

    // ==========================================
    // B. CONTENT RULES
    // ==========================================
    const future7DaysDate = new Date();
    future7DaysDate.setDate(future7DaysDate.getDate() + 7);
    const future7DaysStr = future7DaysDate.toISOString().split('T')[0];

    let contentScheduledNext7Days = 0;

    for (const item of allContent) {
      if (item.scheduledDate) {
        if (item.scheduledDate >= todayStr && item.scheduledDate <= future7DaysStr) {
          contentScheduledNext7Days++;
        }

        // REGRA 18 — CONTEÚDO DE HOJE
        if (item.scheduledDate === todayStr && item.status !== 'published') {
          const fingerprint = this.calculateFingerprint(businessId, 'content_today_unpublished', 'content', item.id);
          const score = this.calculatePriorityScore('medium', 0, false, 0);
          evaluatedList.push({
            fingerprint,
            type: 'content_today_unpublished',
            category: 'content',
            title: `Conteúdo programado para hoje não publicado`,
            description: `O conteúdo "${item.title}" está agendado para hoje e ainda está no status ${item.status}.`,
            reason: 'Manter a constância da publicação fortalece o alcance orgânico.',
            priority: 'medium',
            priorityScore: score,
            impact: 'medium',
            sourceType: 'content',
            sourceId: item.id,
            actionType: 'open_content',
            actionUrl: `/content`,
            metadata: { contentId: item.id, title: item.title }
          });
        }

        // REGRA 20 — CONTEÚDO ATRASADO
        if (item.scheduledDate < todayStr && item.status !== 'published') {
          const fingerprint = this.calculateFingerprint(businessId, 'overdue_content', 'content', item.id);
          const score = this.calculatePriorityScore('medium', 0, false, 2);
          evaluatedList.push({
            fingerprint,
            type: 'overdue_content',
            category: 'content',
            title: `Conteúdo com data atrasada: ${item.title}`,
            description: `Conteúdo estava agendado para ${item.scheduledDate} e permanece pendente.`,
            reason: 'Atualize a data de agendamento ou publique o conteúdo para ajustar o calendário.',
            priority: 'medium',
            priorityScore: score,
            impact: 'medium',
            sourceType: 'content',
            sourceId: item.id,
            actionType: 'open_content',
            actionUrl: `/content`,
            metadata: { contentId: item.id, title: item.title }
          });
        }
      }
    }

    // REGRA 19 — CALENDÁRIO VAZIO
    if (contentScheduledNext7Days === 0) {
      const fingerprint = this.calculateFingerprint(businessId, 'empty_calendar', 'content', 'empty');
      const score = this.calculatePriorityScore('medium', 0, true, 0);
      evaluatedList.push({
        fingerprint,
        type: 'empty_calendar',
        category: 'content',
        title: 'Seu calendário de conteúdo está vazio',
        description: 'Você não possui nenhum conteúdo planejado para os próximos 7 dias.',
        reason: 'O planejamento prévio evita interrupções na sua presença digital.',
        priority: 'medium',
        priorityScore: score,
        impact: 'medium',
        sourceType: 'content',
        sourceId: 'empty',
        actionType: 'plan_content',
        actionUrl: '/content',
      });
    }

    // ==========================================
    // C. CAMPAIGN RULES
    // ==========================================
    const allCampaignTasks = await db.select().from(campaignTasks);

    for (const campaign of allCampaigns) {
      if (campaign.status !== 'active') continue;

      const campaignLeads = allLeads.filter(l => l.campaignId === campaign.id);
      const campaignTasksList = allCampaignTasks.filter(t => t.campaignId === campaign.id);
      const pendingTasks = campaignTasksList.filter(t => t.status !== 'done');

      // REGRA 21 — CAMPANHA TERMINANDO EM BREVE
      if (campaign.endDate) {
        const in3DaysDate = new Date();
        in3DaysDate.setDate(in3DaysDate.getDate() + 3);
        const in3DaysStr = in3DaysDate.toISOString().split('T')[0];

        if (campaign.endDate >= todayStr && campaign.endDate <= in3DaysStr) {
          const fingerprint = this.calculateFingerprint(businessId, 'campaign_ending_soon', 'campaign', campaign.id);
          const score = this.calculatePriorityScore('high', 0, true, 0);
          evaluatedList.push({
            fingerprint,
            type: 'campaign_ending_soon',
            category: 'campaign',
            title: `Campanha encerra em breve: ${campaign.name}`,
            description: `A campanha "${campaign.name}" está prevista para terminar na data ${campaign.endDate}.`,
            reason: 'Avalie os resultados para decidir por prorrogação ou encerramento.',
            priority: 'high',
            priorityScore: score,
            impact: 'high',
            sourceType: 'campaign',
            sourceId: campaign.id,
            actionType: 'review_campaign',
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: { campaignId: campaign.id, endDate: campaign.endDate }
          });
        }

        // REGRA 22 — CAMPANHA VENCIDA
        if (campaign.endDate < todayStr) {
          const fingerprint = this.calculateFingerprint(businessId, 'campaign_overdue', 'campaign', campaign.id);
          const score = this.calculatePriorityScore('high', 0, true, 2);
          evaluatedList.push({
            fingerprint,
            type: 'campaign_overdue',
            category: 'campaign',
            title: `Campanha passou da data final: ${campaign.name}`,
            description: `A campanha "${campaign.name}" ainda consta como ativa, mas sua data final era ${campaign.endDate}.`,
            reason: 'Atualize o status ou prorrogue a vigência para manter o acompanhamento correto.',
            priority: 'high',
            priorityScore: score,
            impact: 'high',
            sourceType: 'campaign',
            sourceId: campaign.id,
            actionType: 'review_campaign',
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: { campaignId: campaign.id }
          });
        }
      }

      // REGRA 23 — CAMPANHA SEM LEADS
      const createdAtDate = campaign.createdAt ? new Date(campaign.createdAt) : now;
      const daysSinceCreated = Math.floor((nowTime - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCreated >= 3 && campaignLeads.length === 0) {
        const fingerprint = this.calculateFingerprint(businessId, 'campaign_no_leads', 'campaign', campaign.id);
        const score = this.calculatePriorityScore('medium', 0, false, daysSinceCreated);
        evaluatedList.push({
          fingerprint,
          type: 'campaign_no_leads',
          category: 'campaign',
          title: `Campanha sem leads registrados: ${campaign.name}`,
          description: `A campanha "${campaign.name}" está ativa há ${daysSinceCreated} dias e ainda não possui leads atribuídos no sistema.`,
          reason: 'Verifique os canais de divulgação ou certifique-se de registrar as conversões.',
          priority: 'medium',
          priorityScore: score,
          impact: 'medium',
          sourceType: 'campaign',
          sourceId: campaign.id,
          actionType: 'review_campaign',
          actionUrl: `/campaigns/${campaign.id}`,
          metadata: { campaignId: campaign.id }
        });
      }

      // REGRA 24 & 25 — TAREFAS DE CAMPANHA
      let overdueTasksCount = 0;
      for (const task of pendingTasks) {
        if (task.dueDate && task.dueDate < todayStr) {
          overdueTasksCount++;
          const fingerprint = this.calculateFingerprint(businessId, 'campaign_task_overdue', 'campaign', task.id);
          const score = this.calculatePriorityScore('medium', 0, false, 1);
          evaluatedList.push({
            fingerprint,
            type: 'campaign_task_overdue',
            category: 'campaign',
            title: `Tarefa de campanha atrasada: ${task.title}`,
            description: `Tarefa "${task.title}" da campanha "${campaign.name}" venceu em ${task.dueDate}.`,
            reason: 'Tarefas em dia evitam atrasos na veiculação e resultados da campanha.',
            priority: 'medium',
            priorityScore: score,
            impact: 'medium',
            sourceType: 'campaign',
            sourceId: campaign.id,
            actionType: 'review_campaign',
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: { taskId: task.id, campaignId: campaign.id }
          });
        }
      }

      // REGRA 25 — CAMPANHA NÃO EXECUTADA (Agregada)
      if (pendingTasks.length >= 3) {
        const fingerprint = this.calculateFingerprint(businessId, 'campaign_unexecuted', 'campaign', campaign.id);
        const score = this.calculatePriorityScore('high', 0, true, 2);
        evaluatedList.push({
          fingerprint,
          type: 'campaign_unexecuted',
          category: 'campaign',
          title: `Campanha "${campaign.name}" possui ${pendingTasks.length} ações pendentes`,
          description: `Existem ${pendingTasks.length} tarefas não concluídas (${overdueTasksCount} atrasadas) para esta campanha ativa.`,
          reason: 'Ações operacionais pendentes impactam diretamente a atração e conversão de leads.',
          priority: 'high',
          priorityScore: score,
          impact: 'high',
          sourceType: 'campaign',
          sourceId: campaign.id,
          actionType: 'review_campaign',
          actionUrl: `/campaigns/${campaign.id}`,
          metadata: { campaignId: campaign.id, pendingCount: pendingTasks.length }
        });
      }
    }

    // ==========================================
    // D. STRATEGY RULES
    // ==========================================
    // REGRA 26 — OBJETIVO SEM EXECUÇÃO
    const activeCampaigns = allCampaigns.filter(c => c.status === 'active');
    if ((activeStrategy || businessGoals.length > 0) && activeCampaigns.length === 0 && contentScheduledNext7Days === 0) {
      const fingerprint = this.calculateFingerprint(businessId, 'goal_unexecuted', 'strategy', 'goal');
      const score = this.calculatePriorityScore('high', 0, true, 0);
      evaluatedList.push({
        fingerprint,
        type: 'goal_unexecuted',
        category: 'strategy',
        title: 'Seu objetivo atual não possui ações em andamento',
        description: 'Você possui estratégia/objetivo definidos, mas nenhuma campanha ativa e nenhum conteúdo planejado para os próximos dias.',
        reason: 'Uma estratégia só produz resultados quando traduzida em ações contínuas de marketing.',
        priority: 'high',
        priorityScore: score,
        impact: 'high',
        sourceType: 'strategy',
        sourceId: activeStrategy?.id || 'goal',
        actionType: 'create_campaign',
        actionUrl: '/campaigns',
      });
    }

    // ==========================================
    // E. SYNCHRONIZE WITH DATABASE (Deduplication + Auto-Resolution)
    // ==========================================
    const existingDbRecs = await db.select()
      .from(recommendations)
      .where(eq(recommendations.businessId, businessId));

    const existingMap = new Map<string, typeof existingDbRecs[0]>();
    for (const r of existingDbRecs) {
      existingMap.set(r.fingerprint, r);
    }

    const activeFingerprintsSet = new Set<string>();

    for (const item of evaluatedList) {
      activeFingerprintsSet.add(item.fingerprint);
      const existing = existingMap.get(item.fingerprint);

      if (existing) {
        // If dismissed, do NOT revive unless it was cleared previously
        if (existing.status === 'dismissed') {
          continue;
        }

        // Update active recommendation with latest score/data
        await db.update(recommendations)
          .set({
            title: item.title,
            description: item.description,
            reason: item.reason,
            priority: item.priority,
            priorityScore: item.priorityScore,
            impact: item.impact,
            status: 'active',
            metadata: item.metadata,
            updatedAt: new Date(),
            resolvedAt: null,
          })
          .where(eq(recommendations.id, existing.id));
      } else {
        // Create new active recommendation
        await db.insert(recommendations).values({
          organizationId,
          businessId,
          fingerprint: item.fingerprint,
          type: item.type,
          category: item.category,
          title: item.title,
          description: item.description,
          reason: item.reason,
          priority: item.priority,
          priorityScore: item.priorityScore,
          impact: item.impact,
          sourceType: item.sourceType,
          sourceId: item.sourceId || null,
          actionType: item.actionType,
          actionUrl: item.actionUrl,
          status: 'active',
          metadata: item.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Auto-resolve any recommendations currently 'active' in DB whose condition is no longer present
    for (const r of existingDbRecs) {
      if (r.status === 'active' && !activeFingerprintsSet.has(r.fingerprint)) {
        await db.update(recommendations)
          .set({
            status: 'completed',
            resolvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(recommendations.id, r.id));
      }
    }

    // Fetch and return fresh list of recommendations sorted by priorityScore DESC
    return await db.select()
      .from(recommendations)
      .where(eq(recommendations.businessId, businessId));
  }

  /**
   * Generates max 3 strategic executive insights using Gemini with AGGREGATED data only.
   */
  public static async generateStrategicInsights(businessId: string): Promise<string[]> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return [
          "Defina metas claras de conversão para acompanhar a eficiência das campanhas ativas.",
          "Priorize o contato com leads em estágio de proposta para acelerar o ciclo de receita."
        ];
      }

      // Collect AGGREGATED data only (no individual user/lead PII)
      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });
      const allLeads = await db.select().from(leads).where(eq(leads.businessId, businessId));
      const allCampaigns = await db.select().from(campaigns).where(eq(campaigns.businessId, businessId));
      const allContent = await db.select().from(contentItems).where(eq(contentItems.businessId, businessId));
      const businessGoals = await db.select().from(goals).where(eq(goals.businessId, businessId));

      const totalLeads = allLeads.length;
      const proposalLeads = allLeads.filter(l => l.status === 'proposal').length;
      const customers = allLeads.filter(l => l.status === 'customer').length;
      const activeCampaignsCount = allCampaigns.filter(c => c.status === 'active').length;
      const publishedContentCount = allContent.filter(c => c.status === 'published').length;

      const aggregatedData = {
        businessName: business?.name,
        segment: business?.segment,
        goals: businessGoals.map(g => g.goalType),
        pipelineSummary: {
          totalLeads,
          proposalLeads,
          convertedCustomers: customers,
        },
        marketingSummary: {
          activeCampaigns: activeCampaignsCount,
          publishedContent: publishedContentCount,
        }
      };

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const prompt = `Você é um analista executivo de marketing e vendas B2B/B2C.
Analise estes dados AGREGADOS do negócio:
${JSON.stringify(aggregatedData, null, 2)}

Forneça NO MÁXIMO 3 insights estratégicos curtos, práticos e diretos em português (1 frase por insight).
Regras estritas:
1. NÃO invente causalidades diretas não comprovadas (ex: "seu post X vendeu Y").
2. Foque em direções de alocação de tempo, gargalos de funil ou priorização de canais.
3. Retorne no formato JSON array de strings: ["Insight 1", "Insight 2", "Insight 3"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const rawText = response.text || "[]";
      const insightsArray = JSON.parse(rawText);

      // Save audit log in aiGenerations
      if (business) {
        await db.insert(aiGenerations).values({
          organizationId: business.organizationId,
          businessId: business.id,
          type: 'strategic_insights',
          model: 'gemini-3.6-flash',
          output: insightsArray,
          createdAt: new Date(),
        });
      }

      return Array.isArray(insightsArray) ? insightsArray.slice(0, 3) : [];
    } catch (e: any) {
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('Quota exceeded')) {
        console.warn("Gemini API rate limit (429) hit for strategic insights. Returning default fallback insights.");
      } else {
        console.error("Failed to generate strategic insights:", e);
      }
      return [
        "Mantenha o foco em follow-up de propostas ativas para garantir fluxo constante de caixa.",
        "Mantenha a frequência semanal de publicações nos canais principais para atração constante."
      ];
    }
  }
}
