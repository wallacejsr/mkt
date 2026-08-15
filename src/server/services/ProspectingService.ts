import { db } from '../../db/index';
import { 
  prospectingSearches, 
  prospects, 
  prospectContacts, 
  leads, 
  businesses,
  organizations 
} from '../../db/schema';
import { eq, and, inArray, desc, ilike, or } from 'drizzle-orm';
import { getDiscoveryProvider, SearchParams, RawDiscoveredBusiness } from './BusinessDiscoveryProvider';
import { processWebsiteUrl, discoverOfficialWebsite } from './WebsiteDiscoveryService';
import { fetchPageHtml } from './WebsiteFetcher';
import { extractContactsFromHtml, selectPrimaryContacts } from './PublicContactExtractor';
import { qualifyProspect, qualifyProspectsBatch, generateApproach, BusinessProfileContext, QualificationResult } from './ProspectScoringService';

export interface CreateSearchInput {
  organizationId: string;
  businessId: string;
  userId?: string;
  segment: string;
  city?: string;
  state?: string;
  country?: string;
  radiusKm?: number;
  keywords?: string;
  requestedLimit?: number;
}

export class ProspectingService {

  /**
   * Creates a new search job and executes company discovery & public contact extraction.
   */
  static async executeSearch(input: CreateSearchInput) {
    const limit = input.requestedLimit || 25;

    // 1. Insert search job in database with status 'running'
    const [searchRecord] = await db.insert(prospectingSearches).values({
      organizationId: input.organizationId,
      businessId: input.businessId,
      userId: input.userId,
      segment: input.segment,
      city: input.city,
      state: input.state,
      country: input.country || 'Brasil',
      radiusKm: input.radiusKm,
      keywords: input.keywords,
      requestedLimit: limit,
      status: 'running',
    }).returning();

    // Fetch user's business profile for AI scoring context
    const [businessData] = await db.select().from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
    const userBusinessCtx: BusinessProfileContext = {
      name: businessData?.name || 'Sua Empresa',
      segment: businessData?.segment || input.segment,
      description: businessData?.description || '',
    };

    try {
      // 2. Discover companies using BusinessDiscoveryProvider
      const provider = getDiscoveryProvider();
      const discoveredCompanies = await provider.searchBusinesses({
        segment: input.segment,
        city: input.city,
        state: input.state,
        country: input.country || 'Brasil',
        keywords: input.keywords,
        limit,
      });

      let totalFound = discoveredCompanies.length;
      let totalWithEmail = 0;
      let totalWithPhone = 0;

      // Batch qualify all discovered prospects in 1 Gemini API call to prevent rate limit quota errors
      const batchProspectContexts = discoveredCompanies.map(c => ({
        companyName: c.companyName,
        segment: c.segment,
        city: c.city,
        state: c.state,
        description: c.description,
        website: c.website,
        publicSummary: c.description,
      }));

      const batchQualificationsMap = await qualifyProspectsBatch(userBusinessCtx, batchProspectContexts);

      // 3. Process each discovered company
      for (const rawCompany of discoveredCompanies) {
        const preCalculatedQualification = batchQualificationsMap.get(rawCompany.companyName);

        await this.processSingleProspect({
          searchId: searchRecord.id,
          organizationId: input.organizationId,
          businessId: input.businessId,
          rawCompany,
          userBusinessCtx,
          preCalculatedQualification,
        });
      }

      // 4. Update count statistics
      const createdProspects = await db.select().from(prospects).where(eq(prospects.searchId, searchRecord.id));
      totalWithEmail = createdProspects.filter(p => !!p.email).length;
      totalWithPhone = createdProspects.filter(p => !!p.phone).length;

      // 5. Mark search as completed
      await db.update(prospectingSearches)
        .set({
          status: 'completed',
          totalFound,
          totalWithEmail,
          totalWithPhone,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(prospectingSearches.id, searchRecord.id));

      return {
        searchId: searchRecord.id,
        totalFound,
        totalWithEmail,
        totalWithPhone,
      };

    } catch (error: any) {
      console.error('Error executing prospecting search:', error);
      await db.update(prospectingSearches)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(prospectingSearches.id, searchRecord.id));
      throw error;
    }
  }

