import { 
  ExtractedContact, 
  classifyEmailType, 
  isValidEmailFormat, 
  calculateConfidence, 
  sanitizePhone,
  getEmailPriorityRank
} from './ContactValidator.js';

export interface ExtractedPageContacts {
  contacts: ExtractedContact[];
  contactPageUrls: string[];
}

/**
 * Extracts public commercial emails, phones, WhatsApp links, and contact subpages from HTML content.
 */
export function extractContactsFromHtml(
  html: string, 
  sourceUrl: string, 
  officialDomain: string
): ExtractedPageContacts {
  const contactsMap = new Map<string, ExtractedContact>();
  const contactPageUrlsSet = new Set<string>();

  if (!html) return { contacts: [], contactPageUrls: [] };

  // 1. Extract contact page URLs for further crawling
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const link = match[1]?.trim();
    if (!link) continue;

    // Check if link points to contact or about page
    if (/(\/contato|\/contact|\/fale-conosco|\/faleconosco|\/sobre|\/about|\/atendimento|\/comercial)/i.test(link)) {
      try {
        const fullUrl = new URL(link, sourceUrl).toString();
        if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
          contactPageUrlsSet.add(fullUrl);
        }
      } catch {
        // Ignore invalid URL resolution
      }
    }

    // Check mailto: links directly
    if (link.toLowerCase().startsWith('mailto:')) {
      const emailMatch = link.replace(/^mailto:/i, '').split('?')[0].trim();
      if (isValidEmailFormat(emailMatch)) {
        addEmailContact(emailMatch, sourceUrl, officialDomain, contactsMap, 'mailto link');
      }
    }

    // Check tel: links directly
    if (link.toLowerCase().startsWith('tel:')) {
      const phoneVal = link.replace(/^tel:/i, '').trim();
      const sanitized = sanitizePhone(phoneVal);
      if (sanitized.length >= 8) {
        addPhoneContact(sanitized, 'phone', sourceUrl, officialDomain, contactsMap, 'tel link');
      }
    }

    // Check WhatsApp links (e.g. wa.me, api.whatsapp.com)
    if (/wa\.me\/|api\.whatsapp\.com\/send/i.test(link)) {
      const waPhoneMatch = link.match(/(?:phone=|wa\.me\/)(\+?\d{8,15})/i);
      if (waPhoneMatch && waPhoneMatch[1]) {
        const sanitized = sanitizePhone(waPhoneMatch[1]);
        addPhoneContact(sanitized, 'whatsapp', sourceUrl, officialDomain, contactsMap, 'WhatsApp link');
      }
    }
  }

  // 2. Extract plain text emails using Regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const rawEmails = html.match(emailRegex) || [];
  for (const rawEmail of rawEmails) {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (isValidEmailFormat(cleanEmail)) {
      addEmailContact(cleanEmail, sourceUrl, officialDomain, contactsMap, 'Public text');
    }
  }

  // 2b. Extract Obfuscated Emails (e.g. contato [at] empresa.com.br, contato (at) empresa.com.br, contato [em] empresa.com.br)
  const obfuscatedEmailRegex = /\b([A-Za-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\b\[em\]\b|\b\(em\)\b|@)\s*([A-Za-z0-9.-]+(?:\s*(?:\[dot\]|\(dot\)|\.)\s*[A-Za-z0-9.-]+)+)\b/gi;
  let obfMatch: RegExpExecArray | null;
  while ((obfMatch = obfuscatedEmailRegex.exec(html)) !== null) {
    const userPart = obfMatch[1];
    let domainPart = obfMatch[2].replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, '.').replace(/\s+/g, '');
    const reconstructedEmail = `${userPart}@${domainPart}`.toLowerCase();
    if (isValidEmailFormat(reconstructedEmail)) {
      addEmailContact(reconstructedEmail, sourceUrl, officialDomain, contactsMap, 'Obfuscated text');
    }
  }

  // 2c. Extract JSON-LD / schema.org structured metadata
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch: RegExpExecArray | null;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    const jsonContent = jsonLdMatch[1];
    if (jsonContent) {
      const foundInJson = jsonContent.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
      for (const emailStr of foundInJson) {
        if (isValidEmailFormat(emailStr)) {
          addEmailContact(emailStr.toLowerCase(), sourceUrl, officialDomain, contactsMap, 'JSON-LD Metadata');
        }
      }
      const foundPhones = jsonContent.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-.\s]?\d{4})\b/g) || [];
      for (const phoneStr of foundPhones) {
        const sanitized = sanitizePhone(phoneStr);
        if (sanitized.length >= 10 && sanitized.length <= 13) {
          addPhoneContact(sanitized, 'phone', sourceUrl, officialDomain, contactsMap, 'JSON-LD Metadata');
        }
      }
    }
  }

  // 2d. Extract Meta tags
  const metaRegex = /<meta\b[^>]*content=["']([^"']+)["'][^>]*>/gi;
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const metaVal = metaMatch[1];
    if (metaVal) {
      const emailsInMeta = metaVal.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
      for (const em of emailsInMeta) {
        if (isValidEmailFormat(em)) {
          addEmailContact(em.toLowerCase(), sourceUrl, officialDomain, contactsMap, 'Meta tags');
        }
      }
    }
  }

  // 3. Extract Brazilian / International phone numbers from text
  const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-.\s]?\d{4})\b/g;
  const rawPhones = html.match(phoneRegex) || [];
  for (const rawPhone of rawPhones) {
    const sanitized = sanitizePhone(rawPhone);
    if (sanitized.length >= 10 && sanitized.length <= 13) {
      addPhoneContact(sanitized, 'phone', sourceUrl, officialDomain, contactsMap, 'Public text');
    }
  }

  const contacts = Array.from(contactsMap.values());
  const contactPageUrls = Array.from(contactPageUrlsSet);

  return { contacts, contactPageUrls };
}

