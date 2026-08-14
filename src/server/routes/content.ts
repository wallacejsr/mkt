import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { db } from '../../db/index';
import { contentItems, strategies, businesses, products, targetAudiences } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { aiService } from '../services/AIService';

export const contentRouter = Router();

// Middleware to ensure user has access to the business
async function verifyBusinessAccess(req: AuthRequest, businessId: string) {
  const business = await db.select().from(businesses).where(eq(businesses.id, businessId)).then(r => r[0]);
  if (!business) throw new Error("Business not found");
  // Assuming user context has org mapping, or we just trust the token for now since requireAuth handles session.
  // Proper org validation should be here if we had org memberships in req.user
  return business;
}

async function getStrategyDetails(businessId: string) {
  const strat = await db.select().from(strategies).where(and(eq(strategies.businessId, businessId), eq(strategies.isActive, true))).orderBy(desc(strategies.createdAt)).limit(1).then(r => r[0]);
  const prods = await db.select().from(products).where(eq(products.businessId, businessId));
  const audiences = await db.select().from(targetAudiences).where(eq(targetAudiences.businessId, businessId));
  
  return {
    strategy: strat || {},
    products: prods || [],
    audience: audiences[0] || {}
  };
}

// List content items
contentRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: "Missing businessId" });
    
    await verifyBusinessAccess(req, businessId);

    const items = await db.select().from(contentItems)
      .where(eq(contentItems.businessId, businessId))
      .orderBy(desc(contentItems.scheduledDate));
      
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's content for dashboard
contentRouter.get('/today', requireAuth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: "Missing businessId" });
    
    await verifyBusinessAccess(req, businessId);

    const todayStr = new Date().toISOString().split('T')[0];
    
    const items = await db.select().from(contentItems)
      .where(and(
        eq(contentItems.businessId, businessId),
        eq(contentItems.scheduledDate, todayStr)
      ));
      
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single content item
contentRouter.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await db.select().from(contentItems).where(eq(contentItems.id, req.params.id)).then(r => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    
    await verifyBusinessAccess(req, item.businessId);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create content item (manual)
contentRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { businessId, ...data } = req.body;
    const business = await verifyBusinessAccess(req, businessId);
    
    const strat = await db.select().from(strategies).where(and(eq(strategies.businessId, businessId), eq(strategies.isActive, true))).orderBy(desc(strategies.createdAt)).limit(1).then(r => r[0]);

    const item = await db.insert(contentItems).values({
      organizationId: business.organizationId,
      businessId,
      strategyId: strat?.id,
      title: data.title || "Novo Conteúdo",
      topic: data.topic,
      channel: data.channel,
      format: data.format,
      funnelStage: data.funnelStage,
      objective: data.objective,
      scheduledDate: data.scheduledDate,
      status: data.status || 'idea'
    }).returning().then(r => r[0]);

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update content item
contentRouter.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await db.select().from(contentItems).where(eq(contentItems.id, req.params.id)).then(r => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    
    await verifyBusinessAccess(req, item.businessId);
    
    const updateData = { ...req.body, updatedAt: new Date() };
    if (updateData.status === 'published' && item.status !== 'published') {
      updateData.publishedAt = new Date();
    }

    const updated = await db.update(contentItems)
      .set(updateData)
      .where(eq(contentItems.id, req.params.id))
      .returning().then(r => r[0]);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Calendar
contentRouter.post('/generate-calendar', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { businessId, periodDays, frequencyDesc, channels, objective } = req.body;
    const business = await verifyBusinessAccess(req, businessId);
    const details = await getStrategyDetails(businessId);
    
    const itemsData = await aiService.generateContentCalendar(
      businessId, 
      business.organizationId, 
      { periodDays, frequencyDesc, channels, objective }, 
      details
    );
    
    const savedItems = [];
    for (const item of itemsData) {
      const saved = await db.insert(contentItems).values({
        organizationId: business.organizationId,
        businessId: businessId,
        strategyId: (details.strategy as any)?.id || null,
        title: item.title || item.topic || "Sem título",
        topic: item.topic || item.brief,
        channel: item.channel,
        format: item.format,
        funnelStage: item.funnel_stage,
        objective: item.objective,
        scheduledDate: item.scheduled_date,
        status: 'idea',
      }).returning().then(r => r[0]);
      savedItems.push(saved);
    }

    res.json({ success: true, items: savedItems });
  } catch (error: any) {
    console.error("Generate Calendar Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate Single Content
contentRouter.post('/:id/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await db.select().from(contentItems).where(eq(contentItems.id, req.params.id)).then(r => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    
    await verifyBusinessAccess(req, item.businessId);
    const details = await getStrategyDetails(item.businessId);

    const generated = await aiService.generateContentItem(
      item.organizationId,
      item.businessId,
      item,
      details
    );

    // Save generated content, update status to draft
    const updated = await db.update(contentItems).set({
      title: generated.title || item.title,
      hook: generated.hook,
      body: generated.body,
      caption: generated.caption,
      cta: generated.cta,
      hashtags: generated.hashtags || [],
      visualDirection: generated.visual_direction,
      videoScript: generated.video_script,
      status: 'draft',
      updatedAt: new Date()
    }).where(eq(contentItems.id, item.id)).returning().then(r => r[0]);

    res.json(updated);
  } catch (error: any) {
    console.error("Generate Content Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refine Content Text
contentRouter.post('/:id/refine', requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await db.select().from(contentItems).where(eq(contentItems.id, req.params.id)).then(r => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    
    await verifyBusinessAccess(req, item.businessId);

    const { field, currentText, instruction } = req.body;
    if (!field || !currentText || !instruction) return res.status(400).json({ error: "Missing parameters" });

    const refinedText = await aiService.refineContentText(item.organizationId, item.businessId, currentText, instruction);
    
    // We don't save immediately, we just return to frontend to preview
    res.json({ refinedText });
  } catch (error: any) {
    console.error("Refine Content Error:", error);
    res.status(500).json({ error: error.message });
  }
});