  /**
   * Processes a single discovered company: site discovery, public contact crawling, deduplication, scoring.
   */
  private static async processSingleProspect(params: {
    searchId: string;
    organizationId: string;
    businessId: string;
    rawCompany: RawDiscoveredBusiness;
    userBusinessCtx: BusinessProfileContext;
    preCalculatedQualification?: QualificationResult;
  }) {
    const { searchId, organizationId, businessId, rawCompany, userBusinessCtx, preCalculatedQualification } = params;

    // Structured Log: business_discovered
    console.log('[PROSPECT_LOG] business_discovered:', JSON.stringify({
      companyName: rawCompany.companyName,
      city: rawCompany.city,
      state: rawCompany.state,
      providerWebsite: rawCompany.website || null,
      providerPhone: rawCompany.phone || null,
    }));

    // Website Discovery Logic
    let finalWebsite = rawCompany.website;
    let contactSource = rawCompany.contactSource || 'Geoapify Places API';

    if (finalWebsite) {
      console.log('[PROSPECT_LOG] website_from_provider:', JSON.stringify({
        companyName: rawCompany.companyName,
        website: finalWebsite,
      }));
    } else {
      console.log('[PROSPECT_LOG] website_discovery_attempted:', JSON.stringify({
        companyName: rawCompany.companyName,
        city: rawCompany.city,
        state: rawCompany.state,
      }));

      const geoapifyKey = process.env.GEOAPIFY_API_KEY;
      const secondaryDiscovery = await discoverOfficialWebsite(
        rawCompany.companyName,
        rawCompany.city,
        rawCompany.state,
        geoapifyKey
      );

      if (secondaryDiscovery.website) {
        finalWebsite = secondaryDiscovery.website;
        contactSource = secondaryDiscovery.source || 'Estratégia Secundária de Descoberta';
        console.log('[PROSPECT_LOG] website_discovered:', JSON.stringify({
          companyName: rawCompany.companyName,
          url: finalWebsite,
          source: contactSource,
        }));
      } else {
        console.log('[PROSPECT_LOG] website_discovery_completed:', JSON.stringify({
          companyName: rawCompany.companyName,
          status: 'no_official_website_found',
          info: 'No official website found across search strategies',
        }));
      }
    }

    // Process website and domain
    const websiteInfo = processWebsiteUrl(finalWebsite);
    const domain = websiteInfo.domain || '';

    // Check for existing deduplication in this business
    if (domain) {
      const existing = await db.select().from(prospects)
        .where(and(eq(prospects.businessId, businessId), eq(prospects.domain, domain)))
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }
    }

    // Extract public contacts from official website and subpages
    const extractedContactsList: any[] = [];
    const scannedUrls: string[] = [];
    let websiteStatus: 'no_website_found' | 'website_found_no_contact' | 'contact_found' | 'fetch_failed' | 'blocked_by_site' = 'no_website_found';
    let fetchAttemptedCount = 0;
    let fetchBlockedCount = 0;
    let fetchSuccessCount = 0;

