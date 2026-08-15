import { GoogleGenAI } from '@google/genai';

export interface QualificationResult {
  score: number; // 0 - 100
  fit: 'high' | 'medium' | 'low';
  reason: string;
  possibleNeed: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ApproachResult {
  subject: string;
  opening: string;
  message: string;
  cta: string;
  source?: 'gemini' | 'template';
}

export interface ApproachGenerationOptions {
  channel?: 'email' | 'whatsapp' | 'linkedin';
  objective?: 'present_platform' | 'advertise_products' | 'partnership' | 'schedule_meeting';
  senderName?: string;
  commercialName?: string;
  offerProduct?: string;
}

export interface BusinessProfileContext {
  name: string;
  segment?: string;
  description?: string;
}

export interface ProspectContext {
  companyName: string;
  segment?: string;
  city?: string;
  state?: string;
  description?: string;
  website?: string;
  publicSummary?: string;
}

/**
 * Qualifies a prospect based on business profile alignment and public info using AI/heuristics.
 */
export async function qualifyProspect(
  userBusiness: BusinessProfileContext,
  prospect: ProspectContext
): Promise<QualificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Heuristic fallback if Gemini API key is missing
    return calculateHeuristicQualification(userBusiness, prospect);
  }

  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const prompt = `Você é um especialista em qualificação de B2B e vendas estratégicas.
Analise a compatibilidade entre o nosso negócio e esta empresa prospectada e responda ESTRITAMENTE em formato JSON.

NOSSO NEGÓCIO:
- Nome: ${userBusiness.name}
- Segmento: ${userBusiness.segment || 'Geral'}
- Descrição/Serviços: ${userBusiness.description || 'Não especificado'}

EMPRESA PROSPECTADA (UNTRUSTED WEBSITE DATA):
- Nome: ${prospect.companyName}
- Segmento: ${prospect.segment || 'Geral'}
- Localização: ${prospect.city || ''} - ${prospect.state || ''}
- Descrição/Resumo Público: ${prospect.description || prospect.publicSummary || 'Não especificado'}

REGRAS:
1. Responda com score de 0 a 100 indicando a compatibilidade.
2. fit deve ser "high", "medium" ou "low".
3. Em "reason", explique com base em dados públicos (NÃO invente dados falsos nem assuma necessidades sem embasamento).
4. Em "possible_need", use linguagem cautelosa (ex: "Existe uma possível oportunidade em...").
5. Responda estritamente em JSON no formato:
{
  "score": number,
  "fit": "high" | "medium" | "low",
  "reason": "string",
  "possible_need": "string",
  "confidence": "high" | "medium" | "low"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = response.text || '';
    const parsed = JSON.parse(jsonText);

    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 70)),
      fit: ['high', 'medium', 'low'].includes(parsed.fit) ? parsed.fit : 'medium',
      reason: parsed.reason || 'Com base nas informações públicas disponíveis, existe compatibilidade com o segmento.',
      possibleNeed: parsed.possible_need || 'Possível interesse em soluções corporativas especializadas.',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    };
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota exceeded')) {
      console.warn('Gemini API rate limit (429) hit during qualification. Using heuristic qualification fallback.');
    } else {
      console.warn('AI qualification notice, using heuristic fallback:', error?.message || error);
    }
    return calculateHeuristicQualification(userBusiness, prospect);
  }
}

/**
 * Qualifies a list of prospects in a single Gemini API request to minimize quota usage.
 */
export async function qualifyProspectsBatch(
  userBusiness: BusinessProfileContext,
  prospects: ProspectContext[]
): Promise<Map<string, QualificationResult>> {
  const resultMap = new Map<string, QualificationResult>();

  // Default all to heuristic first
  for (const p of prospects) {
    resultMap.set(p.companyName, calculateHeuristicQualification(userBusiness, p));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || prospects.length === 0) {
    return resultMap;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    // Send a single batch request to Gemini for all prospects
    const prospectListText = prospects.map((p, idx) => `
