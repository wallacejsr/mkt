import { Router } from "express";
import { db } from "../../db/index";
import { leads, leadActivities, campaigns, contentItems, businesses, users } from "../../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { GoogleGenAI } from "@google/genai";

export const analyticsRouter = Router();

// Middleware ensuring business ownership
const ensureBusinessOwnership = async (req: any, res: any, next: any) => {
  const { businessId } = req.query;
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

  req.business = business;
  req.dbUser = dbUser;
  next();
};

// Helper to compute start and end dates based on preset period
function getPeriodDates(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let endDate = new Date(now);
  let startDate = new Date(now);

  if (period === '7d') {
    startDate.setDate(now.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(now.getDate() - 30);
  } else if (period === '90d') {
    startDate.setDate(now.getDate() - 90);
  } else if (period === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
  } else {
    // Default 30d
    startDate.setDate(now.getDate() - 30);
  }

  // Calculate previous period for comparison
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  return { startDate, endDate, prevStartDate, prevEndDate };
}

// 1. GET /api/analytics/overview
analyticsRouter.get("/overview", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId, period = '30d', customStart, customEnd, comparePrevious = 'true' } = req.query;

  try {
    const { startDate, endDate, prevStartDate, prevEndDate } = getPeriodDates(
      period as string,
      customStart as string,
      customEnd as string
    );

    // Fetch leads for current period
    const currentLeads = await db.select()
      .from(leads)
      .where(and(
        eq(leads.businessId, businessId as string),
        gte(leads.createdAt, startDate),
        lte(leads.createdAt, endDate)
      ));

    // Fetch converted leads in current period (converted_at inside window)
    const convertedInPeriod = await db.select()
      .from(leads)
      .where(and(
        eq(leads.businessId, businessId as string),
        eq(leads.status, 'customer'),
        gte(leads.convertedAt, startDate),
        lte(leads.convertedAt, endDate)
      ));

    // Fetch previous period leads for comparison
    let prevLeads: any[] = [];
    let prevConverted: any[] = [];
    if (comparePrevious === 'true') {
      prevLeads = await db.select()
        .from(leads)
        .where(and(
          eq(leads.businessId, businessId as string),
          gte(leads.createdAt, prevStartDate),
          lte(leads.createdAt, prevEndDate)
        ));

      prevConverted = await db.select()
        .from(leads)
        .where(and(
          eq(leads.businessId, businessId as string),
          eq(leads.status, 'customer'),
          gte(leads.convertedAt, prevStartDate),
          lte(leads.convertedAt, prevEndDate)
        ));
    }

    // Fetch all active/relevant campaigns
    const businessCampaigns = await db.select()
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId as string));

    // Current metrics
    const totalLeads = currentLeads.length;
    const totalCustomers = convertedInPeriod.length;
    const conversionRate = totalLeads > 0 ? (totalCustomers / totalLeads) * 100 : 0;
    const attributedRevenue = convertedInPeriod.reduce((sum, l) => sum + Number(l.actualValue || 0), 0);

    // Total potential value currently in active pipeline (not lost/customer)
    const activePipelineLeads = await db.select()
      .from(leads)
      .where(and(
        eq(leads.businessId, businessId as string),
        sql`${leads.status} NOT IN ('customer', 'lost')`
      ));
    const potentialPipelineValue = activePipelineLeads.reduce((sum, l) => sum + Number(l.potentialValue || 0), 0);

    // Investment total across campaigns
    const parseBudget = (b: string | null | undefined, inv: number | null | undefined) => {
      if (inv) return inv;
      if (!b) return 0;
      const parsed = parseFloat(b.replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    const totalInvestment = businessCampaigns.reduce((sum, c) => sum + parseBudget(c.budget, c.investmentSpent), 0);
    const cpl = totalLeads > 0 && totalInvestment > 0 ? (totalInvestment / totalLeads) : null;
    const cac = totalCustomers > 0 && totalInvestment > 0 ? (totalInvestment / totalCustomers) : null;
    const roas = totalInvestment > 0 ? (attributedRevenue / totalInvestment) : null;

    // Previous metrics & percentage changes
    const prevTotalLeads = prevLeads.length;
    const prevTotalCustomers = prevConverted.length;
    const prevConversionRate = prevTotalLeads > 0 ? (prevTotalCustomers / prevTotalLeads) * 100 : 0;
    const prevRevenue = prevConverted.reduce((sum, l) => sum + Number(l.actualValue || 0), 0);

    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return null; // "Sem base de comparação"
      return ((curr - prev) / prev) * 100;
    };

    const changes = {
      leads: calcChange(totalLeads, prevTotalLeads),
      customers: calcChange(totalCustomers, prevTotalCustomers),
      conversionRate: calcChange(conversionRate, prevConversionRate),
      revenue: calcChange(attributedRevenue, prevRevenue),
    };

    // Pipeline Breakdown by Stage
    const allBusinessLeads = await db.select()
      .from(leads)
      .where(eq(leads.businessId, businessId as string));

    const pipelineByStage: Record<string, { count: number; value: number }> = {
      new: { count: 0, value: 0 },
      contacted: { count: 0, value: 0 },
      interested: { count: 0, value: 0 },
      proposal: { count: 0, value: 0 },
      customer: { count: 0, value: 0 },
      lost: { count: 0, value: 0 },
    };

    allBusinessLeads.forEach(l => {
      if (pipelineByStage[l.status]) {
        pipelineByStage[l.status].count++;
        pipelineByStage[l.status].value += Number(l.potentialValue || l.actualValue || 0);
      }
    });

    // Average days to conversion
    let totalConversionDays = 0;
    let convertedCountWithDates = 0;
    allBusinessLeads.forEach(l => {
      if (l.status === 'customer' && l.createdAt && l.convertedAt) {
        const diffMs = new Date(l.convertedAt).getTime() - new Date(l.createdAt).getTime();
        const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        totalConversionDays += diffDays;
        convertedCountWithDates++;
      }
    });
    const avgConversionTimeDays = convertedCountWithDates > 0
      ? (totalConversionDays / convertedCountWithDates)
      : null;

    // Lost Reasons Distribution
    const lostReasonCounts: Record<string, number> = {};
    let totalLostCount = 0;
    allBusinessLeads.forEach(l => {
      if (l.status === 'lost') {
        totalLostCount++;
        const reason = l.lostReason || 'Outros / Não informado';
        lostReasonCounts[reason] = (lostReasonCounts[reason] || 0) + 1;
      }
    });

    const lostReasons = Object.entries(lostReasonCounts).map(([reason, count]) => ({
      reason,
      count,
      percentage: totalLostCount > 0 ? (count / totalLostCount) * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    // Campaigns Performance Comparison (CRM vs Manual)
    const campaignsPerformance = businessCampaigns.map(c => {
      const campaignLeadsList = allBusinessLeads.filter(l => l.campaignId === c.id);
      const crmLeadsCount = campaignLeadsList.length;
      const crmCustomersCount = campaignLeadsList.filter(l => l.status === 'customer').length;
      const crmRevenue = campaignLeadsList
        .filter(l => l.status === 'customer')
        .reduce((sum, l) => sum + Number(l.actualValue || 0), 0);

      const investment = parseBudget(c.budget, c.investmentSpent);
      const crmConversionRate = crmLeadsCount > 0 ? (crmCustomersCount / crmLeadsCount) * 100 : 0;
      const crmCpl = crmLeadsCount > 0 && investment > 0 ? investment / crmLeadsCount : null;
      const crmCac = crmCustomersCount > 0 && investment > 0 ? investment / crmCustomersCount : null;
      const crmRoas = investment > 0 ? crmRevenue / investment : null;

      // Manual metrics entered on campaign
      const manualLeads = c.leads !== null && c.leads !== undefined ? c.leads : null;
      const manualRevenue = c.revenueGenerated !== null && c.revenueGenerated !== undefined ? c.revenueGenerated : null;

      const hasDiscrepancy = manualLeads !== null && manualLeads !== crmLeadsCount;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        investment,
        crm: {
          leads: crmLeadsCount,
          customers: crmCustomersCount,
          conversionRate: crmConversionRate,
          revenue: crmRevenue,
          cpl: crmCpl,
          cac: crmCac,
          roas: crmRoas,
        },
        manual: {
          leads: manualLeads,
          revenue: manualRevenue,
        },
        hasDiscrepancy,
      };
    });

    // Lead Channels / Sources
    const sourceCounts: Record<string, { leads: number; customers: number; revenue: number; potential: number }> = {};
    allBusinessLeads.forEach(l => {
      const src = l.source || 'Outros';
      if (!sourceCounts[src]) {
        sourceCounts[src] = { leads: 0, customers: 0, revenue: 0, potential: 0 };
      }
      sourceCounts[src].leads++;
      if (l.status === 'customer') {
        sourceCounts[src].customers++;
        sourceCounts[src].revenue += Number(l.actualValue || 0);
      } else if (l.status !== 'lost') {
        sourceCounts[src].potential += Number(l.potentialValue || 0);
      }
    });

    const channelPerformance = Object.entries(sourceCounts).map(([channel, data]) => ({
      channel,
      leads: data.leads,
      customers: data.customers,
      conversionRate: data.leads > 0 ? (data.customers / data.leads) * 100 : 0,
      revenue: data.revenue,
      potentialValue: data.potential,
    })).sort((a, b) => b.leads - a.leads);

    // Content Calendar Execution
    const allContent = await db.select()
      .from(contentItems)
      .where(eq(contentItems.businessId, businessId as string));

    const plannedContentCount = allContent.length;
    const publishedContentCount = allContent.filter(c => c.status === 'published').length;
    const executionPercentage = plannedContentCount > 0 ? (publishedContentCount / plannedContentCount) * 100 : 0;

    const channelContentDistribution: Record<string, number> = {};
    allContent.forEach(c => {
      const ch = c.channel || 'Outros';
      channelContentDistribution[ch] = (channelContentDistribution[ch] || 0) + 1;
    });

    // Time Series Data (Daily Breakdown for charts)
    const timelineMap: Record<string, { date: string; leads: number; customers: number; revenue: number }> = {};
    const currDay = new Date(startDate);
    while (currDay <= endDate) {
      const dateKey = currDay.toISOString().split('T')[0];
      timelineMap[dateKey] = { date: dateKey, leads: 0, customers: 0, revenue: 0 };
      currDay.setDate(currDay.getDate() + 1);
    }

    currentLeads.forEach(l => {
      if (l.createdAt) {
        const dateKey = new Date(l.createdAt).toISOString().split('T')[0];
        if (timelineMap[dateKey]) {
          timelineMap[dateKey].leads++;
        }
      }
    });

    convertedInPeriod.forEach(l => {
      if (l.convertedAt) {
        const dateKey = new Date(l.convertedAt).toISOString().split('T')[0];
        if (timelineMap[dateKey]) {
          timelineMap[dateKey].customers++;
          timelineMap[dateKey].revenue += Number(l.actualValue || 0);
        }
      }
    });

    const timeline = Object.values(timelineMap);

    res.json({
      period,
      startDate,
      endDate,
      overview: {
        totalLeads,
        totalCustomers,
        conversionRate,
        attributedRevenue,
        potentialPipelineValue,
        totalInvestment,
        cpl,
        cac,
        roas,
        changes,
      },
      pipeline: {
        stages: pipelineByStage,
        avgConversionTimeDays,
      },
      lostReasons,
      campaigns: campaignsPerformance,
      channels: channelPerformance,
      contentExecution: {
        planned: plannedContentCount,
        published: publishedContentCount,
        percentage: executionPercentage,
        distribution: channelContentDistribution,
      },
      timeline,
    });
  } catch (error: any) {
    console.error("Analytics Overview Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch analytics" });
  }
});

