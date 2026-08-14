import { Router } from "express";
import { db } from "../../db";
import { 
  campaigns, 
  campaignAssets, 
  campaignChannels, 
  campaignTasks,
  contentItems,
  businesses,
  products,
  targetAudiences,
  strategies,
  users
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { aiService } from "../services/AIService";

export const campaignRouter = Router();

// Middleware to ensure business ownership
const ensureBusinessOwnership = async (req: any, res: any, next: any) => {
  const { businessId } = req.query;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId" });
  
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
  next();
};

// --- Campaigns CRUD ---

campaignRouter.get("/", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;
  try {
    const list = await db.query.campaigns.findMany({
      where: eq(campaigns.businessId, businessId as string),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      with: {
        channels: true
      }
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

campaignRouter.get("/:id", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;

  try {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.businessId, businessId as string)),
      with: {
        channels: true,
        assets: true,
        tasks: true,
        product: true
      }
    });

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

campaignRouter.put("/:id", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const data = req.body;

  try {
    const updated = await db.update(campaigns)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.businessId, businessId as string)))
      .returning();
      
    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Campaign Generation via AI ---
campaignRouter.post("/generate", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const setupData = req.body;

  try {
    // Collect Context
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId as string),
      with: {
        products: true,
        targetAudiences: true,
        strategies: {
          where: eq(strategies.isActive, true)
        }
      }
    });

    const activeStrategy = business?.strategies?.[0] || null;
    let selectedProduct = null;
    if (setupData.productId) {
      selectedProduct = business?.products.find(p => p.id === setupData.productId);
    }

    const contextData = {
      businessInfo: business,
      product: selectedProduct,
      audience: setupData.customAudience || business?.targetAudiences?.[0],
      strategy: activeStrategy
    };

    const result = await aiService.generateCampaign(businessId as string, orgId, setupData, contextData);

    // Save to DB
    const newCampaign = await db.transaction(async (tx) => {
      const camp = await tx.insert(campaigns).values({
        organizationId: orgId,
        businessId: businessId as string,
        strategyId: activeStrategy?.id,
        productId: setupData.productId || null,
        name: result.campaign_name || setupData.name || 'Nova Campanha',
        objective: setupData.objective,
        description: result.campaign_summary,
        targetAudience: result.target_audience,
        offer: result.offer,
        mainArgument: result.main_argument,
        messaging: result.messaging,
        budget: setupData.budget,
        startDate: setupData.startDate,
        endDate: setupData.endDate,
        status: 'draft',
      }).returning().then(r => r[0]);

      if (setupData.channels && Array.isArray(setupData.channels)) {
        for (const ch of setupData.channels) {
          await tx.insert(campaignChannels).values({
            campaignId: camp.id,
            channel: ch,
          });
        }
      }

      if (result.plan_actions && Array.isArray(result.plan_actions)) {
        for (const action of result.plan_actions) {
          await tx.insert(campaignTasks).values({
            campaignId: camp.id,
            title: action,
            status: 'todo'
          });
        }
      }

      return camp;
    });

    res.json(newCampaign);
  } catch (error: any) {
    console.error("Generate Campaign Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Asset Generation ---
campaignRouter.post("/:id/assets/generate", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const { assetType } = req.body;

  try {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.businessId, businessId as string)),
      with: { product: true }
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const business = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId as string),
      with: { targetAudiences: true }
    });

    const contextData = {
      product: campaign.product,
      audience: campaign.targetAudience || business?.targetAudiences?.[0],
    };

    const assetContent = await aiService.generateCampaignAsset(orgId, businessId as string, assetType, campaign, contextData);

    let title = "Novo Material";
    if (assetType === 'landing_page') title = 'Landing Page';
    else if (assetType === 'email') title = 'E-mail Marketing';
    else if (assetType === 'whatsapp') title = 'Sequência de WhatsApp';
    else if (assetType === 'creative_brief') title = 'Briefing de Criativo';
    else if (assetType === 'ad') title = 'Variações de Anúncio';
    else if (assetType === 'social_post') title = 'Variações de Post';

    const newAsset = await db.insert(campaignAssets).values({
      campaignId: campaign.id,
      type: assetType,
      title: title,
      content: assetContent,
      status: 'draft'
    }).returning().then(r => r[0]);

    res.json(newAsset);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Refine Asset ---
campaignRouter.post("/:id/assets/:assetId/refine", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id, assetId } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const { currentText, instruction, fieldPath } = req.body;

  try {
    const refinedText = await aiService.refineContentText(orgId, businessId as string, currentText, instruction);
    // Ideally we'd update the specific field in JSON, but to keep it simple, we just return it to the frontend to patch and save via PUT
    res.json({ refined_text: refinedText, fieldPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Asset
campaignRouter.put("/:id/assets/:assetId", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id, assetId } = req.params;
  const data = req.body;

  try {
    const updated = await db.update(campaignAssets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, id)))
      .returning();
    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Asset to Content Item ---
campaignRouter.post("/:id/assets/:assetId/to-content", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id, assetId } = req.params;
  const { businessId } = req.query;
  const { date, channel, format } = req.body;
  const orgId = req.business.organizationId;

  try {
    const asset = await db.query.campaignAssets.findFirst({
      where: and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, id))
    });
    
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    // Transform asset to content item structure
    let bodyText = "";
    if (asset.type === 'email' && asset.content) {
      bodyText = (asset.content as any).body || "";
    } else if (asset.type === 'whatsapp' && asset.content) {
      bodyText = (asset.content as any).initial_message || "";
    } else {
      bodyText = JSON.stringify(asset.content, null, 2);
    }

    const newItem = await db.insert(contentItems).values({
      organizationId: orgId,
      businessId: businessId as string,
      campaignId: id,
      title: asset.title,
      topic: 'Criado via Campanha',
      channel: channel,
      format: format,
      scheduledDate: date,
      status: 'draft',
      body: bodyText,
      generationContext: asset.content
    }).returning().then(r => r[0]);

    res.json(newItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Tasks ---
campaignRouter.post("/:id/tasks", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const task = await db.insert(campaignTasks).values({
      campaignId: id,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: data.status || 'todo'
    }).returning().then(r => r[0]);
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

campaignRouter.put("/:id/tasks/:taskId", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id, taskId } = req.params;
  const data = req.body;
  try {
    const task = await db.update(campaignTasks)
      .set(data)
      .where(and(eq(campaignTasks.id, taskId), eq(campaignTasks.campaignId, id)))
      .returning().then(r => r[0]);
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Task
campaignRouter.delete("/:id/tasks/:taskId", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  const { id, taskId } = req.params;
  try {
    await db.delete(campaignTasks)
      .where(and(eq(campaignTasks.id, taskId), eq(campaignTasks.campaignId, id)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