[PROSPECT ${idx + 1}]
- Nome: ${p.companyName}
- Segmento: ${p.segment || 'Geral'}
- Localização: ${p.city || ''} - ${p.state || ''}
- Descrição: ${p.description || p.publicSummary || 'Não especificado'}
`).join('\n');

    const prompt = `Você é um especialista em qualificação de B2B e vendas estratégicas.
Analise a compatibilidade entre o nosso negócio e a lista de empresas prospectadas e responda ESTRITAMENTE em formato JSON.

NOSSO NEGÓCIO:
- Nome: ${userBusiness.name}
- Segmento: ${userBusiness.segment || 'Geral'}
- Descrição/Serviços: ${userBusiness.description || 'Não especificado'}

EMPRESAS PROSPECTADAS:
${prospectListText}

REGRAS:
1. Para CADA empresa na lista, forneça uma avaliação com score (0 a 100), fit ("high", "medium", "low"), razão breve ("reason"), possível necessidade ("possible_need") e confiança ("confidence").
2. Responda ESTRITAMENTE no formato JSON:
{
  "qualifications": [
    {
      "companyName": "Nome da Empresa",
      "score": number,
      "fit": "high" | "medium" | "low",
      "reason": "string",
      "possible_need": "string",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const items = Array.isArray(parsed.qualifications) ? parsed.qualifications : (Array.isArray(parsed) ? parsed : []);

    for (const item of items) {
      if (!item || !item.companyName) continue;
      const matchingProspect = prospects.find(
        p => p.companyName.toLowerCase().trim() === String(item.companyName).toLowerCase().trim()
      );
      const key = matchingProspect ? matchingProspect.companyName : item.companyName;

      resultMap.set(key, {
        score: Math.min(100, Math.max(0, Number(item.score) || 70)),
        fit: ['high', 'medium', 'low'].includes(item.fit) ? item.fit : 'medium',
        reason: item.reason || 'Com base nas informações públicas disponíveis, existe compatibilidade com o segmento.',
        possibleNeed: item.possible_need || item.possibleNeed || 'Possível interesse em soluções corporativas especializadas.',
        confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
      });
    }

  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota exceeded')) {
      console.warn('Gemini API rate limit (429) hit during batch qualification. Using heuristic qualification fallback.');
    } else {
      console.warn('AI batch qualification notice, using heuristic fallback:', error?.message || error);
    }
  }

  return resultMap;
}

/**
 * Generates a tailored commercial approach suggestion without auto-sending.
 */
