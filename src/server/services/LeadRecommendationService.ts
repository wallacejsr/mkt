import { db } from '../../db/index.ts';
import { leads } from '../../db/schema.ts';
import { eq, and, ne } from 'drizzle-orm';

export interface LeadRecommendation {
  id: string; // unique key for UI
  leadId: string;
  leadName: string;
  companyName?: string | null;
  ruleType: 'new_lead_uncontacted' | 'lead_stagnant' | 'next_action_overdue' | 'proposal_stagnant';
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baixa';
  score: number;
  nextAction?: string | null;
  nextActionAt?: Date | string | null;
  createdAt: Date;
}

export class LeadRecommendationService {
  public static async getRecommendationsForBusiness(businessId: string): Promise<LeadRecommendation[]> {
    const allLeads = await db.select()
      .from(leads)
      .where(eq(leads.businessId, businessId));

    const now = new Date();
    const nowTime = now.getTime();
    const recommendations: LeadRecommendation[] = [];

    for (const lead of allLeads) {
      if (lead.status === 'customer' || lead.status === 'lost') {
        continue;
      }

      const createdAtTime = lead.createdAt ? new Date(lead.createdAt).getTime() : nowTime;
      const lastContactTime = lead.lastContactAt ? new Date(lead.lastContactAt).getTime() : createdAtTime;
      const hoursSinceCreated = (nowTime - createdAtTime) / (1000 * 60 * 60);
      const hoursSinceLastContact = (nowTime - lastContactTime) / (1000 * 60 * 60);

      // REGRA 3 — PRÓXIMA AÇÃO ATRASADA (Score: 100)
      if (lead.nextActionAt) {
        const nextActionTime = new Date(lead.nextActionAt).getTime();
        if (nextActionTime < nowTime) {
          recommendations.push({
            id: `overdue-${lead.id}`,
            leadId: lead.id,
            leadName: lead.name,
            companyName: lead.companyName,
            ruleType: 'next_action_overdue',
            title: 'Próxima ação atrasada',
            description: `Ação "${lead.nextAction || 'Follow-up'}" estava agendada para ${new Date(lead.nextActionAt).toLocaleDateString('pt-BR')}.`,
            priority: 'alta',
            score: 100,
            nextAction: lead.nextAction,
            nextActionAt: lead.nextActionAt,
            createdAt: now,
          });
          continue; // Avoid duplicate alerts per lead if action is overdue
        }
      }

      // REGRA 1 — LEAD NOVO SEM CONTATO (> 24h) (Score: 90)
      if (lead.status === 'new' && hoursSinceCreated > 24 && !lead.lastContactAt) {
        recommendations.push({
          id: `new-${lead.id}`,
          leadId: lead.id,
          leadName: lead.name,
          companyName: lead.companyName,
          ruleType: 'new_lead_uncontacted',
          title: 'Lead aguardando primeiro contato',
          description: `Novo lead cadastrado há mais de 24 horas sem nenhum contato registrado.`,
          priority: 'alta',
          score: 90,
          createdAt: now,
        });
        continue;
      }

      // REGRA 4 — PROPOSTA PARADA (> 3 dias) (Score: 85)
      if (lead.status === 'proposal' && hoursSinceLastContact > 72) {
        recommendations.push({
          id: `proposal-${lead.id}`,
          leadId: lead.id,
          leadName: lead.name,
          companyName: lead.companyName,
          ruleType: 'proposal_stagnant',
          title: 'Proposta aguardando follow-up',
          description: `Proposta enviada sem novidades/contato há mais de 3 dias.`,
          priority: 'alta',
          score: 85,
          createdAt: now,
        });
        continue;
      }

      // REGRA 2 — LEAD PARADO (> 48h sem contato) (Score: 70)
      if (hoursSinceLastContact > 48) {
        recommendations.push({
          id: `stagnant-${lead.id}`,
          leadId: lead.id,
          leadName: lead.name,
          companyName: lead.companyName,
          ruleType: 'lead_stagnant',
          title: 'Lead sem contato há mais de 48 horas',
          description: `Sem registros de contato há ${Math.floor(hoursSinceLastContact / 24)} dias.`,
          priority: 'media',
          score: 70,
          createdAt: now,
        });
      }
    }

    // Sort recommendations by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }
}
