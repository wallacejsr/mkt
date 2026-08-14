import express from "express";
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getOrCreateUserAndBusiness } from '../db/users.ts';
import { onboardingRouter } from './routes/onboarding.ts';
import { strategyRouter } from './routes/strategy.ts';
import { contentRouter } from './routes/content.ts';
import { campaignRouter } from './routes/campaigns.ts';
import { leadsRouter } from './routes/leads.ts';
import { recommendationsRouter } from './routes/recommendations.ts';
import { analyticsRouter } from './routes/analytics.ts';
import { prospectingRouter } from './routes/prospecting.ts';

export const app = express();

app.use(express.json());

// API ROUTES
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No user" });
    const { user, business } = await getOrCreateUserAndBusiness(req.user.uid, req.user.email || '');
    res.json({ user, business });
  } catch (error: any) {
    console.error("Failed to sync user:", error);
    res.status(500).json({ error: error.message || "Failed to sync user" });
  }
});

app.use('/api/onboarding', onboardingRouter);
app.use('/api/strategy', strategyRouter);
app.use('/api/content', contentRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/prospecting', prospectingRouter);

// Catch-all for API routes so Vite/SPA doesn't return HTML on non-existent endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: "API Route not found: " + req.method + " " + req.url });
});
