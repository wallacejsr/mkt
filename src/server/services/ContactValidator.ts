export type EmailType = 'commercial' | 'support' | 'general' | 'personal' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExtractedContact {
  type: 'email' | 'phone' | 'whatsapp' | 'other';
  value: string;
  emailType?: EmailType;
  label?: string;
  sourceUrl: string;
  confidence: ConfidenceLevel;
  isPrimary?: boolean;
}

// Allowed commercial/institutional patterns
const COMMERCIAL_PATTERNS = [/comercial/i, /vendas/i, /sales/i, /negocios/i, /b2b/i, /propostas/i];
const SUPPORT_PATTERNS = [/atendimento/i, /suporte/i, /support/i, /sac/i, /ajuda/i, /help/i];
const GENERAL_PATTERNS = [/contato/i, /contact/i, /faleconosco/i, /fale-conosco/i, /atendimento/i, /hello/i, /info/i, /institucional/i];
const PERSONAL_PATTERNS = [/^[a-z]+\.[a-z]+@/i, /^[a-z]+_\.[a-z]+@/i];

// Known non-business email providers where personal emails are common
const PUBLIC_PROVIDER_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.com.br', 'hotmail.com', 'outlook.com', 
  'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'icloud.com'
];

/**
 * Classifies an email address into commercial, support, general, personal, or unknown.
 */
export function classifyEmailType(email: string): EmailType {
  const cleanEmail = email.trim().toLowerCase();
  const [localPart, domain] = cleanEmail.split('@');

  if (!localPart || !domain) return 'unknown';

  for (const pattern of COMMERCIAL_PATTERNS) {
    if (pattern.test(localPart)) return 'commercial';
  }

  for (const pattern of SUPPORT_PATTERNS) {
    if (pattern.test(localPart)) return 'support';
  }

  for (const pattern of GENERAL_PATTERNS) {
    if (pattern.test(localPart)) return 'general';
  }

  // Check if it's personal pattern (e.g. name.surname@company.com)
  if (PERSONAL_PATTERNS.some(p => p.test(cleanEmail))) {
    return 'personal';
  }

  return 'unknown';
}

/**
 * Rates priority rank for sorting contacts (1 = highest priority).
 */
export function getEmailPriorityRank(type: EmailType): number {
  switch (type) {
    case 'commercial': return 1;
    case 'general': return 2;
    case 'support': return 3;
    case 'unknown': return 4;
    case 'personal': return 5;
    default: return 6;
  }
}

/**
 * Validates syntax of an email address.
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || email.length > 254) return false;
  // Strict regex for public email syntax
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) return false;

  // Filter out static image file extensions mistargeted by regex
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;

  return true;
}

/**
 * Formats and sanitizes a phone number.
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').trim();
}

/**
 * Calculates confidence level based on source page and email classification.
 */
export function calculateConfidence(sourceUrl: string, officialDomain: string, emailType?: EmailType): ConfidenceLevel {
  const urlLower = sourceUrl.toLowerCase();
  
  // High confidence if found on contact/about page of the official domain
  const isContactPage = urlLower.includes('/contato') || urlLower.includes('/contact') || urlLower.includes('/fale-conosco') || urlLower.includes('/sobre') || urlLower.includes('/about');
  
  if (isContactPage && (emailType === 'commercial' || emailType === 'general')) {
    return 'high';
  }

  if (isContactPage) {
    return 'high';
  }

  if (officialDomain && urlLower.includes(officialDomain.toLowerCase())) {
    return 'medium';
  }

  return 'low';
}
