import { Router } from "express";
import { db } from "../../db/index";
import { leads, leadActivities, businesses, users, campaigns, products } from "../../db/schema";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { RecommendationEngine } from "../services/RecommendationEngine";

export const leadsRouter = Router();

// Middleware to ensure business ownership
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

// 1. GET /api/leads — Filterable list
leadsRouter.get("/", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId, status, source, campaignId, productId, search } = req.query;

  try {
    const conditions: any[] = [eq(leads.businessId, businessId as string)];

    if (status) {
      conditions.push(eq(leads.status, status as string));
    }
    if (source) {
      conditions.push(eq(leads.source, source as string));
    }
    if (campaignId) {
      conditions.push(eq(leads.campaignId, campaignId as string));
    }
    if (productId) {
      conditions.push(eq(leads.productId, productId as string));
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(leads.name, pattern),
          ilike(leads.companyName, pattern),
          ilike(leads.email, pattern),
          ilike(leads.phone, pattern)
        )
      );
    }

    const list = await db.query.leads.findMany({
      where: and(...conditions),
      orderBy: [desc(leads.createdAt)],
      with: {
        campaign: {
          columns: {
            id: true,
            name: true,
          }
        },
        product: {
          columns: {
            id: true,
            name: true,
          }
        },
        responsibleUser: {
          columns: {
            id: true,
            email: true,
          }
        }
      }
    });

    res.json(list);
  } catch (error: any) {
    console.error("Fetch Leads Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch leads" });
  }
});

