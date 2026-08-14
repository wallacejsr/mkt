import { Router } from "express";
import { db } from "../../db/index";
import { recommendations, businesses, users } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { RecommendationEngine } from "../services/RecommendationEngine";

export const recommendationsRouter = Router();

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

// 1. GET /api/recommendations — Evaluates & returns recommendations list
recommendationsRouter.get("/", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId, category, priority, status } = req.query;

  try {
    // Run evaluator first (syncs DB)
    await RecommendationEngine.evaluateBusiness(businessId as string);

    const conditions: any[] = [eq(recommendations.businessId, businessId as string)];

    if (status) {
      conditions.push(eq(recommendations.status, status as string));
    } else {
      conditions.push(eq(recommendations.status, 'active'));
    }

    if (category && category !== 'all') {
      conditions.push(eq(recommendations.category, category as string));
    }

    if (priority && priority !== 'all') {
      conditions.push(eq(recommendations.priority, priority as string));
    }

    const list = await db.select()
      .from(recommendations)
      .where(and(...conditions))
      .orderBy(desc(recommendations.priorityScore), desc(recommendations.createdAt));

    res.json(list);
  } catch (error: any) {
    console.error("Fetch Recommendations Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch recommendations" });
  }
});

// 2. GET /api/recommendations/summary — Category counters
recommendationsRouter.get("/summary", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;

  try {
    await RecommendationEngine.evaluateBusiness(businessId as string);

    const activeList = await db.select()
      .from(recommendations)
      .where(and(eq(recommendations.businessId, businessId as string), eq(recommendations.status, 'active')));

    let attentionNeeded = 0; // high or critical priority
    let opportunities = 0;  // category opportunity or impact high
    let contentCount = 0;
    let campaignCount = 0;
    let salesCount = 0;

    for (const item of activeList) {
      if (item.priority === 'critical' || item.priority === 'high') {
        attentionNeeded++;
      }
      if (item.category === 'opportunity') {
        opportunities++;
      } else if (item.category === 'content') {
        contentCount++;
      } else if (item.category === 'campaign') {
        campaignCount++;
      } else if (item.category === 'sales') {
        salesCount++;
      }
    }

    res.json({
      totalActive: activeList.length,
      attentionNeeded,
      opportunities,
      contentCount,
      campaignCount,
      salesCount,
    });
  } catch (error: any) {
    console.error("Summary Recommendations Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/recommendations/:id/dismiss — Dismiss recommendation
recommendationsRouter.post("/:id/dismiss", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;

  try {
    const existing = await db.query.recommendations.findFirst({
      where: and(eq(recommendations.id, id), eq(recommendations.businessId, businessId as string))
    });

    if (!existing) return res.status(404).json({ error: "Recommendation not found" });

    await db.update(recommendations)
      .set({
        status: 'dismissed',
        dismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(recommendations.id, id));

    res.json({ success: true, status: 'dismissed' });
  } catch (error: any) {
    console.error("Dismiss Recommendation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. POST /api/recommendations/:id/complete — Complete recommendation
recommendationsRouter.post("/:id/complete", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;

  try {
    const existing = await db.query.recommendations.findFirst({
      where: and(eq(recommendations.id, id), eq(recommendations.businessId, businessId as string))
    });

    if (!existing) return res.status(404).json({ error: "Recommendation not found" });

    await db.update(recommendations)
      .set({
        status: 'completed',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(recommendations.id, id));

    res.json({ success: true, status: 'completed' });
  } catch (error: any) {
    console.error("Complete Recommendation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. GET /api/recommendations/insights — Optional AI Strategic Insights
recommendationsRouter.get("/insights", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;

  try {
    const insights = await RecommendationEngine.generateStrategicInsights(businessId as string);
    res.json({ insights });
  } catch (error: any) {
    console.error("Generate Insights Error:", error);
    res.status(500).json({ error: error.message });
  }
});
