import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();

// ─── CORS + JSON parsing ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json({ limit: '2mb' }));

// ─── Config ───────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'mkt-agro-bw-secret-key-2026';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function createPool() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL não configurado nas variáveis de ambiente da Vercel.');
  }
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000,
  });
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    hasDb: !!DATABASE_URL,
    dbHost: DATABASE_URL ? new URL(DATABASE_URL).host : 'N/A',
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const pool = createPool();
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [String(email).trim().toLowerCase()]
    );
    const user = userResult.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const memberResult = await pool.query(
      'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
      [user.id]
    );
    let business = null;
    if (memberResult.rows[0]) {
      const bizResult = await pool.query(
        'SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1',
        [memberResult.rows[0].organization_id]
      );
      business = bizResult.rows[0] || null;
    }

    const token = jwt.sign(
      { userId: user.id, uid: user.uid, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser, business });
  } catch (err: any) {
    console.error('[login]', err.message);
    return res.status(500).json({ error: err.message || 'Erro interno ao fazer login.' });
  } finally {
    pool.end().catch(() => {});
  }
});

// ─── Register ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const pool = createPool();
  try {
    const { name, email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows[0]) {
      return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const userResult = await pool.query(
      'INSERT INTO users (uid, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [uid, normalizedEmail, name || '', passwordHash]
    );
    const newUser = userResult.rows[0];

    const orgName = name ? `Empresa de ${name}` : `Empresa de ${normalizedEmail.split('@')[0]}`;
    const orgResult = await pool.query('INSERT INTO organizations (name) VALUES ($1) RETURNING *', [orgName]);
    const org = orgResult.rows[0];

    await pool.query(
      'INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1, $2, $3)',
      [newUser.id, org.id, 'owner']
    );

    const bizResult = await pool.query(
      'INSERT INTO businesses (organization_id, name) VALUES ($1, $2) RETURNING *',
      [org.id, 'Negócio Principal']
    );
    const business = bizResult.rows[0];

    const token = jwt.sign(
      { userId: newUser.id, uid: newUser.uid, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash, ...safeUser } = newUser;
    return res.json({ token, user: safeUser, business });
  } catch (err: any) {
    console.error('[register]', err.message);
    return res.status(400).json({ error: err.message || 'Erro ao registrar.' });
  } finally {
    pool.end().catch(() => {});
  }
});

// ─── Auth/me ──────────────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  const pool = createPool();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(authHeader.split('Bearer ')[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [decoded.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const memberResult = await pool.query(
      'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
      [user.id]
    );
    let business = null;
    if (memberResult.rows[0]) {
      const bizResult = await pool.query(
        'SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1',
        [memberResult.rows[0].organization_id]
      );
      business = bizResult.rows[0] || null;
    }

    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser, business });
  } catch (err: any) {
    console.error('[me]', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    pool.end().catch(() => {});
  }
});

// ─── Sync compat ──────────────────────────────────────────────────────────────
app.post('/api/auth/sync', (_req, res) => res.json({ ok: true }));

// ─── Catch-all: load full app lazily ─────────────────────────────────────────
let fullApp: express.Application | null = null;

app.use('/api', async (req, res, next) => {
  if (!fullApp) {
    try {
      const mod = await import('../src/server/app');
      fullApp = mod.app;
    } catch (err: any) {
      console.error('[full-app-load]', err.message);
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
    }
  }
  fullApp!(req as any, res as any, next);
});

export default app;
