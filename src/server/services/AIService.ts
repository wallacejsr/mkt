import { GoogleGenAI, Type, Schema } from '@google/genai';
import { db } from '../../db/index';
import { 
  businesses, products, targetAudiences, marketingProfiles, goals,
  strategies, strategyChannels, strategyPlanWeeks, opportunities, aiGenerations
} from '../../db/schema';
import { eq } from 'drizzle-orm';

export class AIService {
  private ai: GoogleGenAI | null = null;

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY não configurado.');
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
    }
    return this.ai;
  }

  async generateInitialStrategy(businessId: string, orgId: string) {
    try {
      // 1. Fetch all business context
      const business = await db.select().from(businesses).where(eq(businesses.id, businessId)).then(r => r[0]);
      const businessProducts = await db.select().from(products).where(eq(products.businessId, businessId));
      const audiences = await db.select().from(targetAudiences).where(eq(targetAudiences.businessId, businessId));
      const mktProfiles = await db.select().from(marketingProfiles).where(eq(marketingProfiles.businessId, businessId));
      const businessGoals = await db.select().from(goals).where(eq(goals.businessId, businessId));

      const audience: any = audiences[0] || {};
      const mktProfile: any = mktProfiles[0] || {};
      const goal: any = businessGoals[0] || {};

      // 2. Build prompt context
      const context = `
Empresa: ${business.name}
Segmento: ${business.segment}
Descrição: ${business.description}
Área de Atuação: ${business.serviceArea} (${business.serviceType})

Produtos/Serviços:
${businessProducts.map(p => `- ${p.name} (${p.type}): ${p.description}. Benefício: ${p.mainBenefit}. Diferenciais: ${p.differentiators}. Ticket: ${p.ticketValue}`).join('\n')}

Público-alvo:
Perfil: ${audience.profile}
Idade: ${audience.ageRange}
Localização: ${audience.location}
Dores: ${JSON.stringify(audience.pains)}
Desejos: ${JSON.stringify(audience.desires)}
Objeções: ${JSON.stringify(audience.objections)}

Marketing Atual:
Canais: ${JSON.stringify(mktProfile.channels)}
Frequência: ${mktProfile.postFrequency}
Investimento: ${mktProfile.monthlyInvestment}
Dificuldade principal: ${mktProfile.mainDifficulty}

Objetivo Atual:
Tipo: ${goal.goalType}
Métrica: ${goal.targetMetric}
Prazo: ${goal.timeframe}
`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          business_summary: { type: Type.STRING, description: "Resumo executivo do negócio e seu momento atual." },
          ideal_customer: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              main_pains: { type: Type.ARRAY, items: { type: Type.STRING } },
              main_desires: { type: Type.ARRAY, items: { type: Type.STRING } },
              main_objections: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
          },
          positioning: {
            type: Type.OBJECT,
            properties: {
              statement: { type: Type.STRING, description: "Frase principal de posicionamento da marca." },
              value_proposition: { type: Type.STRING, description: "Proposta de valor única." },
              differentiators: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
          },
          priority_channels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                channel: { type: Type.STRING },
                priority: { type: Type.INTEGER, description: "Ordem de prioridade, 1 sendo o mais importante." },
                reason: { type: Type.STRING, description: "Por que este canal é prioridade." }
              }
            }
          },
          opportunities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                impact: { type: Type.STRING, description: "high, medium ou low" }
              }
            }
          },
          plan_30_days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                week: { type: Type.INTEGER, description: "Número da semana (1 a 4)" },
                objective: { type: Type.STRING, description: "Objetivo central da semana" },
                actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Checklist de 3 a 5 ações práticas para a semana" }
              }
            }
          }
        },
        required: ["business_summary", "ideal_customer", "positioning", "priority_channels", "opportunities", "plan_30_days"]
      };

      const prompt = `Você é um Gerente de Marketing Sênior e Especialista em Estratégia de Negócios.
Analise a empresa fornecida e crie uma estratégia de marketing estruturada e acionável.
Se houver informações insuficientes em alguma categoria, faça inferências razoáveis para completar a estratégia, utilizando termos como "Uma possível hipótese..." quando não tiver certeza absoluta.

Informações da Empresa:
${context}`;

      // 3. Call AI
      const response = await this.getAI().models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        }
      });

      const textOutput = response.text;
      if (!textOutput) throw new Error("No output from AI");
      
      const parsed = JSON.parse(textOutput);

      // Log the generation
      await db.insert(aiGenerations).values({
        organizationId: orgId,
        businessId: businessId,
        type: 'initial_strategy',
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        output: parsed,
      });

      // 4. Save strategy to DB
      return await db.transaction(async (tx) => {
        const strat = await tx.insert(strategies).values({
          businessId,
          businessSummary: parsed.business_summary,
          idealCustomerDesc: parsed.ideal_customer.description,
          idealCustomerPains: parsed.ideal_customer.main_pains,
          idealCustomerDesires: parsed.ideal_customer.main_desires,
          idealCustomerObjections: parsed.ideal_customer.main_objections,
          positioningStatement: parsed.positioning.statement,
          valueProposition: parsed.positioning.value_proposition,
          differentiators: parsed.positioning.differentiators,
        }).returning().then(r => r[0]);

        for (const ch of parsed.priority_channels) {
          await tx.insert(strategyChannels).values({
            strategyId: strat.id,
            channel: ch.channel,
            priority: ch.priority,
            reason: ch.reason
          });
        }

        for (const week of parsed.plan_30_days) {
          await tx.insert(strategyPlanWeeks).values({
            strategyId: strat.id,
            week: week.week,
            objective: week.objective,
            actions: week.actions
          });
        }

        for (const opp of parsed.opportunities) {
          await tx.insert(opportunities).values({
            businessId,
            title: opp.title,
            description: opp.description,
            impact: opp.impact,
            effort: 'medium', // default
          });
        }
        
        return strat;
      });

    } catch (error) {
      console.error("AI Strategy Generation Error:", error);
      throw error;
    }
  }

  async generateContentCalendar(businessId: string, orgId: string, params: { periodDays: number, frequencyDesc: string, channels: string[], objective: string }, strategyDetails: any) {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        content_items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scheduled_date: { type: Type.STRING, description: "YYYY-MM-DD" },
              title: { type: Type.STRING },
              topic: { type: Type.STRING },
              channel: { type: Type.STRING },
              format: { type: Type.STRING },
              funnel_stage: { type: Type.STRING, description: "awareness, consideration, conversion, or retention" },
              objective: { type: Type.STRING },
              brief: { type: Type.STRING }
            }
          }
        }
      },
      required: ["content_items"]
    };

    const prompt = `Você é um Estrategista de Conteúdo Sênior.
Crie um calendário editorial para a empresa com base na estratégia atual.

Configurações do Calendário:
- Período: ${params.periodDays} dias (começando a partir de hoje: ${new Date().toISOString().split('T')[0]})
- Frequência: ${params.frequencyDesc}
- Canais Permitidos: ${params.channels.join(', ')}
- Objetivo Principal: ${params.objective}

Contexto da Empresa e Estratégia:
${JSON.stringify(strategyDetails, null, 2)}

Regras de Distribuição:
- Mantenha um equilíbrio entre educação/autoridade (40%), dores/desejos (25%), conversão (20%), e prova social/relacionamento (15%).
- Varie os formatos adequados para os canais selecionados.
- Utilize exclusivamente as dores, produtos e posicionamento fornecidos. Não invente benefícios, preços ou promessas que não estejam no contexto.
- Retorne apenas conteúdos com funnel_stage válidos: "awareness", "consideration", "conversion", "retention".
- As datas (scheduled_date) devem estar dentro do período especificado a partir de hoje.`;

    const response = await this.getAI().models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId: businessId,
      type: 'content_calendar',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      output: parsed,
    });

    return parsed.content_items;
  }

  async generateContentItem(orgId: string, businessId: string, itemData: any, strategyDetails: any) {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING, description: "Gancho (headline inicial) para reter atenção" },
        body: { type: Type.STRING, description: "Conteúdo principal/corpo do post" },
        caption: { type: Type.STRING, description: "Legenda para o canal social (se aplicável)" },
        cta: { type: Type.STRING, description: "Chamada para ação" },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        visual_direction: { type: Type.STRING, description: "Instruções ou ideia visual para a arte" },
        video_script: { type: Type.STRING, description: "Se for vídeo/reels, escreva a estrutura (Hook, Cenas, CTA). Se não, deixe vazio." }
      },
      required: ["title", "hook", "body", "caption", "cta", "hashtags", "visual_direction"]
    };

    const prompt = `Você é um Copywriter Sênior.
Escreva um conteúdo de alta qualidade baseado no briefing a seguir.
Utilize o contexto da empresa para garantir coerência. NUNCA invente preços, descontos, selos de garantia ou informações falsas.

Item de Conteúdo:
- Título/Tema: ${itemData.title || itemData.topic || ''}
- Canal: ${itemData.channel || ''}
- Formato: ${itemData.format || ''}
- Etapa do Funil: ${itemData.funnelStage || ''}
- Objetivo: ${itemData.objective || ''}
- Briefing: ${itemData.topic || ''}

Contexto Estratégico da Empresa:
${JSON.stringify(strategyDetails, null, 2)}`;

    const response = await this.getAI().models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);

    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId: businessId,
      type: 'content',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      output: parsed,
    });

    return parsed;
  }

  async refineContentText(orgId: string, businessId: string, currentText: string, instruction: string) {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        refined_text: { type: Type.STRING }
      },
      required: ["refined_text"]
    };

    const prompt = `Você é um Copywriter Sênior. Você precisa alterar o texto abaixo de acordo com a seguinte instrução: "${instruction}"

Texto original:
"""
${currentText}
"""

Retorne APENAS o texto modificado, mantendo a coerência.`;

    const response = await this.getAI().models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);

    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId: businessId,
      type: 'content_improvement',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      output: parsed,
    });

    return parsed.refined_text;
  }

  async generateCampaign(businessId: string, orgId: string, setupData: any, contextData: any) {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        campaign_name: { type: Type.STRING },
        campaign_summary: { type: Type.STRING },
        objective: { type: Type.STRING },
        target_audience: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            main_pain: { type: Type.STRING },
            main_desire: { type: Type.STRING },
            main_objection: { type: Type.STRING }
          }
        },
        offer: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            value_proposition: { type: Type.STRING },
            urgency: { type: Type.STRING }
          }
        },
        main_argument: { type: Type.STRING },
        messaging: {
          type: Type.OBJECT,
          properties: {
            main_message: { type: Type.STRING },
            supporting_arguments: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        channels: { type: Type.ARRAY, items: { type: Type.STRING } },
        plan_actions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["campaign_name", "campaign_summary", "objective", "target_audience", "offer", "main_argument", "messaging", "channels", "plan_actions"]
    };

    const prompt = `Você é um Estrategista de Campanhas Sênior.
Crie uma campanha de marketing acionável baseada nos dados fornecidos.

Dados de Configuração:
- Objetivo: ${setupData.objective}
- Instruções Adicionais: ${setupData.instructions || 'Nenhuma'}
- Canais Solicitados: ${setupData.channels.join(', ')}

Contexto do Negócio e Estratégia:
${JSON.stringify(contextData, null, 2)}

Regras de Ouro:
1. NUNCA invente preços, promoções ou descontos que não estejam no contexto. Se não houver, crie a oferta focando na proposta de valor, não em promoções financeiras.
2. A campanha deve ser executável, clara e objetiva.
3. Se um produto específico não foi selecionado, crie uma campanha institucional focada na marca.`;

    const response = await this.getAI().models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId: businessId,
      type: 'campaign_generation',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      output: parsed,
    });

    return parsed;
  }

  async generateCampaignAsset(orgId: string, businessId: string, assetType: string, campaignData: any, contextData: any) {
    // Definimos o schema com base no tipo de asset para garantir estrutura correta
    let schema: Schema;
    if (assetType === 'landing_page') {
      schema = {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          subheadline: { type: Type.STRING },
          problem: { type: Type.STRING },
          solution: { type: Type.STRING },
          benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
          differentiators: { type: Type.ARRAY, items: { type: Type.STRING } },
          cta: { type: Type.STRING },
          faq: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { q: { type: Type.STRING }, a: { type: Type.STRING } } } }
        },
        required: ["headline", "subheadline", "problem", "solution", "benefits", "cta"]
      };
    } else if (assetType === 'email') {
      schema = {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          preheader: { type: Type.STRING },
          body: { type: Type.STRING },
          cta: { type: Type.STRING }
        },
        required: ["subject", "preheader", "body", "cta"]
      };
    } else if (assetType === 'whatsapp') {
      schema = {
        type: Type.OBJECT,
        properties: {
          initial_message: { type: Type.STRING },
          followup_1: { type: Type.STRING },
          followup_2: { type: Type.STRING },
          final_message: { type: Type.STRING }
        },
        required: ["initial_message", "followup_1", "followup_2", "final_message"]
      };
    } else if (assetType === 'creative_brief') {
      schema = {
        type: Type.OBJECT,
        properties: {
          visual_orientation: { type: Type.STRING },
          main_text_on_image: { type: Type.STRING },
          format_suggestion: { type: Type.STRING },
          cta: { type: Type.STRING }
        },
        required: ["visual_orientation", "main_text_on_image", "format_suggestion", "cta"]
      };
    } else {
      // Default: ad or social_post
      schema = {
        type: Type.OBJECT,
        properties: {
          versions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                angle: { type: Type.STRING, description: "Dor, Benefício, Oportunidade, ou Autoridade" },
                headline: { type: Type.STRING },
                body: { type: Type.STRING },
                cta: { type: Type.STRING }
              }
            }
          }
        },
        required: ["versions"]
      };
    }

    const prompt = `Você é um Copywriter de Resposta Direta Sênior.
Crie o conteúdo do tipo "${assetType}" para a campanha descrita abaixo.
Utilize o argumento principal e a oferta de forma persuasiva e coerente com a marca. Nunca invente preços, promoções financeiras, selos ou promessas que não estejam definidos na estratégia.

Dados da Campanha:
${JSON.stringify(campaignData, null, 2)}

Contexto Adicional (Público/Empresa):
${JSON.stringify(contextData, null, 2)}
`;

    const response = await this.getAI().models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);

    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId: businessId,
      type: 'campaign_asset',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      output: { assetType, result: parsed },
    });

    return parsed;
  }
}

export const aiService = new AIService();
