export interface RawDiscoveredBusiness {
  companyName: string;
  legalName?: string;
  segment: string;
  description?: string;
  city: string;
  state: string;
  country: string;
  website?: string;
  phone?: string;
  contactSource?: string;
}

export interface SearchParams {
  segment: string;
  city?: string;
  state?: string;
  country?: string;
  keywords?: string;
  limit: number;
}

export interface BusinessDiscoveryProvider {
  name: string;
  searchBusinesses(params: SearchParams): Promise<RawDiscoveredBusiness[]>;
}

interface GeoapifyCacheItem {
  timestamp: number;
  data: RawDiscoveredBusiness[];
}

const geoapifyMemoryCache = new Map<string, GeoapifyCacheItem>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

/**
 * Provider using Geoapify Places API & Geocoding Search API.
 * Features pagination, caching, deduplication, and rate limit throttling.
 */
export class GeoapifyBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  name = 'Geoapify Places API';

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchBusinesses(params: SearchParams): Promise<RawDiscoveredBusiness[]> {
    const city = params.city || 'Goiânia';
    const state = params.state || 'GO';
    const country = params.country || 'Brasil';
    const segment = params.segment;
    const keywords = params.keywords || '';
    const targetLimit = Math.max(1, params.limit || 25);

    // 1. Cache Check
    const cacheKey = `geoapify:${segment.toLowerCase().trim()}:${city.toLowerCase().trim()}:${state.toLowerCase().trim()}:${country.toLowerCase().trim()}:${keywords.toLowerCase().trim()}:${targetLimit}`;

    const cached = geoapifyMemoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    const discovered: RawDiscoveredBusiness[] = [];
    const seenSignatures = new Set<string>();

    const locationString = [city, state, country].filter(Boolean).join(', ');
    const textQuery = `${segment} ${keywords} ${locationString}`.trim();

    const pageSize = 50; // Geoapify batch size
    let offset = 0;
    let keepFetching = true;

    // 2. Paginated Geocode / Text Search
    while (keepFetching && discovered.length < targetLimit) {
      try {
        const fetchLimit = Math.min(pageSize, targetLimit - discovered.length);
        const searchUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(textQuery)}&limit=${fetchLimit}&offset=${offset}&apiKey=${this.apiKey}`;

        const res = await fetch(searchUrl);

        if (res.status === 429) {
          console.warn('Geoapify API Rate Limit hit (429). Returning collected results so far.');
          break;
        }

        if (!res.ok) {
          console.warn(`Geoapify Geocoding Search failed: ${res.status} ${res.statusText}`);
          break;
        }

        const data = await res.json();
        const features = data.features;

        if (!Array.isArray(features) || features.length === 0) {
          keepFetching = false;
          break;
        }

        let newAddedInBatch = 0;

        for (const feature of features) {
          const item = this.extractCompanyFromFeature(feature, segment, city, state, country);
          if (!item) continue;

          // Deduplication check
          const sig = this.getDedupeSignature(item);
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            discovered.push(item);
            newAddedInBatch++;

            if (discovered.length >= targetLimit) {
              keepFetching = false;
              break;
            }
          }
        }

        if (features.length < fetchLimit || newAddedInBatch === 0) {
          keepFetching = false;
        }

        offset += fetchLimit;

        // Rate limit control throttle (200ms delay between page requests)
        if (keepFetching && discovered.length < targetLimit) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (err) {
        console.error('Error calling Geoapify API:', err);
        break;
      }
    }

    // 3. Secondary fallback query using Geoapify Places v2 if geocode text search returned fewer than targetLimit
    if (discovered.length < targetLimit) {
      try {
        const categoryFilter = this.mapSegmentToCategory(segment);
        const placesFetchLimit = Math.min(pageSize, targetLimit - discovered.length);
        const placesUrl = `https://api.geoapify.com/v2/places?categories=${categoryFilter}&filter=countrycode:${this.getCountryCode(country)}&limit=${placesFetchLimit}&apiKey=${this.apiKey}`;

        const placesRes = await fetch(placesUrl);
        if (placesRes.ok) {
          const placesData = await placesRes.json();
          if (Array.isArray(placesData.features)) {
            for (const feature of placesData.features) {
              const item = this.extractCompanyFromFeature(feature, segment, city, state, country);
              if (!item) continue;

              const sig = this.getDedupeSignature(item);
              if (!seenSignatures.has(sig)) {
                seenSignatures.add(sig);
                discovered.push(item);
                if (discovered.length >= targetLimit) break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Geoapify Places v2 fallback query skipped:', err);
      }
    }

    // Store in cache
    if (discovered.length > 0) {
      geoapifyMemoryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: discovered,
      });
    }

    return discovered;
  }

  private extractCompanyFromFeature(
    feature: any,
    fallbackSegment: string,
    fallbackCity: string,
    fallbackState: string,
    fallbackCountry: string
  ): RawDiscoveredBusiness | null {
    const props = feature.properties || {};

    const companyName = props.name || props.company || props.legal_name || props.address_line1;

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return null;
    }

    const city = props.city || props.municipality || props.county || fallbackCity;
    const state = props.state || props.state_code || fallbackState;
    const country = props.country || fallbackCountry;

    const description =
      props.formatted ||
      [props.address_line1, props.address_line2].filter(Boolean).join(', ') ||
      `Empresa do setor ${fallbackSegment} em ${city}`;

    const website = props.website || props.contact?.website || props.url || undefined;
    const phone = props.phone || props.contact?.phone || props.contact?.mobile || undefined;
    const legalName = props.legal_name || undefined;

    // Filter out generic administrative features or place names like "São Paulo"
    const resultType = props.result_type || props.place_type;
    const categories = props.categories || [];
    if (isInvalidBusinessName(companyName, resultType, categories, city, state, country)) {
      console.log(`[GEOAPIFY_FILTER_REJECTED] "${companyName}" rejected as non-business administrative place or city name`);
      return null;
    }

    // Structured diagnostic log for Geoapify payload
    console.log('[DIAGNOSTIC_GEOAPIFY_FEATURE]', JSON.stringify({
      companyName: companyName.trim(),
      rawCity: props.city || props.municipality || props.county,
      rawState: props.state || props.state_code,
      rawCountry: props.country,
      hasWebsite: !!website,
      websiteValue: website || null,
      hasPhone: !!phone,
      phoneValue: phone || null,
      availableKeys: Object.keys(props),
    }));

    // Strict geographical filtering: check if state and city match requested params
    const propsState = props.state || props.state_code;
    const propsCity = props.city || props.municipality || props.county;
    if (!matchesRequestedLocation(propsState, props.state_code, propsCity, fallbackState, fallbackCity)) {
      console.log(`[GEOAPIFY_FILTER_REJECTED] ${companyName} (${propsCity}, ${propsState}) does not match requested target (${fallbackCity}, ${fallbackState})`);
      return null;
    }

    return {
      companyName: companyName.trim(),
      legalName: legalName ? legalName.trim() : undefined,
      segment: fallbackSegment,
      description: description.trim(),
      city,
      state,
      country,
      website: website ? website.trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      contactSource: 'Geoapify Places API',
    };
  }

  private getDedupeSignature(b: RawDiscoveredBusiness): string {
    const normName = b.companyName.toLowerCase().replace(/[^\w]/g, '');
    const normCity = (b.city || '').toLowerCase().replace(/[^\w]/g, '');
    const normWebsite = b.website ? b.website.toLowerCase().replace(/https?:\/\/(www\.)?/, '').split('/')[0] : '';
    if (normWebsite) return `domain:${normWebsite}`;
    return `name:${normName}:${normCity}`;
  }

  private getCountryCode(country: string): string {
    const lower = (country || '').toLowerCase();
    if (lower.includes('brasil') || lower.includes('brazil') || lower === 'br') return 'br';
    if (lower.includes('eua') || lower.includes('usa') || lower.includes('united states')) return 'us';
    return 'br';
  }

  private mapSegmentToCategory(segment: string): string {
    const lower = segment.toLowerCase();
    if (lower.includes('advoga') || lower.includes('juríd') || lower.includes('direito') || lower.includes('contab') || lower.includes('tecnologia') || lower.includes('ti') || lower.includes('consultor') || lower.includes('escritór')) {
      return 'office,office.lawyer,office.financial,office.it,office.company';
    }
    if (lower.includes('restaurante') || lower.includes('comida') || lower.includes('aliment') || lower.includes('bar') || lower.includes('café')) {
      return 'catering,catering.restaurant,catering.cafe';
    }
    if (lower.includes('saúde') || lower.includes('médic') || lower.includes('hospital') || lower.includes('clínica') || lower.includes('dentist')) {
      return 'healthcare,healthcare.hospital,healthcare.clinic';
    }
    if (lower.includes('loja') || lower.includes('varejo') || lower.includes('comércio') || lower.includes('mercado')) {
      return 'commercial,commercial.supermarket,commercial.clothing';
    }
    return 'office,commercial,service,catering,healthcare,building.commercial';
  }
}

