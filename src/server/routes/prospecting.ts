import { Router } from "express";
import { db } from "../../db/index";
import { 
  prospectingSearches, 
  prospects, 
  prospectContacts, 
  businesses, 
  users 
} from "../../db/schema";
import { eq, and, ilike, or, desc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { ProspectingService } from "../services/ProspectingService";
import { qualifyProspect, generateApproach } from "../services/ProspectScoringService";
import { ensureProspectingImportSchema, importProspectSpreadsheetRows } from "../services/ProspectSpreadsheetImportService";

export const prospectingRouter = Router();

// Ensure user belongs to organization owning the business
const ensureBusinessOwnership = async (req: any, res: any, next: any) => {
  const businessId = req.query.businessId || req.body.businessId;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId parameter" });

  const dbUser = await db.query.users.findFirst({
    where: eq(users.uid, user.uid)
  });

  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId as string),
    with: { organization: { with: { members: true } } }
  });

  if (!business) return res.status(404).json({ error: "Business not found" });

  const isMember = business.organization.members.some(m => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });

  req.dbUser = dbUser;
  req.business = business;
  next();
};

/**
 * POST /api/prospecting/search
 * Starts a new B2B prospecting search
 */
prospectingRouter.post("/search", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { segment, city, state, country, radiusKm, keywords, requestedLimit } = req.body;

    if (!segment || !segment.trim()) {
      return res.status(400).json({ error: "Segmento é obrigatório para realizar a busca." });
    }

    const searchResult = await ProspectingService.executeSearch({
      organizationId: req.business.organizationId,
      businessId: req.business.id,
      userId: req.dbUser.id,
      segment: segment.trim(),
      city: city?.trim(),
      state: state?.trim(),
      country: country?.trim() || 'Brasil',
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      keywords: keywords?.trim(),
      requestedLimit: requestedLimit ? Number(requestedLimit) : 25,
    });

    res.json(searchResult);
  } catch (error: any) {
    console.error("Error starting prospecting search:", error);
    res.status(500).json({ error: error.message || "Falha ao executar busca de prospecção." });
  }
});

/**
 * GET /api/prospecting/searches
 * Lists recent searches for the business
 */
prospectingRouter.get("/searches", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const searches = await db.select().from(prospectingSearches)
      .where(eq(prospectingSearches.businessId, req.business.id))
      .orderBy(desc(prospectingSearches.createdAt));

    res.json({ searches });
  } catch (error: any) {
    console.error("Error fetching prospecting searches:", error);
    res.status(500).json({ error: "Falha ao carregar histórico de buscas." });
  }
});

/**
 * GET /api/prospecting/searches/:searchId
 * Gets search detail and associated prospects
 */
prospectingRouter.get("/searches/:searchId", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { searchId } = req.params;

    const [searchRecord] = await db.select().from(prospectingSearches)
      .where(and(
        eq(prospectingSearches.id, searchId),
        eq(prospectingSearches.businessId, req.business.id)
      ))
      .limit(1);

    if (!searchRecord) {
      return res.status(404).json({ error: "Busca de prospecção não encontrada." });
    }

    const prospectList = await db.select().from(prospects)
      .where(and(
        eq(prospects.searchId, searchId),
        eq(prospects.businessId, req.business.id)
      ))
      .orderBy(desc(prospects.qualificationScore));

    res.json({ search: searchRecord, prospects: prospectList });
  } catch (error: any) {
    console.error("Error fetching search details:", error);
    res.status(500).json({ error: "Falha ao carregar detalhes da busca." });
  }
});

/**
 * GET /api/prospecting/prospects
 * Lists all prospects for business with filters
 */
prospectingRouter.get("/prospects", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { hasEmail, hasPhone, hasWebsite, status, search, fit, origin, state, segment } = req.query;

    if (origin === 'spreadsheet' || origin === 'search') await ensureProspectingImportSchema();

    const conditions: any[] = [eq(prospects.businessId, req.business.id)];

    if (hasEmail === 'true') {
      conditions.push(sql`${prospects.email} IS NOT NULL AND ${prospects.email} != ''`);
    }
    if (hasPhone === 'true') {
      conditions.push(sql`${prospects.phone} IS NOT NULL AND ${prospects.phone} != ''`);
    }
    if (hasWebsite === 'true') {
      conditions.push(sql`${prospects.website} IS NOT NULL AND ${prospects.website} != ''`);
    }
    if (status) {
      conditions.push(eq(prospects.status, status as string));
    }
    if (fit) {
      conditions.push(eq(prospects.qualificationFit, fit as string));
    }
    if (origin === 'spreadsheet') conditions.push(eq(prospects.sourceType, 'spreadsheet'));
    if (origin === 'search') conditions.push(or(eq(prospects.sourceType, 'search'), sql`${prospects.sourceType} IS NULL`));
    if (state) conditions.push(ilike(prospects.state, String(state)));
    if (segment) conditions.push(ilike(prospects.segment, `%${String(segment)}%`));
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = `%${search.trim()}%`;
      conditions.push(or(
        ilike(prospects.companyName, q),
        ilike(prospects.city, q),
        ilike(prospects.email, q),
        ilike(prospects.website, q)
      ));
    }

    const allProspects = await db.select().from(prospects)
      .where(and(...conditions))
      .orderBy(desc(prospects.qualificationScore), desc(prospects.createdAt));
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(25, Number(req.query.pageSize || 100)));
    const prospectList = allProspects.slice((page - 1) * pageSize, page * pageSize);
    res.json({
      prospects: prospectList,
      pagination: { page, pageSize, total: allProspects.length, totalPages: Math.max(1, Math.ceil(allProspects.length / pageSize)) },
    });
  } catch (error: any) {
    console.error("Error listing prospects:", error);
    res.status(500).json({ error: "Falha ao carregar lista de prospects." });
  }
});