// 2. GET /api/analytics/export — CSV Export
analyticsRouter.get("/export", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId, period = '30d' } = req.query;

  try {
    const allLeads = await db.select()
      .from(leads)
      .where(eq(leads.businessId, businessId as string));

    let csvContent = "ID,Nome,Empresa,Email,Telefone,Status,Origem,Valor Potencial (R$),Valor Real (R$),Data Criacao,Data Conversao\n";

    allLeads.forEach(l => {
      const name = `"${(l.name || '').replace(/"/g, '""')}"`;
      const company = `"${(l.companyName || '').replace(/"/g, '""')}"`;
      const email = `"${(l.email || '').replace(/"/g, '""')}"`;
      const phone = `"${(l.phone || '').replace(/"/g, '""')}"`;
      const created = l.createdAt ? new Date(l.createdAt).toISOString() : '';
      const converted = l.convertedAt ? new Date(l.convertedAt).toISOString() : '';

      csvContent += `${l.id},${name},${company},${email},${phone},${l.status},${l.source},${l.potentialValue || 0},${l.actualValue || 0},${created},${converted}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=analytics_export_${businessId}_${period}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error("Analytics Export Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/analytics/insights — Analytical AI Insights
analyticsRouter.get("/insights", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId, period = '30d' } = req.query;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        insights: [
          {
            title: "Foco no Fechamento de Propostas",
            observation: "O pipeline possui propostas em aberto com bom valor potencial.",
            recommended_action: "Priorize o follow-up direto com os tomadores de decisão.",
            confidence: "high"
          }
        ]
      });
    }

    const businessLeads = await db.select()
      .from(leads)
      .where(eq(leads.businessId, businessId as string));

    const totalLeads = businessLeads.length;
    const customers = businessLeads.filter(l => l.status === 'customer').length;
    const revenue = businessLeads
      .filter(l => l.status === 'customer')
      .reduce((sum, l) => sum + Number(l.actualValue || 0), 0);

    const aggregated = {
      period,
      totalLeads,
      convertedCustomers: customers,
      attributedRevenue: revenue,
      sources: Array.from(new Set(businessLeads.map(l => l.source)))
    };

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const prompt = `Você é um analista de inteligência de marketing e vendas.
Analise estes dados AGREGADOS:
${JSON.stringify(aggregated, null, 2)}

Forneça até 3 insights analíticos no seguinte schema JSON estrito:
{
  "insights": [
    {
      "title": "Título curto",
      "observation": "Observação baseada nos dados",
      "recommended_action": "Ação prática recomendada",
      "confidence": "high"
    }
  ]
}

Regras:
1. NUNCA invente causalidades não comprovadas (ex: "Canal X gerou aumento de 20% nas vendas").
2. Seja totalmente factual e objetivo.
3. Idioma: Português do Brasil.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || '{"insights": []}');
    res.json(parsed);
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota exceeded')) {
      console.warn("AI Insights Rate Limit (429) hit, returning default analytics insights.");
      return res.json({
        insights: [
          {
            title: "Desempenho Comercial",
            observation: "O fluxo de prospecção e leads está ativo no sistema.",
            recommended_action: "Acompanhe periodicamente as oportunidades e o engajamento com contatos prospectados.",
            confidence: "medium"
          }
        ]
      });
    }
    console.error("AI Insights Error:", error);
    res.status(500).json({ error: error.message });
  }
});