/**
 * Provider using Google Places Text Search API if GOOGLE_PLACES_API_KEY is configured.
 */
export class GooglePlacesDiscoveryProvider implements BusinessDiscoveryProvider {
  name = 'Google Places API';

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchBusinesses(params: SearchParams): Promise<RawDiscoveredBusiness[]> {
    const locationPart = [params.city, params.state, params.country].filter(Boolean).join(', ');
    const query = `${params.segment} ${params.keywords || ''} ${locationPart}`.trim();

    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Google Places API call failed:', res.statusText);
        return [];
      }
      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      const results: RawDiscoveredBusiness[] = [];
      const places = data.results.slice(0, params.limit);

      for (const place of places) {
        // Fetch place details for website and formatted_phone_number
        let website = '';
        let phone = '';

        if (place.place_id) {
          try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_phone_number,international_phone_number,types&key=${this.apiKey}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              website = detailData.result?.website || '';
              phone = detailData.result?.formatted_phone_number || detailData.result?.international_phone_number || '';
            }
          } catch {
            // Ignore detail fetch errors
          }
        }

        results.push({
          companyName: place.name || 'Empresa Sem Nome',
          segment: params.segment,
          description: place.formatted_address || place.vicinity || `Empresa do setor ${params.segment}`,
          city: params.city || 'Goiânia',
          state: params.state || 'GO',
          country: params.country || 'Brasil',
          website: website || undefined,
          phone: phone || place.formatted_phone_number || undefined,
          contactSource: 'Google Places API',
        });
      }

      return results;
    } catch (error) {
      console.error('Error in GooglePlacesDiscoveryProvider:', error);
      return [];
    }
  }
}

