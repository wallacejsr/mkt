import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { createPool } from '../../db';
import { requireAuth } from '../../middleware/auth';

export const assistantRouter = Router();

assistantRouter.post('/chat', requireAuth, async (req: any, res) => {
  const pool = createPool();
  try {
    const message = String(req.body?.message || '').trim();
    const businessId = String(req.query.businessId || '');
    if (!message) return res.status(400).json({ error: 'Digite uma mensagem para o assistente.' });
    if (!businessId) return res.status(400).json({ error: 'Empresa não informada.' });
    if (message.length > 2000) return res.status(400).json({ error: 'A mensagem deve ter no máximo 2.000 caracteres.' });

    const ownedBusiness = (await pool.query(
      `SELECT b.* FROM businesses b
       JOIN organization_members om ON om.organization_id=b.organization_id
       WHERE b.id=$1 AND om.user_id=$2 LIMIT 1`,
      [businessId, req.user.userId]
    )).rows[0];
    if (!ownedBusiness) return res.status(403).json({ error: 'Acesso negado a esta empresa.' });

    const [products, audience, goals, campaigns, pipeline] = await Promise.all([
      pool.query('SELECT name, type, description, main_benefit, ideal_customer FROM products WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query('SELECT description, profile, pains, desires, objections FROM target_audiences WHERE business_id=$1 ORDER BY created_at DESC LIMIT 1', [businessId]),
      pool.query('SELECT goal_type, target_metric, timeframe FROM goals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 5', [businessId]),
      pool.query('SELECT name, objective, status, budget, leads, sales FROM campaigns WHERE business_id=$1 ORDER BY created_at DESC LIMIT 10', [businessId]),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status='proposal')::int AS proposals,
                         COUNT(*) FILTER (WHERE status='customer')::int AS customers
                  FROM leads WHERE business_id=$1`, [businessId]),
    ]);

    const context = {
      business: ownedBusiness,
      products: products.rows,
      audience: audience.rows[0] || null,
      goals: goals.rows,
      campaigns: campaigns.rows,
      pipeline: pipeline.rows[0],
    };
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .slice(-8)
      .filter((item: any) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .map((item: any) => `${item.role === 'user' ? 'Usuário' : 'Assistente'}: ${item.content.slice(0, 2000)}`)
      .join('\n');

    if (!process.env.GEMINI_API_KEY) {
      const stats = context.pipeline;
      return res.json({ answer: Number(stats.total || 0)
        ? `O funil possui ${stats.total} leads, ${stats.proposals} propostas e ${stats.customers} clientes. Priorize o acompanhamento das propostas abertas e mantenha os próximos contatos registrados.`
        : 'Ainda não há leads suficientes para uma análise. Cadastre os primeiros contatos no CRM para que eu possa identificar prioridades e conversões.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Você é o Assistente de Marketing e Vendas do Marketing OS. Responda em português do Brasil de forma prática e direta. Use somente os dados fornecidos; não invente resultados. Quando faltarem dados, informe isso. Não diga que executou ações.\n\nDADOS:\n${JSON.stringify(context)}\n\nHISTÓRICO:\n${history || 'Sem histórico.'}\n\nPERGUNTA:\n${message}`,
      config: { temperature: 0.5, maxOutputTokens: 1200 },
    });
    const answer = String(response.text || '').trim();
    if (!answer) throw new Error('Resposta vazia do assistente.');
    res.json({ answer });
  } catch (error: any) {
    console.error('[assistant-chat]', error.message);
    res.status(500).json({ error: 'Não foi possível gerar a resposta agora. Tente novamente.' });
  }
});