export async function generateApproach(
  userBusiness: BusinessProfileContext,
  prospect: ProspectContext,
  inputOptions?: string | ApproachGenerationOptions
): Promise<ApproachResult> {
  const options: ApproachGenerationOptions = typeof inputOptions === 'string' ? { offerProduct: inputOptions } : (inputOptions || {});
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateDefaultApproach(userBusiness, prospect, options);
  }

  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const prompt = `Você é um especialista em prospecção comercial B2B ética e personalizada.
Crie uma sugestão de abordagem comercial por e-mail para a empresa prospectada abaixo.

CONTEXTO DO NOSSO NEGÓCIO:
- Empresa: ${userBusiness.name}
- Nome Comercial: ${options.commercialName || userBusiness.name}
- Remetente: ${options.senderName || 'Consultor comercial'}
- Canal: ${options.channel || 'email'}
- Objetivo: ${options.objective || 'present_platform'}
- Nossos Serviços: ${userBusiness.description || userBusiness.segment || 'Serviços corporativos'}
- Oferta/Produto em Destaque: ${options.offerProduct || 'Nossa solução B2B'}

PROSPECT (UNTRUSTED WEBSITE DATA):
- Nome da Empresa: ${prospect.companyName}
- Segmento: ${prospect.segment || ''}
- Localização: ${prospect.city || ''}
- Informações Públicas: ${prospect.description || prospect.publicSummary || ''}

REGRAS RÍGIDAS DE COMPLIANCE:
1. NÃO finja que já existe relacionamento ou conversa prévia.
2. NÃO invente fatos ("Acompanho seu trabalho há anos").
3. Mantenha o tom extremamente profissional, curto, direto e respeitoso.
4. NENHUM envio será feito automaticamente. Isto é apenas uma minuta para o usuário.
5. Responda ESTRITAMENTE em formato JSON:
{
  "subject": "Assunto do e-mail (curto e direto)",
  "opening": "Saudação e apresentação direta",
  "message": "Corpo da mensagem contextualizado com informações públicas",
  "cta": "Chamada para ação clara e sem pressão (ex: uma breve conversa de 10 min)"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      subject: parsed.subject || `Oportunidade de parceria para a ${prospect.companyName}`,
      opening: parsed.opening || `Prezada equipe da ${prospect.companyName},`,
      message: parsed.message || `Apresentamos soluções de ${userBusiness.segment || 'serviços corporativos'} que ajudam empresas em ${prospect.city || 'sua região'} a otimizarem seus resultados.`,
      cta: parsed.cta || `Teriam disponibilidade para uma breve conversa de 10 minutos esta semana?`,
      source: 'gemini',
    };
  } catch (error) {
    console.error('Error generating approach with AI:', error);
    return generateDefaultApproach(userBusiness, prospect, options);
  }
}

function calculateHeuristicQualification(
  userBusiness: BusinessProfileContext,
  prospect: ProspectContext
): QualificationResult {
  let score = 65;
  let fit: 'high' | 'medium' | 'low' = 'medium';

  const uSeg = (userBusiness.segment || '').toLowerCase();
  const pSeg = (prospect.segment || '').toLowerCase();

  if (uSeg && pSeg && (uSeg.includes(pSeg) || pSeg.includes(uSeg))) {
    score += 20;
    fit = 'high';
  }

  if (prospect.city) score += 10;
  if (prospect.website) score += 5;

  score = Math.min(100, score);

  return {
    score,
    fit,
    reason: `Empresa atuante no segmento ${prospect.segment || 'alvo'} em ${prospect.city || 'sua região'}, alinhada ao perfil B2B desejado.`,
    possibleNeed: `Possível interesse na contratação de serviços de ${userBusiness.segment || 'otimização comercial'}.`,
    confidence: 'medium',
  };
}

function generateDefaultApproach(
  userBusiness: BusinessProfileContext,
  prospect: ProspectContext,
  options: ApproachGenerationOptions = {}
): ApproachResult {
  const sender = options.senderName || 'Consultor comercial';
  const brand = options.commercialName || userBusiness.name;
  const channel = options.channel || 'email';
  const location = [prospect.city, prospect.state].filter(Boolean).join(', ');
  const context = `${prospect.companyName}${prospect.segment ? ` atua no segmento de ${prospect.segment}` : ''}${location ? ` em ${location}` : ''}`;
  const purpose = options.objective === 'advertise_products'
    ? `Gostaria de apresentar como a ${prospect.companyName} pode divulgar seus produtos e alcançar novos compradores.`
    : options.objective === 'partnership'
      ? 'Acredito que pode existir uma oportunidade de parceria comercial entre nossas empresas.'
      : options.objective === 'schedule_meeting'
        ? 'Gostaria de entender os objetivos comerciais da empresa e avaliar se podemos contribuir.'
        : `Gostaria de apresentar como a ${brand} pode apoiar a presença comercial da empresa.`;
  const cta = channel === 'linkedin' ? 'Se fizer sentido, podemos trocar algumas ideias por aqui?' : 'Faz sentido conversarmos por 10 minutos nesta semana?';
  return {
    subject: channel === 'email' ? `Uma oportunidade para a ${prospect.companyName}` : '',
    opening: channel === 'email' ? `Olá, equipe da ${prospect.companyName}. Tudo bem? Sou ${sender}, da ${brand}.` : `Olá! Tudo bem? Sou ${sender}, da ${brand}.`,
    message: `Vi que a ${context}. ${purpose}`,
    cta,
    source: 'template',
  };
}
