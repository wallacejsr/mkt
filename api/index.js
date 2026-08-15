/**
 * Vercel Serverless Function — 100% self-contained JavaScript.
 * No TypeScript, no esbuild, no drizzle. Just Express + pg.
 */
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// CORS + JSON
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json({ limit: '4mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'mkt-agro-bw-secret-key-2026';

function getDbUrl() {
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

function verifyToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split('Bearer ')[1], JWT_SECRET); }
  catch { return null; }
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
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

    const member = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool.query('SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1', [member.rows[0].organization_id]);
      business = biz.rows[0] || null;
    }

    const token = jwt.sign({ userId: user.id, uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser, business });
  } catch (e) { console.error('[login]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Register ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const pool = createPool();
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

    const emailNorm = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (existing.rows[0]) return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });

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
  } catch (e) { console.error('[register]', e.message); res.status(400).json({ error: e.message }); }
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
      business = biz.rows[0] || null;
    }
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, business });
  } catch (e) { console.error('[me]', e.message); res.status(500).json({ error: e.message }); }
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

    await pool.query(`UPDATE businesses SET segment=$1, description=$2, city=$3, state=$4, website=$5, instagram=$6, whatsapp=$7, service_area=$8, service_type=$9, onboarding_completed=true, onboarding_completed_at=NOW() WHERE id=$10`,
      [company?.segment, company?.description, company?.city, company?.state, company?.website, company?.instagram, company?.whatsapp, company?.serviceArea, company?.serviceType, businessId]);

    if (productsList && productsList.length) {
      for (const p of productsList) {
        await pool.query('INSERT INTO products (business_id, name, type, description, price, ticket_value, main_benefit, differentiators, ideal_customer, is_main) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [businessId, p.name, p.type, p.description, p.price, p.ticketValue, p.mainBenefit, p.differentiators, p.idealCustomer, p.isMain || false]);
      }
    }

    if (audience) {
      await pool.query('INSERT INTO target_audiences (business_id, description, age_range, location, profile, pains, desires, objections, decision_factors) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [businessId, audience.description, audience.ageRange, audience.location, audience.profile, JSON.stringify(audience.pains || []), JSON.stringify(audience.desires || []), JSON.stringify(audience.objections || []), audience.decisionFactors]);
    }

    if (marketing) {
      await pool.query('INSERT INTO marketing_profiles (business_id, channels, post_frequency, monthly_investment, monthly_leads, monthly_sales, main_difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [businessId, JSON.stringify(marketing.channels || []), marketing.postFrequency, marketing.monthlyInvestment, marketing.monthlyLeads, marketing.monthlySales, marketing.mainDifficulty]);
    }

    if (objective) {
      await pool.query('INSERT INTO goals (business_id, goal_type, target_metric, timeframe) VALUES ($1,$2,$3,$4)',
        [businessId, objective.goalType, objective.targetMetric, objective.timeframe]);
    }

    // Try AI strategy generation (best-effort)
    let strategy = null;
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const biz = (await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId])).rows[0];
        const prods = (await pool.query('SELECT * FROM products WHERE business_id = $1', [businessId])).rows;

        const prompt = `Você é um Gerente de Marketing Sênior. Analise esta empresa e crie uma estratégia.
Empresa: ${biz?.name} - ${biz?.segment}. Descrição: ${biz?.description}
Produtos: ${prods.map(p => p.name + ' (' + p.type + ')').join(', ')}
Responda em JSON com: business_summary (string), positioning_statement (string), value_proposition (string).`;

        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', temperature: 0.7 } });
        const parsed = JSON.parse(response.text || '{}');
        const orgResult = await pool.query('SELECT organization_id FROM businesses WHERE id=$1', [businessId]);
        const stratResult = await pool.query('INSERT INTO strategies (business_id, business_summary, positioning_statement, value_proposition) VALUES ($1,$2,$3,$4) RETURNING *',
          [businessId, parsed.business_summary, parsed.positioning_statement, parsed.value_proposition]);
        strategy = stratResult.rows[0];
        await pool.query('INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output) VALUES ($1,$2,$3,$4,$5,$6)',
          [orgResult.rows[0]?.organization_id, businessId, 'initial_strategy', 'gemini', 'gemini-2.5-flash', JSON.stringify(parsed)]);
      }
    } catch (aiErr) { console.error('[onboarding-ai]', aiErr.message); }

    res.json({ success: true, strategy, message: strategy ? 'Onboarding completo com estratégia!' : 'Onboarding completo!' });
  } catch (e) { console.error('[onboarding]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Strategy ─────────────────────────────────────────────────────────────────
app.get('/api/strategy/current', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json({ strategy: null });
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json({ strategy: null });
    const strat = (await pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [biz.id])).rows[0];
    if (!strat) return res.json({ strategy: null });
    const channels = (await pool.query('SELECT * FROM strategy_channels WHERE strategy_id=$1 ORDER BY priority', [strat.id])).rows;
    const weeks = (await pool.query('SELECT * FROM strategy_plan_weeks WHERE strategy_id=$1 ORDER BY week', [strat.id])).rows;
    const opps = (await pool.query('SELECT * FROM opportunities WHERE business_id=$1', [biz.id])).rows;
    res.json({ strategy: { ...strat, channels, planWeeks: weeks, opportunities: opps } });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Content ──────────────────────────────────────────────────────────────────
app.get('/api/content', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    res.json((await pool.query('SELECT * FROM content_items WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
app.get('/api/campaigns', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    res.json((await pool.query('SELECT * FROM campaigns WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Leads ────────────────────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    res.json((await pool.query('SELECT * FROM leads WHERE business_id=$1 ORDER BY created_at DESC', [biz.id])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Recommendations ──────────────────────────────────────────────────────────
app.get('/api/recommendations', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    res.json((await pool.query("SELECT * FROM recommendations WHERE business_id=$1 AND status='active' ORDER BY priority_score DESC", [biz.id])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Marketing Assistant ─────────────────────────────────────────────────────
app.post('/api/assistant/chat', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });

    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Digite uma mensagem para o assistente.' });
    if (message.length > 2000) return res.status(400).json({ error: 'A mensagem deve ter no máximo 2.000 caracteres.' });

    const businessId = authorized.business.id;
    const [businessResult, productsResult, audienceResult, goalsResult, campaignsResult, leadStatsResult] = await Promise.all([
      pool.query('SELECT name, segment, description, city, state, service_area, service_type FROM businesses WHERE id=$1', [businessId]),
      pool.query('SELECT name, type, description, main_benefit, ideal_customer FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT goal_type, target_metric, timeframe FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 5', [businessId]),
      pool.query('SELECT name, objective, status, budget, leads, sales FROM campaigns WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='new')::int AS new_count,
                COUNT(*) FILTER (WHERE status='proposal')::int AS proposals,
                COUNT(*) FILTER (WHERE status='customer')::int AS customers,
                COUNT(*) FILTER (WHERE status='lost')::int AS lost
         FROM leads WHERE business_id=$1`,
        [businessId]
      ),
    ]);

    const context = {
      business: businessResult.rows[0],
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
      goals: goalsResult.rows,
      campaigns: campaignsResult.rows,
      pipeline: leadStatsResult.rows[0],
    };

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    const history = rawHistory
      .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .map(item => ({ role: item.role, content: item.content.slice(0, 2000) }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const stats = context.pipeline || {};
      const answer = Number(stats.total || 0) === 0
        ? `Ainda não há leads cadastrados para ${context.business?.name || 'a empresa'}. Minha recomendação é começar definindo um perfil de cliente ideal e cadastrar os primeiros contatos no CRM. Depois disso, poderei analisar conversão, propostas e prioridades com mais precisão.`
        : `O funil atual possui ${stats.total || 0} leads, ${stats.proposals || 0} propostas e ${stats.customers || 0} clientes. Como ação imediata, revise as propostas abertas, registre o próximo contato de cada lead e concentre os esforços nos contatos com maior potencial de fechamento.`;
      return res.json({ answer, source: 'business-data' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Você é o Assistente de Marketing e Vendas do Marketing OS.
Responda em português do Brasil, de forma prática, clara e direta.
Use os dados da empresa abaixo como fonte principal. Não invente números, resultados ou fatos ausentes.
Quando faltarem dados, diga isso claramente e sugira o próximo passo.
Você pode ajudar com estratégia, conteúdo, campanhas, prospecção, CRM e análise do funil.
Não afirme que executou, publicou, enviou ou alterou algo; você apenas orienta.

DADOS DA EMPRESA:
${JSON.stringify(context, null, 2)}

HISTÓRICO RECENTE:
${history.map(item => `${item.role === 'user' ? 'Usuário' : 'Assistente'}: ${item.content}`).join('\n') || 'Sem histórico anterior.'}

PERGUNTA ATUAL:
${message}

Forneça uma resposta útil e, quando fizer sentido, finalize com até 3 próximos passos objetivos.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.5, maxOutputTokens: 1200 },
    });
    const answer = String(response.text || '').trim();
    if (!answer) throw new Error('O assistente não retornou uma resposta.');
    res.json({ answer, source: 'gemini' });
  } catch (e) {
    console.error('[assistant-chat]', e.message);
    res.status(500).json({ error: 'Não foi possível gerar a resposta agora. Tente novamente.' });
  } finally { pool.end().catch(() => {}); }
});

// ─── Analytics ────────────────────────────────────────────────────────────────
function analyticsPeriod(period, customStart, customEnd) {
  const now = new Date();
  let end = new Date(now);
  let start = new Date(now);

  if (period === '7d') start.setDate(now.getDate() - 7);
  else if (period === '90d') start.setDate(now.getDate() - 90);
  else if (period === 'this_month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === 'custom' && customStart && customEnd) {
    start = new Date(customStart + 'T00:00:00');
    end = new Date(customEnd + 'T23:59:59.999');
  } else start.setDate(now.getDate() - 30);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error('Período de Analytics inválido.');
  }

  // Prevent oversized custom reports from exhausting a serverless invocation.
  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    throw new Error('O período máximo permitido é de 366 dias.');
  }

  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return { start, end, previousStart, previousEnd };
}

async function getAuthorizedBusiness(pool, req) {
  const decoded = verifyToken(req);
  if (!decoded) return { error: 401, message: 'Não autenticado.' };
  const member = (await pool.query(
    'SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1',
    [decoded.userId]
  )).rows[0];
  if (!member) return { error: 404, message: 'Organização não encontrada.' };
  const business = (await pool.query(
    'SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1',
    [member.organization_id]
  )).rows[0];
  if (!business) return { error: 404, message: 'Empresa não encontrada.' };
  if (req.query.businessId && req.query.businessId !== business.id) {
    return { error: 403, message: 'Acesso negado a esta empresa.' };
  }
  return { business };
}

app.get('/api/analytics/overview', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });

    const businessId = authorized.business.id;
    const period = String(req.query.period || '30d');
    const comparePrevious = String(req.query.comparePrevious || 'true') === 'true';
    const { start, end, previousStart, previousEnd } = analyticsPeriod(
      period,
      req.query.customStart,
      req.query.customEnd
    );

    const [allLeadsResult, currentLeadsResult, convertedResult, campaignsResult, contentResult] = await Promise.all([
      pool.query('SELECT * FROM leads WHERE business_id=$1', [businessId]),
      pool.query('SELECT * FROM leads WHERE business_id=$1 AND created_at BETWEEN $2 AND $3', [businessId, start, end]),
      pool.query("SELECT * FROM leads WHERE business_id=$1 AND status='customer' AND converted_at BETWEEN $2 AND $3", [businessId, start, end]),
      pool.query('SELECT * FROM campaigns WHERE business_id=$1', [businessId]),
      pool.query('SELECT * FROM content_items WHERE business_id=$1', [businessId]),
    ]);

    const allLeads = allLeadsResult.rows;
    const currentLeads = currentLeadsResult.rows;
    const converted = convertedResult.rows;
    const businessCampaigns = campaignsResult.rows;
    const content = contentResult.rows;

    let previousLeads = [];
    let previousConverted = [];
    if (comparePrevious) {
      const previous = await Promise.all([
        pool.query('SELECT * FROM leads WHERE business_id=$1 AND created_at BETWEEN $2 AND $3', [businessId, previousStart, previousEnd]),
        pool.query("SELECT * FROM leads WHERE business_id=$1 AND status='customer' AND converted_at BETWEEN $2 AND $3", [businessId, previousStart, previousEnd]),
      ]);
      previousLeads = previous[0].rows;
      previousConverted = previous[1].rows;
    }

    const numeric = value => Number(value || 0);
    const parseInvestment = campaign => {
      if (numeric(campaign.investment_spent) > 0) return numeric(campaign.investment_spent);
      const normalized = String(campaign.budget || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
      return Number.parseFloat(normalized) || 0;
    };
    const revenueOf = list => list.reduce((sum, lead) => sum + numeric(lead.actual_value), 0);
    const change = (current, previous) => previous === 0 ? null : ((current - previous) / previous) * 100;

    const totalLeads = currentLeads.length;
    const totalCustomers = converted.length;
    const conversionRate = totalLeads ? (totalCustomers / totalLeads) * 100 : 0;
    const attributedRevenue = revenueOf(converted);
    const totalInvestment = businessCampaigns.reduce((sum, campaign) => sum + parseInvestment(campaign), 0);
    const activeLeads = allLeads.filter(lead => !['customer', 'lost'].includes(lead.status));
    const potentialPipelineValue = activeLeads.reduce((sum, lead) => sum + numeric(lead.potential_value), 0);

    const previousConversionRate = previousLeads.length ? (previousConverted.length / previousLeads.length) * 100 : 0;
    const stages = Object.fromEntries(['new', 'contacted', 'interested', 'proposal', 'customer', 'lost'].map(status => [status, { count: 0, value: 0 }]));
    const lostCounts = {};
    const sourceCounts = {};
    let conversionDays = 0;
    let conversionDates = 0;

    for (const lead of allLeads) {
      if (stages[lead.status]) {
        stages[lead.status].count++;
        stages[lead.status].value += numeric(lead.potential_value || lead.actual_value);
      }
      if (lead.status === 'lost') {
        const reason = lead.lost_reason || 'Outros / Não informado';
        lostCounts[reason] = (lostCounts[reason] || 0) + 1;
      }
      const source = lead.source || 'Outros';
      sourceCounts[source] ||= { leads: 0, customers: 0, revenue: 0, potential: 0 };
      sourceCounts[source].leads++;
      if (lead.status === 'customer') {
        sourceCounts[source].customers++;
        sourceCounts[source].revenue += numeric(lead.actual_value);
        if (lead.created_at && lead.converted_at) {
          conversionDays += Math.max(0, (new Date(lead.converted_at) - new Date(lead.created_at)) / 86400000);
          conversionDates++;
        }
      } else if (lead.status !== 'lost') sourceCounts[source].potential += numeric(lead.potential_value);
    }

    const totalLost = Object.values(lostCounts).reduce((sum, count) => sum + count, 0);
    const lostReasons = Object.entries(lostCounts).map(([reason, count]) => ({
      reason, count, percentage: totalLost ? (count / totalLost) * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    const campaigns = businessCampaigns.map(campaign => {
      const campaignLeads = allLeads.filter(lead => lead.campaign_id === campaign.id);
      const customers = campaignLeads.filter(lead => lead.status === 'customer');
      const investment = parseInvestment(campaign);
      const revenue = revenueOf(customers);
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        investment,
        crm: {
          leads: campaignLeads.length,
          customers: customers.length,
          conversionRate: campaignLeads.length ? (customers.length / campaignLeads.length) * 100 : 0,
          revenue,
          cpl: campaignLeads.length && investment ? investment / campaignLeads.length : null,
          cac: customers.length && investment ? investment / customers.length : null,
          roas: investment ? revenue / investment : null,
        },
        manual: { leads: campaign.leads, revenue: campaign.revenue_generated },
        hasDiscrepancy: campaign.leads != null && numeric(campaign.leads) !== campaignLeads.length,
      };
    });

    const channels = Object.entries(sourceCounts).map(([channel, values]) => ({
      channel,
      leads: values.leads,
      customers: values.customers,
      conversionRate: values.leads ? (values.customers / values.leads) * 100 : 0,
      revenue: values.revenue,
      potentialValue: values.potential,
    })).sort((a, b) => b.leads - a.leads);

    const distribution = {};
    for (const item of content) distribution[item.channel || 'Outros'] = (distribution[item.channel || 'Outros'] || 0) + 1;
    const published = content.filter(item => item.status === 'published').length;

    const timelineMap = {};
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      timelineMap[key] = { date: key, leads: 0, customers: 0, revenue: 0 };
    }
    for (const lead of currentLeads) {
      const key = new Date(lead.created_at).toISOString().slice(0, 10);
      if (timelineMap[key]) timelineMap[key].leads++;
    }
    for (const lead of converted) {
      const key = new Date(lead.converted_at).toISOString().slice(0, 10);
      if (timelineMap[key]) {
        timelineMap[key].customers++;
        timelineMap[key].revenue += numeric(lead.actual_value);
      }
    }

    res.json({
      period,
      startDate: start,
      endDate: end,
      overview: {
        totalLeads,
        totalCustomers,
        conversionRate,
        attributedRevenue,
        potentialPipelineValue,
        totalInvestment,
        cpl: totalLeads && totalInvestment ? totalInvestment / totalLeads : null,
        cac: totalCustomers && totalInvestment ? totalInvestment / totalCustomers : null,
        roas: totalInvestment ? attributedRevenue / totalInvestment : null,
        changes: {
          leads: change(totalLeads, previousLeads.length),
          customers: change(totalCustomers, previousConverted.length),
          conversionRate: change(conversionRate, previousConversionRate),
          revenue: change(attributedRevenue, revenueOf(previousConverted)),
        },
      },
      pipeline: { stages, avgConversionTimeDays: conversionDates ? conversionDays / conversionDates : null },
      lostReasons,
      campaigns,
      channels,
      contentExecution: {
        planned: content.length,
        published,
        percentage: content.length ? (published / content.length) * 100 : 0,
        distribution,
      },
      timeline: Object.values(timelineMap),
    });
  } catch (e) {
    console.error('[analytics-overview]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao carregar Analytics.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/analytics/export', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const leads = (await pool.query('SELECT * FROM leads WHERE business_id=$1 ORDER BY created_at DESC', [authorized.business.id])).rows;
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = leads.map(lead => [
      lead.id, lead.name, lead.company_name, lead.email, lead.phone, lead.status, lead.source,
      lead.potential_value, lead.actual_value, lead.created_at?.toISOString?.() || lead.created_at,
      lead.converted_at?.toISOString?.() || lead.converted_at,
    ].map(csvCell).join(','));
    const header = 'ID,Nome,Empresa,Email,Telefone,Status,Origem,Valor Potencial,Valor Real,Data Criação,Data Conversão';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
    res.send('\uFEFF' + [header, ...rows].join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/analytics/insights', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const counts = (await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='customer')::int AS customers,
              COUNT(*) FILTER (WHERE status='proposal')::int AS proposals
       FROM leads WHERE business_id=$1`,
      [authorized.business.id]
    )).rows[0];
    const observation = counts.total
      ? `Há ${counts.total} leads, ${counts.proposals} propostas e ${counts.customers} clientes registrados.`
      : 'Ainda não há leads suficientes para gerar uma análise detalhada.';
    res.json({ insights: [{
      title: counts.total ? 'Panorama comercial' : 'Comece pela base de dados',
      observation,
      recommended_action: counts.total ? 'Revise as propostas abertas e mantenha os próximos contatos atualizados.' : 'Cadastre ou importe leads para acompanhar conversão e desempenho.',
      confidence: 'high',
    }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/analytics/summary', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json({});
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json({});
    const totalLeads = (await pool.query('SELECT COUNT(*) as count FROM leads WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const totalCampaigns = (await pool.query('SELECT COUNT(*) as count FROM campaigns WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const totalContent = (await pool.query('SELECT COUNT(*) as count FROM content_items WHERE business_id=$1', [biz.id])).rows[0]?.count || 0;
    const conversions = (await pool.query("SELECT COUNT(*) as count FROM leads WHERE business_id=$1 AND status='customer'", [biz.id])).rows[0]?.count || 0;
    res.json({ totalLeads: +totalLeads, totalCampaigns: +totalCampaigns, totalContent: +totalContent, conversions: +conversions });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada: ' + req.method + ' ' + req.url });
});

module.exports = app;