prospectingRouter.post("/import-spreadsheet", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'Nenhuma empresa foi enviada para importação.' });
    const result = await importProspectSpreadsheetRows({
      organizationId: req.business.organizationId,
      businessId: req.business.id,
      rows,
      fileName: req.body?.fileName,
      batchKey: req.body?.batchKey,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Error importing spreadsheet:', error);
    res.status(500).json({ error: error.message || 'Falha ao importar a planilha.' });
  }
});

prospectingRouter.patch("/prospects/status", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const ids = Array.isArray(req.body?.prospectIds) ? req.body.prospectIds.slice(0, 250) : [];
    const status = String(req.body?.status || '');
    if (!ids.length || !['new', 'reviewed', 'qualified', 'disqualified'].includes(status)) {
      return res.status(400).json({ error: 'Seleção ou status inválido.' });
    }
    const updated = await db.update(prospects).set({ status, updatedAt: new Date() })
      .where(and(eq(prospects.businessId, req.business.id), inArray(prospects.id, ids), sql`${prospects.crmLeadId} IS NULL`))
      .returning({ id: prospects.id });
    res.json({ updatedCount: updated.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Falha ao atualizar os prospects.' });
  }
});

/**
 * GET /api/prospecting/prospects/:id
 * Gets full prospect details and associated contacts
 */
prospectingRouter.get("/prospects/:id", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [prospectRecord] = await db.select().from(prospects)
      .where(and(
        eq(prospects.id, id),
        eq(prospects.businessId, req.business.id)
      ))
      .limit(1);

    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect não encontrado." });
    }

    const contactsList = await db.select().from(prospectContacts)
      .where(eq(prospectContacts.prospectId, id));

    res.json({ prospect: prospectRecord, contacts: contactsList });
  } catch (error: any) {
    console.error("Error fetching prospect details:", error);
    res.status(500).json({ error: "Falha ao carregar detalhes do prospect." });
  }
});

/**
 * POST /api/prospecting/prospects/:id/qualify
 * Re-runs AI qualification for a specific prospect
 */
prospectingRouter.post("/prospects/:id/qualify", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [prospectRecord] = await db.select().from(prospects)
      .where(and(
        eq(prospects.id, id),
        eq(prospects.businessId, req.business.id)
      ))
      .limit(1);

    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect não encontrado." });
    }

    const qualification = await qualifyProspect(
      {
        name: req.business.name,
        segment: req.business.segment || undefined,
        description: req.business.description || undefined,
      },
      {
        companyName: prospectRecord.companyName,
        segment: prospectRecord.segment || undefined,
        city: prospectRecord.city || undefined,
        state: prospectRecord.state || undefined,
        description: prospectRecord.description || undefined,
        website: prospectRecord.website || undefined,
      }
    );

    const [updated] = await db.update(prospects)
      .set({
        qualificationScore: qualification.score,
        qualificationReason: qualification.reason,
        qualificationFit: qualification.fit,
        possibleNeed: qualification.possibleNeed,
        status: qualification.fit === 'high' ? 'qualified' : prospectRecord.status,
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, id))
      .returning();

    res.json({ prospect: updated, qualification });
  } catch (error: any) {
    console.error("Error qualifying prospect:", error);
    res.status(500).json({ error: "Falha ao qualificar prospect." });
  }
});

/**
 * POST /api/prospecting/prospects/:id/generate-approach
 * Generates an outreach email approach suggestion without sending
 */
prospectingRouter.post("/prospects/:id/generate-approach", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { id } = req.params;
    const options = req.body || {};

    const [prospectRecord] = await db.select().from(prospects)
      .where(and(
        eq(prospects.id, id),
        eq(prospects.businessId, req.business.id)
      ))
      .limit(1);

    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect não encontrado." });
    }

    const approach = await generateApproach(
      {
        name: req.business.name,
        segment: req.business.segment || undefined,
        description: req.business.description || undefined,
      },
      {
        companyName: prospectRecord.companyName,
        segment: prospectRecord.segment || undefined,
        city: prospectRecord.city || undefined,
        description: prospectRecord.description || undefined,
        website: prospectRecord.website || undefined,
      },
      options
    );
    const { source = 'template', ...approachContent } = approach;
    res.json({ approach: approachContent, source });
  } catch (error: any) {
    console.error("Error generating approach:", error);
    res.status(500).json({ error: "Falha ao gerar proposta de abordagem." });
  }
});

/**
 * POST /api/prospecting/prospects/import
 * Bulk imports prospects as CRM leads
 */
prospectingRouter.post("/prospects/import", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { prospectIds } = req.body;

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({ error: "Nenhum prospect selecionado para importação." });
    }

    const result = await ProspectingService.importProspectsToCRM(
      req.business.id,
      req.business.organizationId,
      prospectIds
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error importing prospects to CRM:", error);
    res.status(500).json({ error: "Falha ao importar prospects para o CRM." });
  }
});

/**
 * POST /api/prospecting/prospects/export
 * Exports selected or all prospects as CSV
 */
prospectingRouter.post("/prospects/export", requireAuth, ensureBusinessOwnership, async (req: any, res) => {
  try {
    const { prospectIds } = req.body;

    const csvData = await ProspectingService.exportProspectsCSV(
      req.business.id,
      Array.isArray(prospectIds) ? prospectIds : undefined
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
    res.send(csvData);
  } catch (error: any) {
    console.error("Error exporting prospects CSV:", error);
    res.status(500).json({ error: "Falha ao exportar CSV de prospects." });
  }
});
