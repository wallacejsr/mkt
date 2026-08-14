import express from "express";
import jwt from 'jsonwebtoken';
import { requireAuth, AuthRequest, JWT_SECRET_KEY } from '../middleware/auth.ts';
import { registerUserInDB, loginUserInDB, getUserById, getOrCreateUserAndBusiness } from '../db/users.ts';
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

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
    }

    const { user, business } = await registerUserInDB(name || '', email, password);
    const token = jwt.sign(
      { userId: user.id, uid: user.uid, email: user.email },
      JWT_SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({ token, user, business });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(400).json({ error: error.message || "Falha ao registrar usuário." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const { user, business } = await loginUserInDB(email, password);
    const token = jwt.sign(
      { userId: user.id, uid: user.uid, email: user.email },
      JWT_SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({ token, user, business });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(401).json({ error: error.message || "Falha ao realizar login." });
  }
});

app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Não autenticado." });
    const result = await getUserById(req.user.userId);
    if (!result) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(result);
  } catch (error: any) {
    console.error("Failed to get current user:", error);
    res.status(500).json({ error: error.message || "Erro no servidor." });
  }
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