    if (websiteInfo.website) {
      console.log('[PROSPECT_LOG] contact_extraction_started:', JSON.stringify({
        companyName: rawCompany.companyName,
        websiteUrl: websiteInfo.website,
      }));

      // Candidate URLs to crawl
      try {
        const baseObj = new URL(websiteInfo.website);
        const subPaths = ['', '/contato', '/contact', '/fale-conosco', '/sobre', '/about', '/atendimento', '/comercial'];
        const targetUrlsToScan = subPaths.map(p => `${baseObj.origin}${p}`);
        const uniqueTargetUrls = Array.from(new Set(targetUrlsToScan));

        for (const targetUrl of uniqueTargetUrls) {
          fetchAttemptedCount++;
          try {
            const pageRes = await fetchPageHtml(targetUrl, 5000);
            if (pageRes.ok && pageRes.html) {
              fetchSuccessCount++;
              scannedUrls.push(targetUrl);
              const extracted = extractContactsFromHtml(pageRes.html, targetUrl, domain);
              extractedContactsList.push(...extracted.contacts);
            } else {
              if (pageRes.status === 403 || pageRes.status === 401 || pageRes.status === 429) {
                fetchBlockedCount++;
              }
              console.log('[PROSPECT_LOG] extraction_error:', JSON.stringify({
                companyName: rawCompany.companyName,
                pageUrl: targetUrl,
                error: pageRes.error || `HTTP ${pageRes.status}`,
              }));
            }
          } catch (fetchErr: any) {
            console.log('[PROSPECT_LOG] extraction_error:', JSON.stringify({
              companyName: rawCompany.companyName,
              pageUrl: targetUrl,
              error: fetchErr.message || 'Network error',
            }));
          }

          // Stop scanning further subpages if we already found high quality email
          if (extractedContactsList.some(c => c.type === 'email')) {
            break;
          }
        }
      } catch (urlErr) {
        console.log('[PROSPECT_LOG] extraction_error:', JSON.stringify({
          companyName: rawCompany.companyName,
          pageUrl: websiteInfo.website,
          error: 'Invalid URL object',
        }));
      }

      console.log('[PROSPECT_LOG] pages_scanned:', JSON.stringify({
        companyName: rawCompany.companyName,
        pagesCount: scannedUrls.length,
        pages: scannedUrls,
      }));

      const emailsFound = extractedContactsList.filter(c => c.type === 'email');
      const phonesFound = extractedContactsList.filter(c => c.type === 'phone' || c.type === 'whatsapp');

      console.log('[PROSPECT_LOG] emails_found:', JSON.stringify({
        companyName: rawCompany.companyName,
        count: emailsFound.length,
        emails: emailsFound.map(e => e.value),
      }));

      console.log('[PROSPECT_LOG] phones_found:', JSON.stringify({
        companyName: rawCompany.companyName,
        count: phonesFound.length,
        phones: phonesFound.map(p => p.value),
      }));

      // Determine websiteStatus
      if (extractedContactsList.length > 0) {
        websiteStatus = 'contact_found';
      } else if (fetchSuccessCount > 0) {
        websiteStatus = 'website_found_no_contact';
      } else if (fetchBlockedCount > 0) {
        websiteStatus = 'blocked_by_site';
      } else {
        websiteStatus = 'fetch_failed';
      }
    } else {
      websiteStatus = 'no_website_found';
    }

    // Select primary email and phone
    const primary = selectPrimaryContacts(extractedContactsList);

    const email = primary.primaryEmail?.value || undefined;
    const emailType = primary.primaryEmail?.emailType || undefined;
    const phone = primary.primaryPhone?.value || rawCompany.phone || undefined;
    const sourceUrl = primary.primaryEmail?.sourceUrl || primary.primaryPhone?.sourceUrl || websiteInfo.website || undefined;

    // Check if CRM lead already exists
    let existingCrmLeadId: string | null = null;
    if (email) {
      const existingLeads = await db.select().from(leads)
        .where(and(eq(leads.businessId, businessId), ilike(leads.email, email)))
        .limit(1);
      if (existingLeads.length > 0) {
        existingCrmLeadId = existingLeads[0].id;
      }
    }

    // Qualify prospect
    const qualification = preCalculatedQualification || await qualifyProspect(userBusinessCtx, {
      companyName: rawCompany.companyName,
      segment: rawCompany.segment,
      city: rawCompany.city,
      state: rawCompany.state,
      description: rawCompany.description,
      website: websiteInfo.website,
      publicSummary: rawCompany.description || '',
    });

    const prospectStatus = existingCrmLeadId ? 'imported' : (qualification.fit === 'high' ? 'qualified' : 'new');

    // Insert prospect record
    const [insertedProspect] = await db.insert(prospects).values({
      organizationId,
      businessId,
      searchId,
      companyName: rawCompany.companyName,
      legalName: rawCompany.legalName,
      segment: rawCompany.segment,
      description: rawCompany.description,
      city: rawCompany.city,
      state: rawCompany.state,
      country: rawCompany.country,
      website: websiteInfo.website,
      domain,
      phone,
      email,
      emailType,
      websiteStatus,
      sourceUrl,
      contactSource,
      confidence: primary.primaryEmail?.confidence || websiteInfo.confidence || 'medium',
      qualificationScore: qualification.score,
      qualificationReason: qualification.reason,
      qualificationFit: qualification.fit,
      possibleNeed: qualification.possibleNeed,
      status: prospectStatus,
      crmLeadId: existingCrmLeadId,
    }).returning();

