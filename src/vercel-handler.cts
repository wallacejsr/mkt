/**
 * Vercel Serverless Function Entry Point — 100% SELF-CONTAINED
 * 
 * This file does NOT import anything from src/server/ or src/db/.
 * All routes use raw SQL via the 'pg' package.
 * This eliminates ALL module-level initialization issues (drizzle, AIService, etc.)
 */
import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();

// ─── CORS + JSON ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json({ limit: '4mb' }));

// ─── Config ───────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'mkt-agro-bw-secret-key-2026';

function getDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  return url;
}

function createPool() {
  return new Pool({
    connectionString: getDbUrl(),
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000,
  });
}

// Helper: verify JWT and return decoded payload
function verifyToken(req: express.Request): { userId: string; uid: string; email: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.split('Bearer ')[1], JWT_SECRET) as any;
  } catch { return null; }
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  let hasDb = false;
  try { getDbUrl(); hasDb = true; } catch {}
  res.json({ ok: true, time: new Date().toISOString(), hasDb });
});

// ─── Login ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const pool = createPool();
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    const user = rows[0];
    if (!user?.password_hash) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    if (!await bcrypt.compare(String(password), user.password_hash)) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

    const member = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool.query('SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1', [member.rows[0].organization_id]);
      business = biz.rows[0] ?? null;
    }

    const token = jwt.sign({ userId: user.id, uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser, business });
  } catch (e: any) { console.error('[login]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Register ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const pool = createPool();
  try {
    const { name, email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

    const emailNorm = String(email).trim().toLowerCase();
    if ((await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm])).rows[0])
      return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });

    const hash = await bcrypt.hash(String(password), 10);
    const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const { rows: [newUser] } = await pool.query(
      'INSERT INTO users (uid, email, name, password_hash) VALUES ($1,$2,$3,$4) RETURNING *',
      [uid, emailNorm, name || '', hash]
    );
    const { rows: [org] } = await pool.query('INSERT INTO organizations (name) VALUES ($1) RETURNING *', [`Empresa de ${name || emailNorm.split('@')[0]}`]);
    await pool.query('INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1,$2,$3)', [newUser.id, org.id, 'owner']);
    const { rows: [business] } = await pool.query('INSERT INTO businesses (organization_id, name) VALUES ($1,$2) RETURNING *', [org.id, 'Negócio Principal']);

    const token = jwt.sign({ userId: newUser.id, uid: newUser.uid, email: newUser.email }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = newUser;
    res.json({ token, user: safeUser, business });
  } catch (e: any) { console.error('[register]', e.message); res.status(400).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [decoded.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const user = rows[0];

    const member = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool.query('SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1', [member.rows[0].organization_id]);
      business = biz.rows[0] ?? null;
    }
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, business });
  } catch (e: any) { console.error('[me]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/auth/sync', (_req, res) => res.json({ ok: true }));

// ─── Onboarding Complete ─────────────────────────────────────────────────────
app.post('/api/onboarding/complete', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });

    const { businessId, company, productsList, audience, marketing, objective } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId é obrigatório.' });

    // Update business
    await pool.query(`
      UPDATE businesses SET 
        segment=$1, description=$2, city=$3, state=$4, website=$5, 
        instagram=$6, whatsapp=$7, service_area=$8, service_type=$9,
        onboarding_completed=true, onboarding_completed_at=NOW()
      WHERE id=$10
    `, [
      company?.segment, company?.description, company?.city, company?.state,
      company?.website, company?.instagram, company?.whatsapp,
      company?.serviceArea, company?.serviceType, businessId
    ]);

    // Insert products
    if (productsList?.length) {
      for (const p of productsList) {
        await pool.query(
          'INSERT INTO products (business_id, name, type, description, price, ticket_value, main_benefit, differentiators, ideal_customer, is_main) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [businessId, p.name, p.type, p.description, p.price, p.ticketValue, p.mainBenefit, p.differentiators, p.idealCustomer, p.isMain || false]
        );
      }
    }

    // Insert audience
    if (audience) {
      await pool.query(
        'INSERT INTO target_audiences (business_id, description, age_range, location, profile, pains, desires, objections, decision_factors) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [businessId, audience.description, audience.ageRange, audience.location, audience.profile,
         JSON.stringify(audience.pains || []), JSON.stringify(audience.desires || []), JSON.stringify(audience.objections || []), audience.decisionFactors]
      );
    }

    // Insert marketing profile
    if (marketing) {
      await pool.query(
        'INSERT INTO marketing_profiles (business_id, channels, post_frequency, monthly_investment, monthly_leads, monthly_sales, main_difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [businessId, JSON.stringify(marketing.channels || []), marketing.postFrequency, marketing.monthlyInvestment, marketing.monthlyLeads, marketing.monthlySales, marketing.mainDifficulty]
      );
    }

    // Insert goal
    if (objective) {
      await pool.query(
        'INSERT INTO goals (business_id, goal_type, target_metric, timeframe) VALUES ($1,$2,$3,$4)',
        [businessId, objective.goalType, objective.targetMetric, objective.timeframe]
      );
    }

    // Try AI strategy generation (non-blocking, best-effort)
    let strategy = null;
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        
        const biz = (await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId])).rows[0];
        const prods = (await pool.query('SELECT * FROM products WHERE business_id = $1', [businessId])).rows;
        const auds = (await pool.query('SELECT * FROM target_audiences WHERE business_id = $1', [businessId])).rows;
        
        const prompt = `Você é um Gerente de Marketing Sênior. Analise esta empresa e crie uma estratégia:
Empresa: ${biz?.name} - ${biz?.segment}
Descrição: ${biz?.description}
Produtos: ${prods.map((p: any) => `${p.name} (${p.type})`).join(', ')}
Público: ${auds[0]?.profile || 'Não definido'}

Responda em JSON com: business_summary (string), positioning_statement (string), value_proposition (string), channels (array de strings com até 3 canais prioritários), opportunities (array de objetos {title, description, impact}).`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.7 }
        });
        
        const parsed = JSON.parse(response.text || '{}');
        
        // Save strategy
        const orgResult = await pool.query('SELECT organization_id FROM businesses WHERE id=$1', [businessId]);
        const orgId = orgResult.rows[0]?.organization_id;
        
        const stratResult = await pool.query(
          'INSERT INTO strategies (business_id, business_summary, positioning_statement, value_proposition) VALUES ($1,$2,$3,$4) RETURNING *',
          [businessId, parsed.business_summary, parsed.positioning_statement, parsed.value_proposition]
        );
        strategy = stratResult.rows[0];

        // Save AI generation log
        await pool.query(
          'INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output) VALUES ($1,$2,$3,$4,$5,$6)',
          [orgId, businessId, 'initial_strategy', 'gemini', 'gemini-2.5-flash', JSON.stringify(parsed)]
        );
      }
    } catch (aiErr: any) {
      console.error('[onboarding-ai]', aiErr.message);
      // AI failed but onboarding data is saved — that's OK
    }

    res.json({ success: true, strategy, message: strategy ? 'Onboarding completo com estratégia!' : 'Onboarding completo!' });
  } catch (e: any) { console.error('[onboarding]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Strategy ─────────────────────────────────────────────────────────────────
app.get('/api/strategy/current', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });

    const user = (await pool.query('SELECT id FROM users WHERE id=$1', [decoded.userId])).rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [user.id])).rows[0];
    if (!member) return res.status(404).json({ error: 'Sem organização.' });

    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.status(404).json({ error: 'Sem negócio.' });

    const strat = (await pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [biz.id])).rows[0];
    if (!strat) return res.json({ strategy: null });

    const channels = (await pool.query('SELECT * FROM strategy_channels WHERE strategy_id=$1 ORDER BY priority', [strat.id])).rows;
    const weeks = (await pool.query('SELECT * FROM strategy_plan_weeks WHERE strategy_id=$1 ORDER BY week', [strat.id])).rows;
    const opps = (await pool.query('SELECT * FROM opportunities WHERE business_id=$1', [biz.id])).rows;

    res.json({ strategy: { ...strat, channels, planWeeks: weeks, opportunities: opps } });
  } catch (e: any) { console.error('[strategy]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Content Items ────────────────────────────────────────────────────────────
app.get('/api/content', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const user = (await pool.query('SELECT id FROM users WHERE id=$1', [decoded.userId])).rows[0];
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [user?.id])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const items = (await pool.query('SELECT * FROM content_items WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows;
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
app.get('/api/campaigns', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const user = (await pool.query('SELECT id FROM users WHERE id=$1', [decoded.userId])).rows[0];
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [user?.id])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const items = (await pool.query('SELECT * FROM campaigns WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows;
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Leads ────────────────────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const user = (await pool.query('SELECT id FROM users WHERE id=$1', [decoded.userId])).rows[0];
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [user?.id])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const items = (await pool.query('SELECT * FROM leads WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows;
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Recommendations ──────────────────────────────────────────────────────────
app.get('/api/recommendations', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const user = (await pool.query('SELECT id FROM users WHERE id=$1', [decoded.userId])).rows[0];
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [user?.id])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const items = (await pool.query("SELECT * FROM recommendations WHERE business_id=$1 AND status='active' ORDER BY priority_score DESC", [biz.id])).rows;
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Analytics Summary ────────────────────────────────────────────────────────
app.get('/api/analytics/summary', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const user = (await pool.query('SELECT id FROM users WHERE id=$1', [decoded.userId])).rows[0];
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [user?.id])).rows[0];
    if (!member) return res.json({});
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json({});

    const totalLeads = (await pool.query('SELECT COUNT(*) as count FROM leads WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const totalCampaigns = (await pool.query('SELECT COUNT(*) as count FROM campaigns WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const totalContent = (await pool.query('SELECT COUNT(*) as count FROM content_items WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const conversions = (await pool.query("SELECT COUNT(*) as count FROM leads WHERE business_id=$1 AND status='customer'", [biz.id])).rows[0]?.count || 0;

    res.json({ totalLeads: Number(totalLeads), totalCampaigns: Number(totalCampaigns), totalContent: Number(totalContent), conversions: Number(conversions) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.url}` });
});

// Direct assignment for Vercel compatibility (esbuild CJS + export default has a lazy getter bug)
module.exports = app;