function addEmailContact(
  email: string, 
  sourceUrl: string, 
  officialDomain: string, 
  contactsMap: Map<string, ExtractedContact>,
  sourceLabel: string
) {
  const emailType = classifyEmailType(email);
  const confidence = calculateConfidence(sourceUrl, officialDomain, emailType);
  const key = `email:${email.toLowerCase()}`;

  if (!contactsMap.has(key)) {
    contactsMap.set(key, {
      type: 'email',
      value: email.toLowerCase(),
      emailType,
      label: sourceLabel,
      sourceUrl,
      confidence,
    });
  }
}

function addPhoneContact(
  phone: string, 
  type: 'phone' | 'whatsapp',
  sourceUrl: string, 
  officialDomain: string, 
  contactsMap: Map<string, ExtractedContact>,
  sourceLabel: string
) {
  const confidence = calculateConfidence(sourceUrl, officialDomain);
  const key = `${type}:${phone}`;

  if (!contactsMap.has(key)) {
    contactsMap.set(key, {
      type,
      value: phone,
      label: sourceLabel,
      sourceUrl,
      confidence,
    });
  }
}

/**
 * Ranks and selects the best primary commercial email and phone from a collection of extracted contacts.
 */
export function selectPrimaryContacts(contacts: ExtractedContact[]): {
  primaryEmail: ExtractedContact | null;
  primaryPhone: ExtractedContact | null;
} {
  const emails = contacts.filter(c => c.type === 'email');
  const phones = contacts.filter(c => c.type === 'phone' || c.type === 'whatsapp');

  // Sort emails by priority: Commercial > General > Support > Unknown > Personal
  emails.sort((a, b) => {
    const rankA = getEmailPriorityRank(a.emailType || 'unknown');
    const rankB = getEmailPriorityRank(b.emailType || 'unknown');
    if (rankA !== rankB) return rankA - rankB;
    
    // Secondary sort by confidence
    const confOrder = { high: 1, medium: 2, low: 3 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  // Sort phones by confidence then type (WhatsApp preferred if available)
  phones.sort((a, b) => {
    if (a.type === 'whatsapp' && b.type !== 'whatsapp') return -1;
    if (b.type === 'whatsapp' && a.type !== 'whatsapp') return 1;
    const confOrder = { high: 1, medium: 2, low: 3 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  return {
    primaryEmail: emails[0] || null,
    primaryPhone: phones[0] || null,
  };
}