    // Insert associated contacts into prospect_contacts table
    if (extractedContactsList.length > 0) {
      const contactRows = extractedContactsList.slice(0, 15).map((c) => ({
        prospectId: insertedProspect.id,
        type: c.type,
        value: c.value,
        label: c.label,
        sourceUrl: c.sourceUrl || sourceUrl || websiteInfo.website,
        confidence: c.confidence,
        isPrimary: c.value === email || c.value === phone,
      }));
      await db.insert(prospectContacts).values(contactRows);
    }

    return insertedProspect;
  }

  /**
   * Imports selected prospects into the CRM `leads` table with origin 'prospecting'.
   */
  static async importProspectsToCRM(businessId: string, organizationId: string, prospectIds: string[]) {
    if (!prospectIds || prospectIds.length === 0) return { importedCount: 0, leads: [] };

    const targetProspects = await db.select().from(prospects)
      .where(and(
        eq(prospects.businessId, businessId),
        inArray(prospects.id, prospectIds)
      ));

    const createdLeads = [];

    for (const prospect of targetProspects) {
      // Check if already imported
      if (prospect.crmLeadId) {
        continue;
      }

      const duplicateConditions: any[] = [ilike(leads.companyName, prospect.companyName)];
      if (prospect.email) duplicateConditions.push(ilike(leads.email, prospect.email));
      if (prospect.phone) duplicateConditions.push(ilike(leads.phone, prospect.phone));
      const existingLeads = await db.select().from(leads)
        .where(and(eq(leads.businessId, businessId), or(...duplicateConditions)))
        .limit(1);

      if (existingLeads.length > 0) {
        await db.update(prospects)
          .set({ crmLeadId: existingLeads[0].id, status: 'imported', updatedAt: new Date() })
          .where(eq(prospects.id, prospect.id));
        continue;
      }

      const notes = `Origem: Prospecção B2B\nFonte do Contato: ${prospect.sourceUrl || prospect.contactSource || 'Publicamente disponibilizado'}\nScore de Qualificação: ${prospect.qualificationScore || 0}/100\nJustificativa: ${prospect.qualificationReason || ''}\nPossível Necessidade: ${prospect.possibleNeed || ''}`;

      // Insert into CRM leads table
      const [newLead] = await db.insert(leads).values({
        organizationId,
        businessId,
        name: prospect.companyName,
        companyName: prospect.companyName,
        email: prospect.email || null,
        phone: prospect.phone || '',
        source: 'prospecting',
        status: 'new',
        potentialValue: 0,
        notes,
      }).returning();

      // Update prospect status and crmLeadId
      await db.update(prospects)
        .set({
          crmLeadId: newLead.id,
          status: 'imported',
          updatedAt: new Date(),
        })
        .where(eq(prospects.id, prospect.id));

      createdLeads.push(newLead);
    }

    return {
      importedCount: createdLeads.length,
      leads: createdLeads,
    };
  }

  /**
   * Generates a CSV string export for selected or all prospects in a business.
   */
  static async exportProspectsCSV(businessId: string, prospectIds?: string[]): Promise<string> {
    let query = db.select().from(prospects).where(eq(prospects.businessId, businessId));
    
    if (prospectIds && prospectIds.length > 0) {
      query = db.select().from(prospects).where(
        and(eq(prospects.businessId, businessId), inArray(prospects.id, prospectIds))
      );
    }

    const items = await query;

    const headers = [
      'Empresa', 'Segmento', 'Cidade', 'Estado', 'Website', 
      'E-mail', 'Tipo de E-mail', 'Telefone', 'Score Qualificacao', 
      'Status', 'Fonte de Origem'
    ];

    const rows = items.map(p => [
      `"${(p.companyName || '').replace(/"/g, '""')}"`,
      `"${(p.segment || '').replace(/"/g, '""')}"`,
      `"${(p.city || '').replace(/"/g, '""')}"`,
      `"${(p.state || '').replace(/"/g, '""')}"`,
      `"${(p.website || '').replace(/"/g, '""')}"`,
      `"${(p.email || '').replace(/"/g, '""')}"`,
      `"${(p.emailType || '').replace(/"/g, '""')}"`,
      `"${(p.phone || '').replace(/"/g, '""')}"`,
      p.qualificationScore || 0,
      `"${p.status}"`,
      `"${(p.sourceUrl || p.contactSource || '').replace(/"/g, '""')}"`
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}
