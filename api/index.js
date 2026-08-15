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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

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

        const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } });
        const parsed = JSON.parse(response.text || '{}');
        const orgResult = await pool.query('SELECT organization_id FROM businesses WHERE id=$1', [businessId]);
        const stratResult = await pool.query('INSERT INTO strategies (business_id, business_summary, positioning_statement, value_proposition) VALUES ($1,$2,$3,$4) RETURNING *',
          [businessId, parsed.business_summary, parsed.positioning_statement, parsed.value_proposition]);
        strategy = stratResult.rows[0];
        await pool.query('INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output) VALUES ($1,$2,$3,$4,$5,$6)',
          [orgResult.rows[0]?.organization_id, businessId, 'initial_strategy', 'gemini', GEMINI_MODEL, JSON.stringify(parsed)]);
      }
    } catch (aiErr) { console.error('[onboarding-ai]', aiErr.message); }

    res.json({ success: true, strategy, message: strategy ? 'Onboarding completo com estratégia!' : 'Onboarding completo!' });
  } catch (e) { console.error('[onboarding]', e.message); res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Strategy ─────────────────────────────────────────────────────────────────
function strategyForClient(row) {
  if (!row) return null;
  return {
    ...row,
    businessId: row.business_id,
    businessSummary: row.business_summary,
    idealCustomerDesc: row.ideal_customer_desc,
    idealCustomerPains: row.ideal_customer_pains || [],
    idealCustomerDesires: row.ideal_customer_desires || [],
    idealCustomerObjections: row.ideal_customer_objections || [],
    positioningStatement: row.positioning_statement,
    valueProposition: row.value_proposition,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

app.get('/api/strategy/current', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const businessId = authorized.business.id;
    const strat = (await pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId])).rows[0];
    if (!strat) return res.json({ strategy: null });
    const [channelsResult, weeksResult, opportunitiesResult, goalResult] = await Promise.all([
      pool.query('SELECT * FROM strategy_channels WHERE strategy_id=$1 ORDER BY priority', [strat.id]),
      pool.query('SELECT * FROM strategy_plan_weeks WHERE strategy_id=$1 ORDER BY week', [strat.id]),
      pool.query('SELECT * FROM opportunities WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
    ]);
    const goal = goalResult.rows[0];
    res.json({
      strategy: strategyForClient(strat),
      channels: channelsResult.rows,
      planWeeks: weeksResult.rows,
      opportunities: opportunitiesResult.rows,
      goal: goal ? {
        ...goal,
        businessId: goal.business_id,
        goalType: goal.goal_type,
        targetMetric: goal.target_metric,
        createdAt: goal.created_at,
      } : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/strategy/regenerate', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    // The frontend sends businessId in the body for this endpoint.
    const requestedBusinessId = String(req.body?.businessId || '');
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const business = (await pool.query(
      `SELECT b.* FROM businesses b
       JOIN organization_members om ON om.organization_id=b.organization_id
       WHERE b.id=$1 AND om.user_id=$2 LIMIT 1`,
      [requestedBusinessId, decoded.userId]
    )).rows[0];
    if (!business) return res.status(403).json({ error: 'Acesso negado a esta empresa.' });

    const [productsResult, audienceResult, marketingResult, goalsResult] = await Promise.all([
      pool.query('SELECT * FROM products WHERE business_id=$1 ORDER BY created_at DESC', [business.id]),
      pool.query('SELECT * FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id]),
      pool.query('SELECT * FROM marketing_profiles WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id]),
      pool.query('SELECT * FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id]),
    ]);
    const context = {
      business: {
        name: business.name,
        segment: business.segment,
        description: business.description,
        city: business.city,
        state: business.state,
        serviceArea: business.service_area,
        serviceType: business.service_type,
      },
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
      currentMarketing: marketingResult.rows[0] || null,
      goal: goalsResult.rows[0] || null,
    };

    let generated;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um gerente de marketing sênior. Crie uma estratégia de marketing prática em português do Brasil baseada somente nos dados reais abaixo. Quando faltar informação, apresente como hipótese, sem inventar fatos, preços ou resultados.

DADOS:
${JSON.stringify(context, null, 2)}

Retorne somente JSON válido neste formato:
{"business_summary":"...","ideal_customer":{"description":"...","main_pains":["..."],"main_desires":["..."],"main_objections":["..."]},"positioning":{"statement":"...","value_proposition":"...","differentiators":["..."]},"priority_channels":[{"channel":"...","priority":1,"reason":"..."}],"opportunities":[{"title":"...","description":"...","impact":"high"}],"plan_30_days":[{"week":1,"objective":"...","actions":["..."]},{"week":2,"objective":"...","actions":["..."]},{"week":3,"objective":"...","actions":["..."]},{"week":4,"objective":"...","actions":["..."]}]}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 5000 },
      });
      generated = JSON.parse(response.text || '{}');
    } else {
      const audience = audienceResult.rows[0] || {};
      const marketingChannels = Array.isArray(marketingResult.rows[0]?.channels) ? marketingResult.rows[0].channels : [];
      const channels = marketingChannels.length ? marketingChannels.slice(0, 3) : ['Instagram', 'LinkedIn', 'WhatsApp'];
      generated = {
        business_summary: `${business.name} atua em ${business.segment || 'seu segmento'}, com foco em ${business.description || 'soluções para seus clientes'}.`,
        ideal_customer: {
          description: audience.profile || audience.description || 'Cliente com necessidade compatível com as soluções da empresa.',
          main_pains: audience.pains || ['Necessidade de encontrar uma solução confiável'],
          main_desires: audience.desires || ['Obter melhores resultados com segurança'],
          main_objections: audience.objections || ['Dúvidas sobre valor e adequação da solução'],
        },
        positioning: {
          statement: `${business.name}: soluções de ${business.segment || 'marketing e negócios'} orientadas às necessidades do cliente.`,
          value_proposition: business.description || `Atendimento especializado em ${business.segment || 'soluções empresariais'}.`,
          differentiators: productsResult.rows.map(product => product.main_benefit).filter(Boolean).slice(0, 3),
        },
        priority_channels: channels.map((channel, index) => ({ channel, priority: index + 1, reason: 'Canal alinhado ao perfil e ao momento atual da empresa.' })),
        opportunities: [{ title: 'Fortalecer presença digital', description: 'Criar uma rotina consistente de conteúdo e acompanhamento de leads.', impact: 'high' }],
        plan_30_days: [1, 2, 3, 4].map(week => ({ week, objective: `Executar a etapa ${week} da estratégia`, actions: [`Planejar as ações da semana ${week}`, 'Produzir conteúdo alinhado ao objetivo', 'Acompanhar leads e registrar resultados'] })),
      };
    }

    if (!generated.business_summary || !generated.positioning || !Array.isArray(generated.plan_30_days)) {
      throw new Error('A IA retornou uma estratégia incompleta. Tente novamente.');
    }

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('UPDATE strategies SET is_active=false WHERE business_id=$1', [business.id]);
    const strategy = (await client.query(
      `INSERT INTO strategies
        (business_id, business_summary, ideal_customer_desc, ideal_customer_pains, ideal_customer_desires,
         ideal_customer_objections, positioning_statement, value_proposition, differentiators, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
      [
        business.id, generated.business_summary, generated.ideal_customer?.description || null,
        JSON.stringify(generated.ideal_customer?.main_pains || []), JSON.stringify(generated.ideal_customer?.main_desires || []),
        JSON.stringify(generated.ideal_customer?.main_objections || []), generated.positioning.statement || null,
        generated.positioning.value_proposition || null, JSON.stringify(generated.positioning.differentiators || []),
      ]
    )).rows[0];
    for (const [index, channel] of (generated.priority_channels || []).slice(0, 5).entries()) {
      await client.query(
        'INSERT INTO strategy_channels (strategy_id, channel, priority, reason) VALUES ($1,$2,$3,$4)',
        [strategy.id, channel.channel, Number(channel.priority || index + 1), channel.reason || null]
      );
    }
    for (const [index, week] of generated.plan_30_days.slice(0, 4).entries()) {
      await client.query(
        'INSERT INTO strategy_plan_weeks (strategy_id, week, objective, actions) VALUES ($1,$2,$3,$4)',
        [strategy.id, Number(week.week || index + 1), week.objective || null, JSON.stringify(week.actions || [])]
      );
    }
    await client.query('DELETE FROM opportunities WHERE business_id=$1', [business.id]);
    for (const opportunity of (generated.opportunities || []).slice(0, 10)) {
      await client.query(
        `INSERT INTO opportunities (business_id, title, description, impact, effort, status)
         VALUES ($1,$2,$3,$4,'medium','open')`,
        [business.id, opportunity.title || 'Oportunidade', opportunity.description || null, ['high', 'medium', 'low'].includes(opportunity.impact) ? opportunity.impact : 'medium']
      );
    }
    await client.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'initial_strategy',$3,$4,$5)`,
      [business.organization_id, business.id, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(generated)]
    );
    await client.query('COMMIT');
    res.json({ success: true, strategy: strategyForClient(strategy) });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[strategy-regenerate]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar a estratégia.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

// ─── Content ──────────────────────────────────────────────────────────────────
function contentForClient(row) {
  if (!row) return null;
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    strategyId: row.strategy_id,
    funnelStage: row.funnel_stage,
    scheduledDate: row.scheduled_date,
    visualDirection: row.visual_direction,
    videoScript: row.video_script,
    generationContext: row.generation_context,
    campaignId: row.campaign_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

async function contentBusiness(pool, req, businessId) {
  const decoded = verifyToken(req);
  if (!decoded) return { error: 401, message: 'Não autenticado.' };
  if (!businessId) return { error: 400, message: 'Empresa não informada.' };
  const business = (await pool.query(
    `SELECT b.* FROM businesses b
     JOIN organization_members om ON om.organization_id=b.organization_id
     WHERE b.id=$1 AND om.user_id=$2 LIMIT 1`,
    [businessId, decoded.userId]
  )).rows[0];
  if (!business) return { error: 403, message: 'Acesso negado a esta empresa.' };
  return { business };
}

app.get('/api/content', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const rows = (await pool.query('SELECT * FROM content_items WHERE business_id=$1 ORDER BY scheduled_date DESC NULLS LAST, created_at DESC', [biz.id])).rows;
    res.json(rows.map(contentForClient));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/content/generate-calendar', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const { businessId, frequencyDesc, objective } = req.body || {};
    const periodDays = Number(req.body?.periodDays || 30);
    const channels = Array.isArray(req.body?.channels)
      ? req.body.channels.map(channel => String(channel).trim()).filter(Boolean).slice(0, 10)
      : [];
    const authorized = await contentBusiness(pool, req, businessId);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    if (![7, 14, 30].includes(periodDays)) return res.status(400).json({ error: 'Período inválido.' });
    if (!channels.length) return res.status(400).json({ error: 'Selecione pelo menos um canal.' });

    const business = authorized.business;
    const [strategyResult, productsResult, audienceResult] = await Promise.all([
      pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT name, type, description, main_benefit, ideal_customer FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
    ]);
    const strategy = strategyResult.rows[0] || null;
    const context = {
      business: {
        name: business.name,
        segment: business.segment,
        description: business.description,
        serviceArea: business.service_area,
      },
      strategy,
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
    };

    const frequencyMatch = String(frequencyDesc || '').match(/(\d+)/);
    const postsPerWeek = /todos os dias/i.test(String(frequencyDesc)) ? 7 : Number(frequencyMatch?.[1] || 3);
    const desiredCount = Math.min(30, Math.max(1, Math.ceil((periodDays / 7) * postsPerWeek)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() + periodDays - 1);

    let items = [];
    let aiOutput = null;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um estrategista de conteúdo sênior. Crie um calendário editorial em português do Brasil.

Configuração:
- Início: ${today.toISOString().slice(0, 10)}
- Período: ${periodDays} dias
- Quantidade exata: ${desiredCount} conteúdos
- Frequência: ${frequencyDesc}
- Canais permitidos: ${channels.join(', ')}
- Objetivo: ${objective || 'autoridade'}

Contexto real da empresa:
${JSON.stringify(context, null, 2)}

Regras:
- Não invente preços, garantias, clientes, depoimentos ou resultados.
- Distribua as datas dentro do período e varie canais e formatos.
- Use somente funnel_stage: awareness, consideration, conversion ou retention.
- Retorne somente JSON válido neste formato:
{"content_items":[{"scheduled_date":"YYYY-MM-DD","title":"...","topic":"...","channel":"...","format":"...","funnel_stage":"awareness","objective":"...","brief":"..."}]}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 5000 },
      });
      aiOutput = JSON.parse(response.text || '{}');
      items = Array.isArray(aiOutput.content_items) ? aiOutput.content_items : [];
    } else {
      const subjects = productsResult.rows.length
        ? productsResult.rows.map(product => product.name)
        : [business.segment || business.name || 'seu mercado'];
      const formats = ['Carrossel', 'Post', 'Vídeo curto', 'Stories'];
      items = Array.from({ length: desiredCount }, (_, index) => {
        const offset = desiredCount === 1 ? 0 : Math.round((index * (periodDays - 1)) / (desiredCount - 1));
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        const subject = subjects[index % subjects.length];
        return {
          scheduled_date: date.toISOString().slice(0, 10),
          title: `${index + 1}. Como ${subject} pode ajudar o cliente ideal`,
          topic: `Conteúdo educativo sobre ${subject}, conectado ao objetivo de ${objective || 'autoridade'}.`,
          channel: channels[index % channels.length],
          format: formats[index % formats.length],
          funnel_stage: index % 4 === 3 ? 'conversion' : index % 3 === 2 ? 'consideration' : 'awareness',
          objective: objective || 'autoridade',
        };
      });
      aiOutput = { content_items: items, fallback: true };
    }

    const allowedStages = new Set(['awareness', 'consideration', 'conversion', 'retention']);
    const allowedChannels = new Set(channels.map(channel => channel.toLowerCase()));
    items = items.slice(0, desiredCount).map((item, index) => {
      const parsedDate = new Date(`${item.scheduled_date}T00:00:00`);
      const fallbackDate = new Date(today);
      fallbackDate.setDate(fallbackDate.getDate() + Math.min(periodDays - 1, index));
      const validDate = !Number.isNaN(parsedDate.getTime()) && parsedDate >= today && parsedDate <= lastDate ? parsedDate : fallbackDate;
      const requestedChannel = String(item.channel || channels[index % channels.length]);
      const channel = allowedChannels.has(requestedChannel.toLowerCase()) ? requestedChannel : channels[index % channels.length];
      return {
        scheduledDate: validDate.toISOString().slice(0, 10),
        title: String(item.title || item.topic || 'Ideia de conteúdo').slice(0, 300),
        topic: String(item.topic || item.brief || '').slice(0, 2000),
        channel,
        format: String(item.format || 'Post').slice(0, 100),
        funnelStage: allowedStages.has(item.funnel_stage) ? item.funnel_stage : 'awareness',
        itemObjective: String(item.objective || objective || '').slice(0, 300),
      };
    });
    if (!items.length) throw new Error('A IA não retornou itens válidos para o calendário.');

    client = await pool.connect();
    await client.query('BEGIN');
    const saved = [];
    for (const item of items) {
      const result = await client.query(
        `INSERT INTO content_items
          (organization_id, business_id, strategy_id, title, topic, channel, format, funnel_stage, objective, scheduled_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'idea') RETURNING *`,
        [business.organization_id, businessId, strategy?.id || null, item.title, item.topic, item.channel, item.format, item.funnelStage, item.itemObjective, item.scheduledDate]
      );
      saved.push(contentForClient(result.rows[0]));
    }
    await client.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'content_calendar',$3,$4,$5)`,
      [business.organization_id, businessId, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(aiOutput)]
    );
    await client.query('COMMIT');
    res.json({ success: true, items: saved });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[content-calendar]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar o calendário.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.post('/api/content', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await contentBusiness(pool, req, req.body?.businessId);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const business = authorized.business;
    const strategy = (await pool.query('SELECT id FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [business.id])).rows[0];
    const row = (await pool.query(
      `INSERT INTO content_items (organization_id, business_id, strategy_id, title, topic, channel, format, funnel_stage, objective, scheduled_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [business.organization_id, business.id, strategy?.id || null, req.body.title || 'Novo Conteúdo', req.body.topic || null, req.body.channel || null, req.body.format || null, req.body.funnelStage || null, req.body.objective || null, req.body.scheduledDate || null, req.body.status || 'idea']
    )).rows[0];
    res.json(contentForClient(row));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

async function authorizedContentItem(pool, req, itemId) {
  const decoded = verifyToken(req);
  if (!decoded) return { error: 401, message: 'Não autenticado.' };
  const item = (await pool.query(
    `SELECT ci.* FROM content_items ci
     JOIN businesses b ON b.id=ci.business_id
     JOIN organization_members om ON om.organization_id=b.organization_id
     WHERE ci.id=$1 AND om.user_id=$2 LIMIT 1`,
    [itemId, decoded.userId]
  )).rows[0];
  if (!item) return { error: 404, message: 'Conteúdo não encontrado.' };
  return { item };
}

app.post('/api/content/:id/generate', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const item = authorized.item;
    const [businessResult, strategyResult, productsResult, audienceResult] = await Promise.all([
      pool.query('SELECT * FROM businesses WHERE id=$1', [item.business_id]),
      pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [item.business_id]),
      pool.query('SELECT name, type, description, main_benefit, differentiators FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [item.business_id]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [item.business_id]),
    ]);
    const business = businessResult.rows[0];
    const context = {
      business: { name: business.name, segment: business.segment, description: business.description },
      strategy: strategyResult.rows[0] || null,
      products: productsResult.rows,
      audience: audienceResult.rows[0] || null,
    };

    let generated;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um copywriter sênior. Crie um conteúdo em português do Brasil usando somente os dados fornecidos. Não invente preços, descontos, depoimentos, garantias ou resultados.

ITEM:
- Título/Tema: ${item.title || item.topic || ''}
- Briefing: ${item.topic || ''}
- Canal: ${item.channel || ''}
- Formato: ${item.format || ''}
- Etapa do funil: ${item.funnel_stage || ''}
- Objetivo: ${item.objective || ''}

CONTEXTO:
${JSON.stringify(context, null, 2)}

Retorne somente JSON válido:
{"title":"...","hook":"...","body":"...","caption":"...","cta":"...","hashtags":["..."],"visual_direction":"...","video_script":"..."}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 3000 },
      });
      generated = JSON.parse(response.text || '{}');
    } else {
      generated = {
        title: item.title || item.topic || 'Novo conteúdo',
        hook: `Você já pensou em como ${item.topic || business.segment || 'esta solução'} pode apoiar seus objetivos?`,
        body: `${business.name} atua com ${business.segment || 'soluções especializadas'} e ajuda clientes a encontrar alternativas alinhadas às suas necessidades. ${item.topic || business.description || ''}`.trim(),
        caption: item.topic || business.description || '',
        cta: 'Entre em contato para saber mais.',
        hashtags: [],
        visual_direction: `Utilizar identidade visual da marca em uma composição adequada para ${item.channel || 'o canal selecionado'}.`,
        video_script: '',
      };
    }
    if (!generated.body && !generated.caption) throw new Error('A IA não retornou um conteúdo válido.');

    const updated = (await pool.query(
      `UPDATE content_items SET title=$1, hook=$2, body=$3, caption=$4, cta=$5, hashtags=$6,
       visual_direction=$7, video_script=$8, status='draft', updated_at=NOW() WHERE id=$9 RETURNING *`,
      [
        generated.title || item.title, generated.hook || null, generated.body || null, generated.caption || null,
        generated.cta || null, JSON.stringify(Array.isArray(generated.hashtags) ? generated.hashtags : []),
        generated.visual_direction || null, generated.video_script || null, item.id,
      ]
    )).rows[0];
    await pool.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'content_item',$3,$4,$5)`,
      [item.organization_id, item.business_id, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(generated)]
    );
    res.json(contentForClient(updated));
  } catch (e) {
    console.error('[content-generate]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar o conteúdo.' });
  } finally { pool.end().catch(() => {}); }
});

app.post('/api/content/:id/refine', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const currentText = String(req.body?.currentText || '').trim();
    const instruction = String(req.body?.instruction || '').trim();
    if (!currentText || !instruction) return res.status(400).json({ error: 'Texto e instrução são obrigatórios.' });
    if (currentText.length > 12000 || instruction.length > 1000) return res.status(400).json({ error: 'Texto muito extenso para refinamento.' });

    let refinedText;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Você é um editor de texto de marketing. Reescreva somente o texto abaixo seguindo a instrução, preservando fatos e sem inventar preços, promessas ou resultados. Responda apenas com o texto final.\n\nINSTRUÇÃO: ${instruction}\n\nTEXTO:\n${currentText}`,
        config: { maxOutputTokens: 2000 },
      });
      refinedText = String(response.text || '').trim();
    } else {
      refinedText = currentText;
    }
    if (!refinedText) throw new Error('A IA não retornou o texto refinado.');
    res.json({ refinedText });
  } catch (e) {
    console.error('[content-refine]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível refinar o texto.' });
  } finally { pool.end().catch(() => {}); }
});

