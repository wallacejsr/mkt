import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'mkt-agro-bw-secret-key-2026';
const DATABASE_URL = process.env.DATABASE_URL;

function createPool() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    hasDb: !!DATABASE_URL,
    hasJwt: !!process.env.JWT_SECRET,
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const pool = createPool();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email.trim().toLowerCase()]
    );
    const user = userResult.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Find business
    const memberResult = await pool.query(
      'SELECT * FROM organization_members WHERE user_id = $1 LIMIT 1',
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
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  } finally {
    await pool.end().catch(() => {});
  }
});

// ─── Register ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const pool = createPool();
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows[0]) {
      return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const normalizedEmail = email.trim().toLowerCase();

    // Insert user
    const userResult = await pool.query(
      'INSERT INTO users (uid, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [uid, normalizedEmail, name || '', passwordHash]
    );
    const newUser = userResult.rows[0];

    // Create org
    const orgName = name ? `Empresa de ${name}` : `Empresa de ${normalizedEmail.split('@')[0]}`;
    const orgResult = await pool.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING *',
      [orgName]
    );
    const org = orgResult.rows[0];

    // Create membership
    await pool.query(
      'INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1, $2, $3)',
      [newUser.id, org.id, 'owner']
    );

    // Create business
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
    console.error('Register error:', err);
    return res.status(400).json({ error: err.message || 'Erro ao registrar.' });
  } finally {
    await pool.end().catch(() => {});
  }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  const pool = createPool();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [decoded.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const memberResult = await pool.query(
      'SELECT * FROM organization_members WHERE user_id = $1 LIMIT 1',
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
    console.error('Auth me error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await pool.end().catch(() => {});
  }
});

// ─── Sync (legacy compat) ─────────────────────────────────────────────────────
app.post('/api/auth/sync', async (req, res) => {
  res.status(200).json({ message: 'sync deprecated' });
});

// ─── All other API routes: load full app lazily ───────────────────────────────
// These are loaded on-demand to keep the cold start fast
let fullApp: express.Application | null = null;

async function getFullApp() {
  if (!fullApp) {
    const { app: serverApp } = await import('../src/server/app');
    fullApp = serverApp;
  }
  return fullApp;
}

app.use('/api', async (req, res, next) => {
  try {
    const server = await getFullApp();
    server(req as any, res as any, next);
  } catch (err: any) {
    console.error('Full app load error:', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
});

export default app;
