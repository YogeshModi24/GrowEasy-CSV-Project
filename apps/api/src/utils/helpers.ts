import { 
  GrowEasyRecordSchema, 
  GrowEasyRecord, 
  GrowEasyCrmStatus, 
  GrowEasyDataSource 
} from '@groweasy/types';

// Helper functions for strict validation without 'any'
export function parseCrmStatus(val: unknown): GrowEasyCrmStatus | null {
  if (
    val === 'GOOD_LEAD_FOLLOW_UP' || 
    val === 'DID_NOT_CONNECT' || 
    val === 'BAD_LEAD' || 
    val === 'SALE_DONE'
  ) {
    return val;
  }
  return null;
}

export function parseDataSource(val: unknown): GrowEasyDataSource | null {
  if (
    val === 'leads_on_demand' || 
    val === 'meridian_tower' || 
    val === 'eden_park' || 
    val === 'varah_swamy' || 
    val === 'sarjapur_plots'
  ) {
    return val;
  }
  return null;
}

export function safeString(val: unknown): string | null {
  return typeof val === 'string' ? val : val ? String(val) : null;
}

// 1. Chunking function
export function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

// 2. Normalization function
export function normalizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    normalized[key] = (val === '' || val === undefined) ? null : val;
  }
  return normalized;
}

// 3. Zod validation logic
export function validateRecord(record: Record<string, unknown>): GrowEasyRecord {
  const normalized = normalizeRecord(record);
  const parseResult = GrowEasyRecordSchema.safeParse(normalized);

  if (parseResult.success) {
    return parseResult.data;
  }

  const isDateValid = normalized.created_at && !isNaN(Date.parse(String(normalized.created_at)));
  return {
    created_at: isDateValid ? safeString(normalized.created_at) : null,
    name: safeString(normalized.name),
    email: safeString(normalized.email),
    country_code: safeString(normalized.country_code),
    mobile_without_country_code: safeString(normalized.mobile_without_country_code),
    company: safeString(normalized.company),
    city: safeString(normalized.city),
    state: safeString(normalized.state),
    country: safeString(normalized.country),
    lead_owner: safeString(normalized.lead_owner),
    crm_status: parseCrmStatus(normalized.crm_status),
    crm_note: safeString(normalized.crm_note),
    data_source: parseDataSource(normalized.data_source),
    possession_time: safeString(normalized.possession_time),
    description: safeString(normalized.description),
    _skip_reason: `Schema validation failed: ${parseResult.error.message}`
  };
}