app.get('/api/content/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    res.json(contentForClient(authorized.item));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.put('/api/content/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await authorizedContentItem(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const current = authorized.item;
    const body = req.body || {};
    const status = ['idea', 'draft', 'ready', 'published'].includes(body.status) ? body.status : current.status;
    const publishedAt = status === 'published' && current.status !== 'published' ? new Date() : current.published_at;
    const updated = (await pool.query(
      `UPDATE content_items SET title=$1, topic=$2, channel=$3, format=$4, funnel_stage=$5, objective=$6,
       scheduled_date=$7, status=$8, hook=$9, body=$10, caption=$11, cta=$12, hashtags=$13,
       visual_direction=$14, video_script=$15, published_at=$16, updated_at=NOW()
       WHERE id=$17 RETURNING *`,
      [
        String(body.title ?? current.title).slice(0, 500), body.topic ?? current.topic, body.channel ?? current.channel,
        body.format ?? current.format, body.funnelStage ?? current.funnel_stage, body.objective ?? current.objective,
        body.scheduledDate || null, status, body.hook ?? current.hook, body.body ?? current.body,
        body.caption ?? current.caption, body.cta ?? current.cta,
        JSON.stringify(Array.isArray(body.hashtags) ? body.hashtags : (current.hashtags || [])),
        body.visualDirection ?? current.visual_direction, body.videoScript ?? current.video_script,
        publishedAt, current.id,
      ]
    )).rows[0];
    res.json(contentForClient(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
app.get('/api/businesses/:id/context', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await contentBusiness(pool, req, req.params.id);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const businessId = authorized.business.id;
    const [products, audiences, profiles] = await Promise.all([
      pool.query('SELECT * FROM products WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM marketing_profiles WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
    ]);
    res.json({
      products: products.rows.map(product => ({
        ...product,
        businessId: product.business_id,
        ticketValue: product.ticket_value,
        mainBenefit: product.main_benefit,
        idealCustomer: product.ideal_customer,
        isMain: product.is_main,
      })),
      targetAudiences: audiences.rows.map(audience => ({
        ...audience,
        businessId: audience.business_id,
        ageRange: audience.age_range,
        decisionFactors: audience.decision_factors,
      })),
      marketingProfiles: profiles.rows.map(profile => ({
        ...profile,
        businessId: profile.business_id,
        postFrequency: profile.post_frequency,
        monthlyInvestment: profile.monthly_investment,
        monthlyLeads: profile.monthly_leads,
        monthlySales: profile.monthly_sales,
        mainDifficulty: profile.main_difficulty,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

function campaignForClient(row) {
  if (!row) return null;
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    strategyId: row.strategy_id,
    productId: row.product_id,
    targetAudience: row.target_audience,
    mainArgument: row.main_argument,
    startDate: row.start_date,
    endDate: row.end_date,
    primaryMetric: row.primary_metric,
    investmentSpent: Number(row.investment_spent || 0),
    revenueGenerated: Number(row.revenue_generated || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    leads: Number(row.leads || 0),
    sales: Number(row.sales || 0),
    channels: Array.isArray(row.channels) ? row.channels : [],
    assets: Array.isArray(row.assets) ? row.assets : [],
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
  };
}

app.get('/api/campaigns', async (req, res) => {
  const pool = createPool();
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Não autenticado.' });
    const member = (await pool.query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [decoded.userId])).rows[0];
    if (!member) return res.json([]);
    const biz = (await pool.query('SELECT id FROM businesses WHERE organization_id=$1 LIMIT 1', [member.organization_id])).rows[0];
    if (!biz) return res.json([]);
    const rows = (await pool.query(
      `SELECT c.*,
              COALESCE(json_agg(cc.*) FILTER (WHERE cc.id IS NOT NULL), '[]') AS channels
       FROM campaigns c
       LEFT JOIN campaign_channels cc ON cc.campaign_id=c.id
       WHERE c.business_id=$1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [biz.id]
    )).rows;
    res.json(rows.map(campaignForClient));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/campaigns/generate', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const businessId = authorized.business.id;
    const setup = req.body || {};
    const objective = String(setup.objective || '').trim();
    const channels = Array.isArray(setup.channels)
      ? setup.channels.map(channel => String(channel).trim()).filter(Boolean).slice(0, 10)
      : [];
    if (!objective) return res.status(400).json({ error: 'Selecione o objetivo da campanha.' });
    if (!channels.length) return res.status(400).json({ error: 'Selecione pelo menos um canal.' });

    const [businessResult, productsResult, audienceResult, strategyResult] = await Promise.all([
      pool.query('SELECT * FROM businesses WHERE id=$1', [businessId]),
      pool.query('SELECT * FROM products WHERE business_id=$1 ORDER BY created_at DESC', [businessId]),
      pool.query('SELECT * FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT * FROM strategies WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
    ]);
    const business = businessResult.rows[0];
    const selectedProduct = setup.productId
      ? productsResult.rows.find(product => product.id === setup.productId) || null
      : null;
    const context = {
      business: {
        name: business.name,
        segment: business.segment,
        description: business.description,
        city: business.city,
        state: business.state,
      },
      product: selectedProduct,
      audience: setup.customAudience || audienceResult.rows[0] || null,
      strategy: strategyResult.rows[0] || null,
    };

    let result;
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um estrategista de campanhas sênior. Crie uma campanha prática em português do Brasil.

Configuração:
- Nome sugerido pelo usuário: ${setup.name || 'não informado'}
- Objetivo: ${objective}
- Canais: ${channels.join(', ')}
- Período: ${setup.startDate || 'não informado'} até ${setup.endDate || 'não informado'}
- Orçamento: ${setup.budget || 'não informado'}
- Meta: ${setup.targetMetric || 'não informada'}
- Instruções: ${setup.instructions || 'nenhuma'}

Contexto real:
${JSON.stringify(context, null, 2)}

Não invente preços, descontos, depoimentos, garantias ou resultados. Se não houver produto selecionado, faça uma campanha institucional.
Retorne somente JSON válido:
{"campaign_name":"...","campaign_summary":"...","target_audience":{"description":"...","main_pain":"...","main_desire":"...","main_objection":"..."},"offer":{"description":"...","value_proposition":"...","urgency":"..."},"main_argument":"...","messaging":{"main_message":"...","supporting_arguments":["..."]},"plan_actions":["..."]}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 3000 },
      });
      result = JSON.parse(response.text || '{}');
    } else {
      const focus = selectedProduct?.name || business.segment || business.name;
      result = {
        campaign_name: setup.name || `Campanha de ${objective}`,
        campaign_summary: `Campanha focada em ${objective} para apresentar ${focus} ao público-alvo da empresa.`,
        target_audience: setup.customAudience || audienceResult.rows[0] || { description: 'Público-alvo cadastrado pela empresa' },
        offer: {
          description: `Apresentação da proposta de valor de ${focus}.`,
          value_proposition: selectedProduct?.main_benefit || strategyResult.rows[0]?.value_proposition || business.description,
          urgency: 'Incentivar o contato para conhecer a solução.',
        },
        main_argument: selectedProduct?.main_benefit || `Solução alinhada às necessidades do público de ${business.segment || business.name}.`,
        messaging: {
          main_message: `Conheça como ${focus} pode apoiar seus objetivos.`,
          supporting_arguments: ['Atendimento alinhado à necessidade do cliente', 'Solução apresentada de forma clara e consultiva'],
        },
        plan_actions: channels.map(channel => `Preparar e revisar a comunicação para ${channel}`),
      };
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const campaign = (await client.query(
      `INSERT INTO campaigns
        (organization_id, business_id, strategy_id, product_id, name, objective, description, target_audience, offer, main_argument, messaging, budget, start_date, end_date, primary_metric, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft') RETURNING *`,
      [
        business.organization_id, businessId, strategyResult.rows[0]?.id || null, selectedProduct?.id || null,
        String(result.campaign_name || setup.name || 'Nova Campanha').slice(0, 300), objective,
        result.campaign_summary || null, JSON.stringify(result.target_audience || {}), JSON.stringify(result.offer || {}),
        result.main_argument || null, JSON.stringify(result.messaging || {}), setup.budget || null,
        setup.startDate || null, setup.endDate || null, setup.targetMetric || null,
      ]
    )).rows[0];

    const savedChannels = [];
    for (const channel of channels) {
      const saved = (await client.query(
        'INSERT INTO campaign_channels (campaign_id, channel, status) VALUES ($1,$2,$3) RETURNING *',
        [campaign.id, channel, 'planned']
      )).rows[0];
      savedChannels.push(saved);
    }
    const savedTasks = [];
    const actions = Array.isArray(result.plan_actions) ? result.plan_actions.slice(0, 20) : [];
    for (const action of actions) {
      const saved = (await client.query(
        "INSERT INTO campaign_tasks (campaign_id, title, status) VALUES ($1,$2,'todo') RETURNING *",
        [campaign.id, String(action).slice(0, 500)]
      )).rows[0];
      savedTasks.push(saved);
    }
    await client.query(
      `INSERT INTO ai_generations (organization_id, business_id, type, provider, model, output)
       VALUES ($1,$2,'campaign_generation',$3,$4,$5)`,
      [business.organization_id, businessId, process.env.GEMINI_API_KEY ? 'gemini' : 'fallback', process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'deterministic', JSON.stringify(result)]
    );
    await client.query('COMMIT');
    res.json(campaignForClient({ ...campaign, channels: savedChannels, tasks: savedTasks, assets: [] }));
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[campaign-generate]', e.message);
    res.status(500).json({ error: e.message || 'Não foi possível gerar a campanha.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const campaign = (await pool.query('SELECT * FROM campaigns WHERE id=$1 AND business_id=$2', [req.params.id, authorized.business.id])).rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const [channels, assets, tasks, product] = await Promise.all([
      pool.query('SELECT * FROM campaign_channels WHERE campaign_id=$1 ORDER BY id', [campaign.id]),
      pool.query('SELECT * FROM campaign_assets WHERE campaign_id=$1 ORDER BY created_at DESC', [campaign.id]),
      pool.query('SELECT * FROM campaign_tasks WHERE campaign_id=$1 ORDER BY id', [campaign.id]),
      campaign.product_id ? pool.query('SELECT * FROM products WHERE id=$1', [campaign.product_id]) : Promise.resolve({ rows: [] }),
    ]);
    res.json(campaignForClient({ ...campaign, channels: channels.rows, assets: assets.rows, tasks: tasks.rows, product: product.rows[0] || null }));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.put('/api/campaigns/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const current = (await pool.query('SELECT * FROM campaigns WHERE id=$1 AND business_id=$2', [req.params.id, authorized.business.id])).rows[0];
    if (!current) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const body = req.body || {};
    const updated = (await pool.query(
      `UPDATE campaigns SET status=$1, impressions=$2, clicks=$3, leads=$4, sales=$5,
       investment_spent=$6, revenue_generated=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [
        body.status ?? current.status,
        Number(body.impressions ?? current.impressions ?? 0), Number(body.clicks ?? current.clicks ?? 0),
        Number(body.leads ?? current.leads ?? 0), Number(body.sales ?? current.sales ?? 0),
        Number(body.investmentSpent ?? current.investment_spent ?? 0), Number(body.revenueGenerated ?? current.revenue_generated ?? 0),
        current.id,
      ]
    )).rows[0];
    res.json(campaignForClient(updated));
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

// ─── B2B Prospecting ─────────────────────────────────────────────────────────
function prospectingSearchForClient(row) {
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    userId: row.user_id,
    radiusKm: row.radius_km,
    requestedLimit: Number(row.requested_limit || 0),
    totalFound: Number(row.total_found || 0),
    totalWithEmail: Number(row.total_with_email || 0),
    totalWithPhone: Number(row.total_with_phone || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function prospectForClient(row) {
  return {
    ...row,
    organizationId: row.organization_id,
    businessId: row.business_id,
    searchId: row.search_id,
    companyName: row.company_name,
    legalName: row.legal_name,
    taxId: row.tax_id,
    address: row.address,
    neighborhood: row.neighborhood,
    postalCode: row.postal_code,
    notes: row.notes,
    sourceType: row.source_type,
    importBatchKey: row.import_batch_key,
    importFileName: row.import_file_name,
    importedAt: row.imported_at,
    emailType: row.email_type,
    websiteStatus: row.website_status,
    sourceUrl: row.source_url,
    contactSource: row.contact_source,
    qualificationScore: row.qualification_score == null ? null : Number(row.qualification_score),
    qualificationReason: row.qualification_reason,
    qualificationFit: row.qualification_fit,
    possibleNeed: row.possible_need,
    crmLeadId: row.crm_lead_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let prospectingImportSchemaReady = false;
async function ensureProspectingImportSchema(pool) {
  if (prospectingImportSchemaReady) return;
  await pool.query(`
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tax_id text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS neighborhood text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS postal_code text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'search';
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS import_batch_key text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS import_file_name text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS imported_at timestamp;
    CREATE INDEX IF NOT EXISTS prospects_business_source_idx ON prospects (business_id, source_type);
    CREATE INDEX IF NOT EXISTS prospects_business_tax_id_idx ON prospects (business_id, tax_id);
  `);
  prospectingImportSchemaReady = true;
}

function cleanSpreadsheetValue(value, maxLength = 500) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function digitsOnly(value, maxLength = 20) {
  const valueDigits = String(value ?? '').replace(/\D/g, '');
  return valueDigits && !/^0+$/.test(valueDigits) ? valueDigits.slice(0, maxLength) : null;
}

function normalizeProspectingText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function discoverProspectingCompanies(params) {
  const query = [params.segment, params.keywords, params.city, params.state, params.country].filter(Boolean).join(' ');
  const limit = Math.min(50, Math.max(1, Number(params.limit || 25)));
  let companies = [];

  if (process.env.GEOAPIFY_API_KEY) {
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.searchParams.set('text', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('apiKey', process.env.GEOAPIFY_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`O provedor Geoapify respondeu com status ${response.status}.`);
    const data = await response.json();
    companies = (Array.isArray(data.features) ? data.features : []).map(feature => {
      const p = feature.properties || {};
      return {
        companyName: p.name || p.company || p.legal_name,
        legalName: p.legal_name || null,
        segment: params.segment,
        description: p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(', '),
        city: p.city || p.municipality || p.county || params.city || null,
        state: p.state || p.state_code || params.state || null,
        country: p.country || params.country || 'Brasil',
        website: p.website || p.contact?.website || p.url || null,
        phone: p.phone || p.contact?.phone || p.contact?.mobile || null,
        email: p.email || p.contact?.email || null,
        sourceUrl: p.website || p.contact?.website || null,
        contactSource: 'Geoapify',
        resultType: p.result_type || p.place_type || null,
      };
    });
  }

  if (!companies.length && process.env.GOOGLE_PLACES_API_KEY) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`O provedor Google Places respondeu com status ${response.status}.`);
    const data = await response.json();
    const places = (Array.isArray(data.results) ? data.results : []).slice(0, limit);
    companies = await Promise.all(places.map(async place => {
      let details = {};
      if (place.place_id) {
        try {
          const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
          detailsUrl.searchParams.set('place_id', place.place_id);
          detailsUrl.searchParams.set('fields', 'name,website,formatted_phone_number,international_phone_number');
          detailsUrl.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY);
          const detailsResponse = await fetch(detailsUrl, { signal: AbortSignal.timeout(8000) });
          if (detailsResponse.ok) details = (await detailsResponse.json()).result || {};
        } catch { /* Keep the public text-search result when details time out. */ }
      }
      return {
        companyName: details.name || place.name,
        legalName: null,
        segment: params.segment,
        description: place.formatted_address || place.vicinity || null,
        city: params.city || null,
        state: params.state || null,
        country: params.country || 'Brasil',
        website: details.website || null,
        phone: details.formatted_phone_number || details.international_phone_number || null,
        email: null,
        sourceUrl: details.website || null,
        contactSource: 'Google Places',
      };
    }));
  }

  if (!process.env.GEOAPIFY_API_KEY && !process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error('Configure GEOAPIFY_API_KEY ou GOOGLE_PLACES_API_KEY para realizar buscas reais.');
  }

  const invalidNames = new Set([
    normalizeProspectingText(params.city), normalizeProspectingText(params.state),
    normalizeProspectingText(params.country), 'brasil', 'brazil',
  ].filter(Boolean));
  const seen = new Set();
  return companies.filter(company => {
    const name = String(company.companyName || '').trim();
    if (['city', 'county', 'state', 'country', 'postcode', 'street'].includes(String(company.resultType || '').toLowerCase())) return false;
    if (name.length < 2 || invalidNames.has(normalizeProspectingText(name))) return false;
    const signature = `${normalizeProspectingText(name)}:${normalizeProspectingText(company.city)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).slice(0, limit);
}

app.post('/api/prospecting/search', async (req, res) => {
  const pool = createPool();
  let searchRecord;
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const decoded = verifyToken(req);
    const segment = String(req.body?.segment || '').trim();
    if (!segment) return res.status(400).json({ error: 'Segmento é obrigatório para realizar a busca.' });
    const requestedLimit = Math.min(50, Math.max(1, Number(req.body?.requestedLimit || 25)));
    const params = {
      segment,
      city: String(req.body?.city || '').trim(),
      state: String(req.body?.state || '').trim(),
      country: String(req.body?.country || 'Brasil').trim() || 'Brasil',
      keywords: String(req.body?.keywords || '').trim(),
      radiusKm: req.body?.radiusKm ? Number(req.body.radiusKm) : null,
      limit: requestedLimit,
    };
    searchRecord = (await pool.query(
      `INSERT INTO prospecting_searches
        (organization_id, business_id, user_id, segment, city, state, country, radius_km, keywords, requested_limit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'running') RETURNING *`,
      [authorized.business.organization_id, authorized.business.id, decoded.userId, segment, params.city || null, params.state || null, params.country, params.radiusKm, params.keywords || null, requestedLimit]
    )).rows[0];

    const discovered = await discoverProspectingCompanies(params);
    client = await pool.connect();
    await client.query('BEGIN');
    const saved = [];
    for (const company of discovered) {
      const contactPoints = [company.email, company.phone, company.website].filter(Boolean).length;
      const score = Math.min(100, 35 + contactPoints * 15 + (company.description ? 10 : 0));
      const fit = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
      let domain = null;
      try { domain = company.website ? new URL(company.website).hostname.replace(/^www\./, '') : null; } catch { /* Invalid public URL */ }
      const row = (await client.query(
        `INSERT INTO prospects
          (organization_id, business_id, search_id, company_name, legal_name, segment, description, city, state, country,
           website, domain, phone, email, email_type, website_status, source_url, contact_source, confidence,
           qualification_score, qualification_reason, qualification_fit, possible_need, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
        [
          authorized.business.organization_id, authorized.business.id, searchRecord.id, company.companyName, company.legalName,
          segment, company.description, company.city, company.state, company.country, company.website, domain, company.phone,
          company.email, company.email ? 'general' : null, company.website ? (company.email || company.phone ? 'contact_found' : 'website_found_no_contact') : 'no_website_found',
          company.sourceUrl, company.contactSource, contactPoints >= 2 ? 'high' : 'medium', score,
          `Pontuação baseada na completude dos dados públicos encontrados (${contactPoints} meios de contato).`, fit,
          `Possível interesse em soluções relacionadas a ${authorized.business.segment || authorized.business.name}.`, fit === 'high' ? 'qualified' : 'new',
        ]
      )).rows[0];
      saved.push(row);
    }
    const totalWithEmail = saved.filter(item => item.email).length;
    const totalWithPhone = saved.filter(item => item.phone).length;
    await client.query(
      `UPDATE prospecting_searches SET status='completed', total_found=$1, total_with_email=$2,
       total_with_phone=$3, completed_at=NOW(), updated_at=NOW() WHERE id=$4`,
      [saved.length, totalWithEmail, totalWithPhone, searchRecord.id]
    );
    await client.query('COMMIT');
    res.json({ searchId: searchRecord.id, totalFound: saved.length, totalWithEmail, totalWithPhone });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (searchRecord?.id) await pool.query("UPDATE prospecting_searches SET status='failed', updated_at=NOW() WHERE id=$1", [searchRecord.id]).catch(() => {});
    console.error('[prospecting-search]', e.message);
    res.status(e.name === 'TimeoutError' ? 504 : 500).json({ error: e.message || 'Falha ao executar busca de prospecção.' });
  } finally {
    client?.release();
    pool.end().catch(() => {});
  }
});

app.get('/api/prospecting/searches', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const rows = (await pool.query('SELECT * FROM prospecting_searches WHERE business_id=$1 ORDER BY created_at DESC', [authorized.business.id])).rows;
    res.json({ searches: rows.map(prospectingSearchForClient) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/searches/:searchId', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const search = (await pool.query('SELECT * FROM prospecting_searches WHERE id=$1 AND business_id=$2', [req.params.searchId, authorized.business.id])).rows[0];
    if (!search) return res.status(404).json({ error: 'Busca de prospecção não encontrada.' });
    const prospects = (await pool.query('SELECT * FROM prospects WHERE search_id=$1 AND business_id=$2 ORDER BY qualification_score DESC NULLS LAST, created_at DESC', [search.id, authorized.business.id])).rows;
    res.json({ search: prospectingSearchForClient(search), prospects: prospects.map(prospectForClient) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/prospects', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    if (req.query.origin === 'spreadsheet' || req.query.origin === 'search') await ensureProspectingImportSchema(pool);
    const conditions = ['business_id=$1'];
    const values = [authorized.business.id];
    const add = (condition, value) => { values.push(value); conditions.push(condition.replace('?', `$${values.length}`)); };
    if (req.query.hasEmail === 'true') conditions.push("email IS NOT NULL AND email<>''");
    if (req.query.hasPhone === 'true') conditions.push("phone IS NOT NULL AND phone<>''");
    if (req.query.hasWebsite === 'true') conditions.push("website IS NOT NULL AND website<>''");
    if (req.query.status) add('status=?', String(req.query.status));
    if (req.query.fit) add('qualification_fit=?', String(req.query.fit));
    if (req.query.origin === 'spreadsheet') conditions.push("source_type='spreadsheet'");
    if (req.query.origin === 'search') conditions.push("COALESCE(source_type, 'search')='search'");
    if (req.query.state) add('state ILIKE ?', String(req.query.state).trim());
    if (req.query.segment) add('segment ILIKE ?', `%${String(req.query.segment).trim()}%`);
    if (req.query.search) add("(company_name ILIKE ? OR city ILIKE ? OR email ILIKE ? OR website ILIKE ?)", `%${String(req.query.search).trim()}%`);
    // Expand the single search placeholder safely for all four searchable columns.
    if (req.query.search) {
      const searchValue = values.pop();
      conditions.pop();
      const placeholders = [];
      for (let i = 0; i < 4; i++) { values.push(searchValue); placeholders.push(`$${values.length}`); }
      conditions.push(`(company_name ILIKE ${placeholders[0]} OR city ILIKE ${placeholders[1]} OR email ILIKE ${placeholders[2]} OR website ILIKE ${placeholders[3]})`);
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(25, Number(req.query.pageSize || (req.query.origin === 'spreadsheet' ? 100 : 200))));
    const count = Number((await pool.query(`SELECT COUNT(*) FROM prospects WHERE ${conditions.join(' AND ')}`, values)).rows[0]?.count || 0);
    const queryValues = [...values, pageSize, (page - 1) * pageSize];
    const rows = (await pool.query(`SELECT * FROM prospects WHERE ${conditions.join(' AND ')} ORDER BY qualification_score DESC NULLS LAST, created_at DESC LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`, queryValues)).rows;
    res.json({ prospects: rows.map(prospectForClient), pagination: { page, pageSize, total: count, totalPages: Math.max(1, Math.ceil(count / pageSize)) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/import-spreadsheet', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const inputRows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 250) : [];
    if (!inputRows.length) return res.status(400).json({ error: 'Nenhuma empresa foi enviada para importação.' });
    await ensureProspectingImportSchema(pool);

    const existingRows = (await pool.query(
      `SELECT tax_id, LOWER(COALESCE(email,'')) AS email,
              regexp_replace(COALESCE(phone,''), '\\D', '', 'g') AS phone,
              LOWER(COALESCE(company_name,'')) || '|' || LOWER(COALESCE(city,'')) AS name_city
         FROM prospects WHERE business_id=$1`,
      [authorized.business.id]
    )).rows;
    const known = new Set();
    for (const item of existingRows) {
      if (item.tax_id) known.add(`tax:${digitsOnly(item.tax_id, 20)}`);
      if (item.email) known.add(`email:${item.email}`);
      if (item.phone) known.add(`phone:${item.phone}`);
      if (item.name_city !== '|') known.add(`name:${item.name_city}`);
    }

    const accepted = [];
    let duplicates = 0;
    let invalid = 0;
    for (const raw of inputRows) {
      const companyName = cleanSpreadsheetValue(raw?.companyName, 250);
      if (!companyName) { invalid++; continue; }
      const taxId = digitsOnly(raw?.taxId, 20);
      const email = cleanSpreadsheetValue(raw?.email, 250)?.toLowerCase() || null;
      const phone = digitsOnly(raw?.phone, 20);
      const city = cleanSpreadsheetValue(raw?.city, 120);
      const signatures = [
        taxId ? `tax:${taxId}` : null,
        email ? `email:${email}` : null,
        phone ? `phone:${phone}` : null,
        `name:${companyName.toLowerCase()}|${String(city || '').toLowerCase()}`,
      ].filter(Boolean);
      if (signatures.some(signature => known.has(signature))) { duplicates++; continue; }
      signatures.forEach(signature => known.add(signature));
      accepted.push({
        companyName, taxId, email, phone, city,
        address: cleanSpreadsheetValue(raw?.address, 500),
        neighborhood: cleanSpreadsheetValue(raw?.neighborhood, 150),
        state: cleanSpreadsheetValue(raw?.state, 40)?.toUpperCase() || null,
        postalCode: digitsOnly(raw?.postalCode, 12),
        segment: cleanSpreadsheetValue(raw?.segment, 200),
        notes: cleanSpreadsheetValue(raw?.notes, 4000),
      });
    }

    if (accepted.length) {
      const fileName = cleanSpreadsheetValue(req.body?.fileName, 250) || 'Planilha importada';
      const batchKey = cleanSpreadsheetValue(req.body?.batchKey, 100) || `${Date.now()}`;
      const params = [];
      const tuples = accepted.map(item => {
        const score = Math.min(70, 20 + [item.taxId, item.email, item.phone, item.address].filter(Boolean).length * 10);
        const values = [
          authorized.business.organization_id, authorized.business.id, item.companyName, item.companyName,
          item.segment, item.city, item.state, 'Brasil', item.phone, item.email, item.taxId, item.address,
          item.neighborhood, item.postalCode, item.notes, 'spreadsheet', batchKey, fileName,
          item.email ? 'general' : null, item.email || item.phone ? 'contact_found' : 'no_website_found',
          `Planilha: ${fileName}`, item.email && item.phone ? 'high' : 'medium', score,
          'Importado de planilha; aguardando qualificação comercial.', score >= 60 ? 'medium' : 'low', 'new',
        ];
        const placeholders = values.map(value => { params.push(value); return `$${params.length}`; });
        return `(${placeholders.join(',')}, NOW(), NOW(), NOW())`;
      });
      await pool.query(
        `INSERT INTO prospects
          (organization_id, business_id, company_name, legal_name, segment, city, state, country, phone, email,
           tax_id, address, neighborhood, postal_code, notes, source_type, import_batch_key, import_file_name,
           email_type, website_status, contact_source, confidence, qualification_score, qualification_reason,
           qualification_fit, status, imported_at, created_at, updated_at)
         VALUES ${tuples.join(',')}`,
        params
      );
    }
    res.json({ imported: accepted.length, duplicates, invalid });
  } catch (e) {
    console.error('[prospecting-spreadsheet-import]', e.message);
    res.status(500).json({ error: e.message || 'Falha ao importar a planilha.' });
  } finally { pool.end().catch(() => {}); }
});

app.patch('/api/prospecting/prospects/status', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 250) : [];
    const allowed = new Set(['new', 'reviewed', 'qualified', 'disqualified']);
    const status = String(req.body?.status || '');
    if (!ids.length || !allowed.has(status)) return res.status(400).json({ error: 'Seleção ou status inválido.' });
    const updated = await pool.query(
      'UPDATE prospects SET status=$1, updated_at=NOW() WHERE business_id=$2 AND id=ANY($3::uuid[]) AND crm_lead_id IS NULL RETURNING id',
      [status, authorized.business.id, ids]
    );
    res.json({ updatedCount: updated.rowCount || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.post('/api/prospecting/prospects/import', async (req, res) => {
  const pool = createPool();
  let client;
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 250) : [];
    if (!ids.length) return res.status(400).json({ error: 'Nenhum prospect selecionado para importação.' });
    client = await pool.connect();
    await client.query('BEGIN');
    const prospects = (await client.query('SELECT * FROM prospects WHERE business_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE', [authorized.business.id, ids])).rows;
    let importedCount = 0;
    for (const prospect of prospects) {
      if (prospect.crm_lead_id) continue;
      const duplicateConditions = ['LOWER(company_name)=LOWER($2)'];
      const duplicateValues = [authorized.business.id, prospect.company_name];
      if (prospect.email) {
        duplicateValues.push(prospect.email);
        duplicateConditions.push(`LOWER(email)=LOWER($${duplicateValues.length})`);
      }
      if (prospect.phone) {
        duplicateValues.push(String(prospect.phone).replace(/\D/g, ''));
        duplicateConditions.push(`regexp_replace(COALESCE(phone,''), '\\D', '', 'g')=$${duplicateValues.length}`);
      }
      const existingLead = (await client.query(
        `SELECT id FROM leads WHERE business_id=$1 AND (${duplicateConditions.join(' OR ')}) LIMIT 1`,
        duplicateValues
      )).rows[0];
      if (existingLead) {
        await client.query("UPDATE prospects SET status='imported', crm_lead_id=$1, updated_at=NOW() WHERE id=$2", [existingLead.id, prospect.id]);
        continue;
      }
      const lead = (await client.query(
        `INSERT INTO leads (organization_id, business_id, name, company_name, email, phone, source, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,'Prospecção','new',$7) RETURNING id`,
        [authorized.business.organization_id, authorized.business.id, prospect.company_name, prospect.company_name, prospect.email, prospect.phone, `Importado da prospecção. ${prospect.qualification_reason || ''}`]
      )).rows[0];
      await client.query("UPDATE prospects SET status='imported', crm_lead_id=$1, updated_at=NOW() WHERE id=$2", [lead.id, prospect.id]);
      importedCount++;
    }
    await client.query('COMMIT');
    res.json({ importedCount });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally { client?.release(); pool.end().catch(() => {}); }
});

app.post('/api/prospecting/prospects/export', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 1000) : [];
    const result = ids.length
      ? await pool.query('SELECT * FROM prospects WHERE business_id=$1 AND id=ANY($2::uuid[]) ORDER BY company_name', [authorized.business.id, ids])
      : await pool.query('SELECT * FROM prospects WHERE business_id=$1 ORDER BY company_name', [authorized.business.id]);
    const csv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = result.rows.map(item => [item.company_name, item.tax_id, item.segment, item.city, item.state, item.website, item.email, item.phone, item.qualification_score, item.qualification_fit, item.status, item.import_file_name].map(csv).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
    res.send('\uFEFF' + ['Empresa,CNPJ/CPF,Segmento,Cidade,Estado,Site,Email,Telefone,Pontuação,Aderência,Status,Arquivo de origem', ...rows].join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { pool.end().catch(() => {}); }
});

app.get('/api/prospecting/prospects/:id', async (req, res) => {
  const pool = createPool();
  try {
    const authorized = await getAuthorizedBusiness(pool, req);
    if (authorized.error) return res.status(authorized.error).json({ error: authorized.message });
    const prospect = (await pool.query('SELECT * FROM prospects WHERE id=$1 AND business_id=$2', [req.params.id, authorized.business.id])).rows[0];
    if (!prospect) return res.status(404).json({ error: 'Prospect não encontrado.' });
    const contacts = (await pool.query('SELECT * FROM prospect_contacts WHERE prospect_id=$1 ORDER BY is_primary DESC, created_at', [prospect.id])).rows;
    res.json({ prospect: prospectForClient(prospect), contacts: contacts.map(contact => ({ ...contact, prospectId: contact.prospect_id, sourceUrl: contact.source_url, isPrimary: contact.is_primary, createdAt: contact.created_at })) });
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
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: 1200 },
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
    'SELECT * FROM businesses WHERE organization_id=$1 LIMIT 1',
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