// 2. GET /api/leads/summary — Top level metrics
leadsRouter.get("/summary", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;

  try {
    const allLeads = await db.select()
      .from(leads)
      .where(eq(leads.businessId, businessId as string));

    let total = allLeads.length;
    let newCount = 0;
    let contactedCount = 0;
    let interestedCount = 0;
    let proposalCount = 0;
    let customerCount = 0;
    let lostCount = 0;
    let totalPotentialValue = 0;
    let totalActualValue = 0;

    for (const l of allLeads) {
      if (l.status === 'new') newCount++;
      else if (l.status === 'contacted') contactedCount++;
      else if (l.status === 'interested') interestedCount++;
      else if (l.status === 'proposal') proposalCount++;
      else if (l.status === 'customer') {
        customerCount++;
        if (l.actualValue) totalActualValue += l.actualValue;
      }
      else if (l.status === 'lost') lostCount++;

      if (l.potentialValue && l.status !== 'lost') {
        totalPotentialValue += l.potentialValue;
      }
    }

    const inNegotiationCount = contactedCount + interestedCount + proposalCount;

    res.json({
      total,
      newCount,
      contactedCount,
      interestedCount,
      proposalCount,
      inNegotiationCount,
      customerCount,
      lostCount,
      totalPotentialValue,
      totalActualValue,
    });
  } catch (error: any) {
    console.error("Lead Summary Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/leads/recommendations — Recommendation engine alerts
leadsRouter.get("/recommendations", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;

  try {
    const alerts = await RecommendationEngine.evaluateBusiness(businessId as string);
    res.json(alerts);
  } catch (error: any) {
    console.error("Lead Recommendations Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. GET /api/leads/campaign-metrics/:campaignId — CRM calculated campaign results
leadsRouter.get("/campaign-metrics/:campaignId", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { campaignId } = req.params;
  const { businessId } = req.query;

  try {
    const campaignLeads = await db.select()
      .from(leads)
      .where(
        and(
          eq(leads.businessId, businessId as string),
          eq(leads.campaignId, campaignId)
        )
      );

    const totalGenerated = campaignLeads.length;
    const customers = campaignLeads.filter(l => l.status === 'customer');
    const customerCount = customers.length;
    const conversionRate = totalGenerated > 0 ? ((customerCount / totalGenerated) * 100).toFixed(1) : "0.0";
    
    let totalPotentialValue = 0;
    let attributedRevenue = 0;

    for (const l of campaignLeads) {
      if (l.potentialValue && l.status !== 'lost') {
        totalPotentialValue += l.potentialValue;
      }
      if (l.status === 'customer' && l.actualValue) {
        attributedRevenue += l.actualValue;
      }
    }

    res.json({
      totalGenerated,
      customerCount,
      conversionRate: parseFloat(conversionRate),
      totalPotentialValue,
      attributedRevenue,
    });
  } catch (error: any) {
    console.error("Campaign Lead Metrics Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. GET /api/leads/:id — Lead details + activity timeline
leadsRouter.get("/:id", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;

  try {
    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, id), eq(leads.businessId, businessId as string)),
      with: {
        campaign: true,
        product: true,
        responsibleUser: true,
      }
    });

    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const activities = await db.query.leadActivities.findMany({
      where: eq(leadActivities.leadId, id),
      orderBy: [desc(leadActivities.createdAt)],
      with: {
        user: true,
      }
    });

    res.json({ lead, activities });
  } catch (error: any) {
    console.error("Lead Detail Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 6. POST /api/leads — Create new lead
leadsRouter.post("/", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const userId = req.dbUser.id;
  const body = req.body;

  if (!body.name || body.name.trim() === '') {
    return res.status(400).json({ error: "O nome do lead é obrigatório." });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const newLead = await tx.insert(leads).values({
        organizationId: orgId,
        businessId: businessId as string,
        campaignId: body.campaignId || null,
        productId: body.productId || null,
        name: body.name.trim(),
        companyName: body.companyName ? body.companyName.trim() : null,
        email: body.email ? body.email.trim() : null,
        phone: body.phone ? body.phone.trim() : null,
        source: body.source || 'Manual',
        status: body.status || 'new',
        potentialValue: body.potentialValue ? parseInt(body.potentialValue, 10) : null,
        notes: body.notes ? body.notes.trim() : null,
        nextAction: body.nextAction ? body.nextAction.trim() : null,
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
        responsibleUserId: body.responsibleUserId || userId,
      }).returning().then(r => r[0]);

      // Record 'created' activity
      await tx.insert(leadActivities).values({
        organizationId: orgId,
        businessId: businessId as string,
        leadId: newLead.id,
        userId: userId,
        type: 'created',
        description: `Lead criado via ${newLead.source}`,
        metadata: { source: newLead.source }
      });

      // If initial note was provided
      if (body.notes && body.notes.trim() !== '') {
        await tx.insert(leadActivities).values({
          organizationId: orgId,
          businessId: businessId as string,
          leadId: newLead.id,
          userId: userId,
          type: 'note',
          description: `Observação inicial: ${body.notes.trim()}`
        });
      }

      return newLead;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create Lead Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 7. PUT /api/leads/:id — Update lead fields
leadsRouter.put("/:id", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const body = req.body;

  try {
    const existing = await db.query.leads.findFirst({
      where: and(eq(leads.id, id), eq(leads.businessId, businessId as string))
    });

    if (!existing) return res.status(404).json({ error: "Lead not found" });

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.companyName !== undefined) updateData.companyName = body.companyName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.campaignId !== undefined) updateData.campaignId = body.campaignId || null;
    if (body.productId !== undefined) updateData.productId = body.productId || null;
    if (body.potentialValue !== undefined) updateData.potentialValue = body.potentialValue ? parseInt(body.potentialValue, 10) : null;
    if (body.actualValue !== undefined) updateData.actualValue = body.actualValue ? parseInt(body.actualValue, 10) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.nextAction !== undefined) updateData.nextAction = body.nextAction;
    if (body.nextActionAt !== undefined) updateData.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;

    const updated = await db.update(leads)
      .set(updateData)
      .where(and(eq(leads.id, id), eq(leads.businessId, businessId as string)))
      .returning().then(r => r[0]);

    res.json(updated);
  } catch (error: any) {
    console.error("Update Lead Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 8. PATCH /api/leads/:id/status — Kanban drag and drop / status transition
leadsRouter.patch("/:id/status", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const userId = req.dbUser.id;
  const { newStatus, lostReason, actualValue } = req.body;

  const validStatuses = ['new', 'contacted', 'interested', 'proposal', 'customer', 'lost'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  const statusLabels: Record<string, string> = {
    new: 'Novo',
    contacted: 'Contatado',
    interested: 'Interessado',
    proposal: 'Proposta',
    customer: 'Cliente',
    lost: 'Perdido',
  };

  try {
    const existing = await db.query.leads.findFirst({
      where: and(eq(leads.id, id), eq(leads.businessId, businessId as string))
    });

    if (!existing) return res.status(404).json({ error: "Lead not found" });

    const oldStatusLabel = statusLabels[existing.status] || existing.status;
    const newStatusLabel = statusLabels[newStatus] || newStatus;

    const updateFields: any = {
      status: newStatus,
      updatedAt: new Date(),
    };

    let activityType = 'status_change';
    let activityDesc = `Status alterado de "${oldStatusLabel}" para "${newStatusLabel}"`;

    if (newStatus === 'customer') {
      updateFields.convertedAt = new Date();
      if (actualValue !== undefined && actualValue !== null) {
        updateFields.actualValue = parseInt(actualValue, 10);
      }
      activityType = 'conversion';
      activityDesc = `Lead convertido em Cliente! Valor da venda: R$ ${actualValue || existing.potentialValue || 0}`;
    } else if (newStatus === 'lost') {
      updateFields.lostAt = new Date();
      updateFields.lostReason = lostReason || 'Motivo não informado';
      activityType = 'lost';
      activityDesc = `Lead marcado como Perdido. Motivo: ${updateFields.lostReason}`;
    }

    const updated = await db.transaction(async (tx) => {
      const resLead = await tx.update(leads)
        .set(updateFields)
        .where(and(eq(leads.id, id), eq(leads.businessId, businessId as string)))
        .returning().then(r => r[0]);

      await tx.insert(leadActivities).values({
        organizationId: orgId,
        businessId: businessId as string,
        leadId: id,
        userId: userId,
        type: activityType,
        description: activityDesc,
        metadata: {
          fromStatus: existing.status,
          toStatus: newStatus,
          lostReason: lostReason || null,
          actualValue: actualValue || null,
        }
      });

      return resLead;
    });

    res.json(updated);
  } catch (error: any) {
    console.error("Update Lead Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 9. POST /api/leads/:id/activities — Register contact or note
leadsRouter.post("/:id/activities", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const userId = req.dbUser.id;
  const { type, contactChannel, notes, nextAction, nextActionAt } = req.body;

  try {
    const existing = await db.query.leads.findFirst({
      where: and(eq(leads.id, id), eq(leads.businessId, businessId as string))
    });

    if (!existing) return res.status(404).json({ error: "Lead não encontrado" });

    const now = new Date();
    const updateLeadFields: any = {
      updatedAt: now,
    };

    let activityType = type || 'contact';
    let activityDesc = '';

    if (type === 'contact') {
      updateLeadFields.lastContactAt = now;
      const channelLabel = contactChannel || 'Contato';
      activityDesc = `Contato realizado via ${channelLabel}${notes ? `: ${notes}` : ''}`;
    } else if (type === 'note') {
      activityDesc = `Observação: ${notes || ''}`;
    } else {
      activityDesc = notes || 'Atividade registrada';
    }

    if (nextAction !== undefined) {
      updateLeadFields.nextAction = nextAction ? nextAction.trim() : null;
    }
    if (nextActionAt !== undefined) {
      updateLeadFields.nextActionAt = nextActionAt ? new Date(nextActionAt) : null;
    }

    const result = await db.transaction(async (tx) => {
      if (Object.keys(updateLeadFields).length > 0) {
        await tx.update(leads)
          .set(updateLeadFields)
          .where(and(eq(leads.id, id), eq(leads.businessId, businessId as string)));
      }

      const newActivity = await tx.insert(leadActivities).values({
        organizationId: orgId,
        businessId: businessId as string,
        leadId: id,
        userId: userId,
        type: activityType,
        description: activityDesc,
        metadata: {
          contactChannel: contactChannel || null,
          nextAction: nextAction || null,
          nextActionAt: nextActionAt || null,
        }
      }).returning().then(r => r[0]);

      return newActivity;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});
