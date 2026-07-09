import { z } from 'zod';

export const GrowEasyCrmStatusSchema = z.enum([
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE"
]);

export const GrowEasyDataSourceSchema = z.enum([
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots"
]);

export const GrowEasyRecordSchema = z.object({
  created_at: z.string().nullable().refine(v => v === null || !isNaN(Date.parse(v)), {
    message: "created_at must be a valid date parseable by new Date()"
  }).describe("Date/time when the lead was created, e.g. YYYY-MM-DD or ISO string, or null"),
  name: z.string().nullable().describe("Full name of the lead or null"),
  email: z.string().nullable().describe("Valid email address or null"),
  country_code: z.string().nullable().describe("Phone country code e.g. '+91', '+1' or null"),
  mobile_without_country_code: z.string().nullable().describe("Phone number without country code or null"),
  company: z.string().nullable().describe("Company or organization name or null"),
  city: z.string().nullable().describe("City name or null"),
  state: z.string().nullable().describe("State/region name or null"),
  country: z.string().nullable().describe("Country name or null"),
  lead_owner: z.string().nullable().describe("Name of the manager/agent assigning the lead or null"),
  crm_status: GrowEasyCrmStatusSchema.nullable().describe("Status classification of this lead. Must be one of the enum values or null"),
  crm_note: z.string().nullable().describe("Contextual note or comments explaining lead status or history or null"),
  data_source: GrowEasyDataSourceSchema.nullable().describe("Categorized source tracking where the lead was acquired. Must be one of the enum values or null"),
  possession_time: z.string().nullable().describe("Required timeline for possession/acquisition, e.g. 'Immediate', '6 months' or null"),
  description: z.string().nullable().describe("Raw details, logs, or comments about this contact or null"),
  _skip_reason: z.string().nullable().describe("If the record lacks essential fields (e.g. email/phone/name are all null or invalid), state the skip reason here. Else null.")
});

export type GrowEasyCrmStatus = z.infer<typeof GrowEasyCrmStatusSchema>;
export type GrowEasyDataSource = z.infer<typeof GrowEasyDataSourceSchema>;
export type GrowEasyRecord = z.infer<typeof GrowEasyRecordSchema>;
