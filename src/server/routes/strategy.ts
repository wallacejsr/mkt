import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { strategies, strategyChannels, strategyPlanWeeks, opportunities, goals, businesses } from '../../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { aiService } from '../services/AIService.ts';

export const strategyRouter = Router();

strategyRouter.get('/current', requireAuth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.query.businessId as string;
    
    // Get latest active strategy
    const activeStrategy = await db.select()
      .from(strategies)
      .where(eq(strategies.businessId, businessId))
      .orderBy(desc(strategies.createdAt))
      .limit(1)
      .then(r => r[0]);

    if (!activeStrategy) {
      return res.json({ strategy: null });
    }

    const channels = await db.select().from(strategyChannels).where(eq(strategyChannels.strategyId, activeStrategy.id));
    const planWeeks = await db.select().from(strategyPlanWeeks).where(eq(strategyPlanWeeks.strategyId, activeStrategy.id)).orderBy(strategyPlanWeeks.week);
    const opps = await db.select().from(opportunities).where(eq(opportunities.businessId, businessId));
    const activeGoals = await db.select().from(goals).where(eq(goals.businessId, businessId)).orderBy(desc(goals.createdAt)).limit(1);

    res.json({
      strategy: activeStrategy,
      channels,
      planWeeks,
      opportunities: opps,
      goal: activeGoals[0] || null
    });
  } catch (error: any) {
    console.error("Fetch Strategy Error:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

strategyRouter.post('/regenerate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { businessId, orgId } = req.body;
    
    // Disable old ones
    await db.update(strategies)
      .set({ isActive: false })
      .where(eq(strategies.businessId, businessId));
      
    // Call AI to generate new
    await aiService.generateInitialStrategy(businessId, orgId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Regenerate Strategy Error:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});
