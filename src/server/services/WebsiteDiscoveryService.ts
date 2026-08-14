import { URL } from 'url';
import { validateUrlForSSRF, fetchPageHtml } from './WebsiteFetcher';

export interface WebsiteDiscoveryResult {
  website?: string;
  domain?: string;
  confidence: 'high' | 'medium' | 'low';
  source?: string;
}

/**
 * List of known aggregator/directory/social domains to ignore when discovering official company websites.
 */
const IGNORED_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'whatsapp.com',
  'google.com',
  'maps.google.com',
  'cnpj.biz',
  'econodata.com.br',
  'jusbrasil.com.br',
  'escavador.com',
  'reclameaqui.com.br',
  'guiamais.com.br',
  'apontador.com.br',
  'yellowpages.com',
  'infobel.com',
  'tripadvisor.com',
  'glassdoor.com',
  'wikipedia.org',
  'solutudo.com.br',
  'consultacnpj.com',
  'serasaexperian.com.br',
];

/**
 * Normalizes, cleans and validates official website URLs.
 */
export function processWebsiteUrl(rawWebsiteUrl?: string): WebsiteDiscoveryResult {
  if (!rawWebsiteUrl || rawWebsiteUrl.trim() === '') {
    return { confidence: 'low' };
  }

  let cleanUrl = rawWebsiteUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const parsed = new URL(cleanUrl);
    // Strip tracking query params
    parsed.search = '';
    parsed.hash = '';

    const hostname = parsed.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, '');

    // Reject known aggregators
    if (IGNORED_DOMAINS.some(d => domain.includes(d))) {
      return { confidence: 'low' };
    }

    return {
      website: parsed.toString().replace(/\/$/, ''), // remove trailing slash
      domain,
      confidence: 'high',
    };
  } catch {
    return { confidence: 'low' };
  }
}

/**
 * Secondary official website discovery strategy when the primary provider returns website = null.
 * Uses Geoapify geocode lookup, direct domain probe, DuckDuckGo API, and public search endpoints.
 */
export async function discoverOfficialWebsite(
  companyName: string,
  city?: string,
  state?: string,
  apiKey?: string
): Promise<WebsiteDiscoveryResult> {
  const normName = companyName.trim();
  const location = [city, state].filter(Boolean).join(' ');

  // 1. Layer 1: Geoapify Geocode Specific Lookup (if apiKey present)
  if (apiKey && apiKey.trim().length > 0 && apiKey !== '""') {
    try {
      const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(`${normName} ${location}`)}&limit=3&apiKey=${apiKey}`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.features)) {
          for (const feature of data.features) {
            const props = feature.properties || {};
            const site = props.website || props.contact?.website || props.url;
            if (site) {
              const processed = processWebsiteUrl(site);
              if (processed.website) {
                return { ...processed, source: 'Geoapify Specific Geocode Lookup' };
              }
            }
          }
        }
      }
    } catch {
      // Layer 1 failed gracefully
    }
  }

  // 2. Layer 2: Direct Candidate Domain Probing (.com.br / .com)
  const cleanSlug = normName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\b(ltda|sa|eireli|me|epp|comercial|grupo|br)\b/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (cleanSlug.length >= 4 && cleanSlug.length <= 30) {
    const candidateDomains = [
      `https://www.${cleanSlug}.com.br`,
      `https://${cleanSlug}.com.br`,
      `https://www.${cleanSlug}.com`,
    ];

    for (const candUrl of candidateDomains) {
      try {
        await validateUrlForSSRF(candUrl);
        const res = await fetchPageHtml(candUrl, 3000);
        if (res.ok && res.html) {
          const processed = processWebsiteUrl(candUrl);
          if (processed.website && processed.domain) {
            return { ...processed, source: 'Direto Domínio Oficial' };
          }
        }
      } catch {
        // Candidate domain unreachable, continue
      }
    }
  }

  // 3. Layer 3: DuckDuckGo Instant Answer API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(`${normName} ${location}`)}&format=json&no_redirect=1&no_html=1`;
    const ddgRes = await fetch(ddgUrl, { headers: { 'User-Agent': 'MarketingOSBot/1.0' } });
    if (ddgRes.ok) {
      const ddgData = await ddgRes.json();
      const candidate = ddgData.AbstractURL || (ddgData.Results && ddgData.Results[0]?.FirstURL);
      if (candidate) {
        const processed = processWebsiteUrl(candidate);
        if (processed.website) {
          return { ...processed, source: 'DuckDuckGo Instant Answer API' };
        }
      }
    }
  } catch {
    // Layer 3 failed gracefully
  }

  // 4. Layer 4: Public DuckDuckGo HTML Endpoint with relaxed queries
  const searchQueries = [
    `${normName} ${location}`,
    `${normName} site oficial`,
  ];

  for (const queryStr of searchQueries) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryStr)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (searchRes.ok) {
        const htmlText = await searchRes.text();
        const urlMatches = htmlText.match(/href=["'](\/l\/\?uddg=[^"']+|https?:\/\/[^"']+)["']/gi) || [];

        for (const matchStr of urlMatches) {
          let rawHref = matchStr.replace(/^href=["']/, '').replace(/["']$/, '');
          if (rawHref.startsWith('/l/?uddg=')) {
            const params = new URLSearchParams(rawHref.split('?')[1]);
            rawHref = params.get('uddg') || '';
          }

          if (rawHref && (rawHref.startsWith('http://') || rawHref.startsWith('https://'))) {
            const processed = processWebsiteUrl(rawHref);
            if (processed.website && processed.domain) {
              try {
                await validateUrlForSSRF(processed.website);
                return { ...processed, source: 'Public Web Discovery Engine' };
              } catch {
                // Ignore unreachable or invalid host
              }
            }
          }
        }
      }
    } catch {
      // Search query failed gracefully
    }
  }

  return { confidence: 'low' };
}
