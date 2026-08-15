import { eq } from 'drizzle-orm';
import { db, createPool } from '../../db';
import { prospects } from '../../db/schema';

type SpreadsheetRow = {
  companyName?: unknown;
  taxId?: unknown;
  address?: unknown;
  neighborhood?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  phone?: unknown;
  email?: unknown;
  segment?: unknown;
  notes?: unknown;
};

const clean = (value: unknown, max = 500) => {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : null;
};

const digits = (value: unknown, max = 20) => {
  const result = String(value ?? '').replace(/\D/g, '');
  return result && !/^0+$/.test(result) ? result.slice(0, max) : null;
};

let schemaReady = false;
export async function ensureProspectingImportSchema() {
  if (schemaReady) return;
  await createPool().query(`
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tax_id text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS neighborhood text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS postal_code text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'search';
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS import_batch_key text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS import_file_name text;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS imported_at timestamp;
    CREATE INDEX IF NOT EXISTS prospects_business_source_idx ON prospects (business_id, source_type);
    CREATE INDEX IF NOT EXISTS prospects_business_tax_id_idx ON prospects (business_id, tax_id);
  `);
  schemaReady = true;
}

export async function importProspectSpreadsheetRows(input: {
  organizationId: string;
  businessId: string;
  rows: SpreadsheetRow[];
  fileName?: string;
  batchKey?: string;
}) {
  await ensureProspectingImportSchema();
  const existing = await db.select({
    taxId: prospects.taxId,
    email: prospects.email,
    phone: prospects.phone,
    companyName: prospects.companyName,
    city: prospects.city,
  }).from(prospects).where(eq(prospects.businessId, input.businessId));

  const known = new Set<string>();
  for (const item of existing) {
    if (item.taxId) known.add(`tax:${digits(item.taxId)}`);
    if (item.email) known.add(`email:${item.email.toLowerCase()}`);
    if (item.phone) known.add(`phone:${digits(item.phone)}`);
    known.add(`name:${item.companyName.toLowerCase()}|${String(item.city || '').toLowerCase()}`);
  }

  const values: any[] = [];
  let duplicates = 0;
  let invalid = 0;
  const fileName = clean(input.fileName, 250) || 'Planilha importada';
  const batchKey = clean(input.batchKey, 100) || `${Date.now()}`;
  for (const raw of input.rows.slice(0, 250)) {
    const companyName = clean(raw.companyName, 250);
    if (!companyName) { invalid++; continue; }
    const taxId = digits(raw.taxId);
    const email = clean(raw.email, 250)?.toLowerCase() || null;
    const phone = digits(raw.phone);
    const city = clean(raw.city, 120);
    const signatures = [
      taxId ? `tax:${taxId}` : null,
      email ? `email:${email}` : null,
      phone ? `phone:${phone}` : null,
      `name:${companyName.toLowerCase()}|${String(city || '').toLowerCase()}`,
    ].filter(Boolean) as string[];
    if (signatures.some(signature => known.has(signature))) { duplicates++; continue; }
    signatures.forEach(signature => known.add(signature));
    const score = Math.min(70, 20 + [taxId, email, phone, raw.address].filter(Boolean).length * 10);
    values.push({
      organizationId: input.organizationId,
      businessId: input.businessId,
      companyName,
      legalName: companyName,
      segment: clean(raw.segment, 200),
      city,
      state: clean(raw.state, 40)?.toUpperCase() || null,
      country: 'Brasil',
      phone,
      email,
      taxId,
      address: clean(raw.address, 500),
      neighborhood: clean(raw.neighborhood, 150),
      postalCode: digits(raw.postalCode, 12),
      notes: clean(raw.notes, 4000),
      sourceType: 'spreadsheet',
      importBatchKey: batchKey,
      importFileName: fileName,
      importedAt: new Date(),
      emailType: email ? 'general' : null,
      websiteStatus: email || phone ? 'contact_found' : 'no_website_found',
      contactSource: `Planilha: ${fileName}`,
      confidence: email && phone ? 'high' : 'medium',
      qualificationScore: score,
      qualificationReason: 'Importado de planilha; aguardando qualificação comercial.',
      qualificationFit: score >= 60 ? 'medium' : 'low',
      status: 'new',
    });
  }
  if (values.length) await db.insert(prospects).values(values);
  return { imported: values.length, duplicates, invalid };
}
