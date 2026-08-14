import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { db } from '../../db/index';
import { businesses, products, targetAudiences, marketingProfiles, goals, users, organizationMembers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { aiService } from '../services/AIService';

export const onboardingRouter = Router();

onboardingRouter.post('/complete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { businessId, company, productsList, audience, marketing, objective } = req.body;
    
    // Validate access
    const business = await db.select().from(businesses).where(eq(businesses.id, businessId)).then(r => r[0]);
    if (!business) {
      return res.status(404).json({ error: "Negócio não encontrado." });
    }

    const user = await db.select().from(users).where(eq(users.uid, req.user!.uid)).then(r => r[0]);
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    const membership = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, user.id)).then(r => r[0]);
    if (!membership || membership.organizationId !== business.organizationId) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const orgId = business.organizationId;

    await db.transaction(async (tx) => {
      // 1. Update business
      await tx.update(businesses).set({
        segment: company.segment,
        description: company.description,
        city: company.city,
        state: company.state,
        website: company.website,
        instagram: company.instagram,
        whatsapp: company.whatsapp,
        serviceArea: company.serviceArea,
        serviceType: company.serviceType,
      }).where(eq(businesses.id, businessId));

      // 2. Insert products
      for (const p of productsList) {
        await tx.insert(products).values({
          businessId,
          name: p.name,
          type: p.type,
          description: p.description,
          price: p.price,
          ticketValue: p.ticketValue,
          mainBenefit: p.mainBenefit,
          differentiators: p.differentiators,
          idealCustomer: p.idealCustomer,
        });
      }

      // 3. Insert audience
      await tx.insert(targetAudiences).values({
        businessId,
        description: audience.description,
        ageRange: audience.ageRange,
        location: audience.location,
        profile: audience.profile,
        pains: audience.pains || [],
        desires: audience.desires || [],
        objections: audience.objections || [],
        decisionFactors: audience.decisionFactors,
      });

      // 4. Insert marketing
      await tx.insert(marketingProfiles).values({
        businessId,
        channels: marketing.channels || [],
        postFrequency: marketing.postFrequency,
        monthlyInvestment: marketing.monthlyInvestment,
        monthlyLeads: marketing.monthlyLeads,
        monthlySales: marketing.monthlySales,
        mainDifficulty: marketing.mainDifficulty,
      });

      // 5. Insert goal
      await tx.insert(goals).values({
        businessId,
        goalType: objective.goalType,
        targetMetric: objective.targetMetric,
        timeframe: objective.timeframe,
      });
    });

    // 6. Call AI Strategy Generator
    await aiService.generateInitialStrategy(businessId, orgId);

    // 7. Mark onboarding complete
    await db.update(businesses).set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date()
    }).where(eq(businesses.id, businessId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Onboarding Error:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});