/**
 * Fallback Provider for local/development environments when no external API key is configured.
 * Returns curated realistic B2B company directory profiles.
 */
export class LocalWebDiscoveryProvider implements BusinessDiscoveryProvider {
  name = 'Diretório Público B2B (Modo Demo)';

  async searchBusinesses(params: SearchParams): Promise<RawDiscoveredBusiness[]> {
    const city = params.city || 'Goiânia';
    const state = params.state || 'GO';
    const country = params.country || 'Brasil';
    const segment = params.segment;

    // Generate realistic B2B prospects based on search parameters
    const mockCompanies: RawDiscoveredBusiness[] = [
      {
        companyName: `${segment} Alfa Pro`,
        legalName: `${segment} Alfa Pro Serviços Ltda`,
        segment,
        description: `Empresa especializada em soluções completas para ${segment.toLowerCase()} em ${city}.`,
        city,
        state,
        country,
        website: `https://www.empresa-alfa-${slugify(segment)}.com.br`,
        phone: '(62) 3920-1100',
        contactSource: 'Diretório Comercial Público',
      },
      {
        companyName: `Grupo Centro-Oeste ${segment}`,
        legalName: `Grupo Centro Oeste de ${segment} S.A.`,
        segment,
        description: `Líder regional no fornecimento de serviços corporativos e atendimento para ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.grupocentrooeste-${slugify(segment)}.com.br`,
        phone: '(62) 3215-4400',
        contactSource: 'Portal de Empresas do Estado',
      },
      {
        companyName: `Tech & Soluções ${segment}`,
        legalName: `Tech e Soluções em ${segment} Eireli`,
        segment,
        description: `Inovação e qualidade em ${segment.toLowerCase()} com equipe técnica qualificada em ${city}.`,
        city,
        state,
        country,
        website: `https://www.techsolucoes-${slugify(segment)}.com.br`,
        phone: '(62) 99812-3344',
        contactSource: 'Cadastro Empresarial Público',
      },
      {
        companyName: `Excelência em ${segment}`,
        legalName: `Excelência Atendimento ${segment} Ltda`,
        segment,
        description: `Atendimento empresarial personalizado e consultoria para ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.excelencia-${slugify(segment)}.com.br`,
        phone: '(62) 3541-8890',
        contactSource: 'Guia Comercial Regional',
      },
      {
        companyName: `Soluções Integradas ${segment}`,
        legalName: `Soluções Integradas ${segment} Brasil Ltda`,
        segment,
        description: `Infraestrutura corporativa e serviços especializados para empresas e profissionais de ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.solucoes-${slugify(segment)}.com.br`,
        phone: '(62) 3098-7711',
        contactSource: 'Diretório Comercial de ${city}',
      },
      {
        companyName: `Nova Era ${segment}`,
        legalName: `Nova Era Empreendimentos ${segment} Ltda`,
        segment,
        description: `Gestão de projetos e atendimento B2B em ${city} para o setor de ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.novaera-${slugify(segment)}.com.br`,
        phone: '(62) 3876-2233',
        contactSource: 'Portal de Negócios Brasil',
      },
    ];

    return mockCompanies.slice(0, Math.min(params.limit, mockCompanies.length));
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function normalizeGeoString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

function matchesRequestedLocation(
  propsState?: string,
  propsStateCode?: string,
  propsCity?: string,
  requestedState?: string,
  requestedCity?: string
): boolean {
  if (requestedState) {
    const normTargetState = normalizeGeoString(requestedState);
    const normPropsState = normalizeGeoString(propsState);
    const normPropsStateCode = normalizeGeoString(propsStateCode);

    const stateMap: Record<string, string[]> = {
      go: ['go', 'goias'],
      sp: ['sp', 'sao paulo'],
      rj: ['rj', 'rio de janeiro'],
      mg: ['mg', 'minas gerais'],
      pr: ['pr', 'parana'],
      rs: ['rs', 'rio grande do sul'],
      sc: ['sc', 'santa catarina'],
      ba: ['ba', 'bahia'],
      pe: ['pe', 'pernambuco'],
      ce: ['ce', 'ceara'],
      df: ['df', 'distrito federal'],
      es: ['es', 'espirito santo'],
      mt: ['mt', 'mato grosso'],
      ms: ['ms', 'mato grosso do sul'],
      pa: ['pa', 'para'],
      am: ['am', 'amazonas'],
    };

    const allowedVariants = stateMap[normTargetState] || [normTargetState];
    const stateMatches = allowedVariants.some(v => normPropsState.includes(v) || normPropsStateCode === v);

    if ((propsState || propsStateCode) && !stateMatches) {
      return false;
    }
  }

  if (requestedCity) {
    const normTargetCity = normalizeGeoString(requestedCity);
    const normPropsCity = normalizeGeoString(propsCity);

    if (normPropsCity && normTargetCity && !normPropsCity.includes(normTargetCity) && !normTargetCity.includes(normPropsCity)) {
      return false;
    }
  }

  return true;
}

function isInvalidBusinessName(
  companyName: string,
  resultType?: string,
  categories?: string[],
  city?: string,
  state?: string,
  country?: string
): boolean {
  const normName = normalizeGeoString(companyName);
  if (!normName || normName.length < 2) return true;

  // 1. Check result_type or category for administrative entities
  const invalidResultTypes = [
    'city', 'county', 'state', 'country', 'postcode', 'administrative', 
    'suburb', 'district', 'quarter', 'neighbourhood', 'locality'
  ];
  if (resultType && invalidResultTypes.includes(resultType.toLowerCase())) {
    return true;
  }

  // 2. Check if name is purely equal to city, state, or country
  if (city && normName === normalizeGeoString(city)) return true;
  if (state && normName === normalizeGeoString(state)) return true;
  if (country && normName === normalizeGeoString(country)) return true;

  // 3. Known administrative/place names in Brazil or common geographic words alone
  const pureGeoNames = [
    'sao paulo', 'goiania', 'rio de janeiro', 'brasil', 'brasilia', 'goias', 
    'minas gerais', 'bahia', 'parana', 'santa catarina', 'rio grande do sul', 
    'espirito santo', 'mato grosso', 'mato grosso do sul', 'para', 'amazonas', 'ceara', 'pernambuco'
  ];
  if (pureGeoNames.includes(normName)) {
    return true;
  }

  // 4. Check categories array for administrative places
  if (Array.isArray(categories)) {
    const isPureAdminCategory = categories.some(c => 
      c.includes('administrative') || c.includes('political') || c.includes('place.city')
    ) && !categories.some(c => 
      c.includes('commercial') || c.includes('service') || c.includes('catering') || c.includes('office') || c.includes('store') || c.includes('industrial')
    );
    if (isPureAdminCategory) return true;
  }

  return false;
}

/**
 * Returns the appropriate BusinessDiscoveryProvider based on available API keys.
 * Prioritizes GEOAPIFY_API_KEY as the default provider, falling back to GOOGLE_PLACES_API_KEY,
 * and finally to LocalWebDiscoveryProvider for local development or demo mode.
 */
export function getDiscoveryProvider(): BusinessDiscoveryProvider {
  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  if (geoapifyKey && geoapifyKey.trim().length > 0 && geoapifyKey !== '""') {
    return new GeoapifyBusinessDiscoveryProvider(geoapifyKey.trim());
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey && googleKey.trim().length > 0 && googleKey !== '""') {
    return new GooglePlacesDiscoveryProvider(googleKey.trim());
  }

  return new LocalWebDiscoveryProvider();
}

