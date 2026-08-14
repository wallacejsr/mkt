/**
 * Vercel Serverless Function Entry Point
 * 
 * Auth routes (login/register/me) are handled self-contained here for reliability.
 * Other routes are delegated to the full Express app from src/server/app.
 */
import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function createPool() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL não configurado na Vercel.');
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000,
  });
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), hasDb: !!DATABASE_URL });
});

// ── Login ─────────────────────────────────────────────────────────────────────
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

// ── Register ──────────────────────────────────────────────────────────────────
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

// ── Me ────────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  const pool = createPool();
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado.' });
    let decoded: any;
    try { decoded = jwt.verify(h.split('Bearer ')[1], JWT_SECRET); } catch { return res.status(401).json({ error: 'Token inválido.' }); }

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

// ── All other /api/* routes → full Express app (static import for @vercel/node) ─
import { app as fullApp } from '../src/server/app';

app.use((req, res, next) => {
  // Strip auth routes already handled above
  fullApp(req as any, res as any, next);
});

export default app;
