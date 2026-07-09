import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { GrowEasyRecord } from '@groweasy/types';
import { logger } from './utils/logger';
import { 
  chunkRows, 
  validateRecord, 
  safeString,
  parseCrmStatus,
  parseDataSource
} from './utils/helpers';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

// Dynamic CORS whitelist for local development fallbacks & production environments
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3003',
  process.env.ALLOWED_ORIGIN
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

// Helper function to process a single batch with retry-once logic using Groq (OpenAI-compatible)
async function processBatch(
  batch: Record<string, unknown>[],
  batchIndex: number,
  totalBatches: number,
  openai: OpenAI
): Promise<GrowEasyRecord[]> {
  const prompt = `
You are an expert CRM data ingestion engine. Your job is to extract, map, clean, and enrich the following raw lead data rows from a CSV and structure them into GrowEasy CRM records.

Raw Rows to process (Batch ${batchIndex + 1} of ${totalBatches}):
${JSON.stringify(batch, null, 2)}

Instructions for fields:
- created_at: Format as ISO date string (YYYY-MM-DD) if date exists, otherwise use current date/time or null.
- name: Full name. Clean up any weird symbols, capitalize names properly (Title Case).
- email: Clean and lowercase. If a raw cell has multiple emails (e.g. "a@x.com, b@x.com"), place only the first one in this "email" field, and append all others to the "crm_note" field. If not a valid email, set to null.
- country_code & mobile_without_country_code: Split phone numbers correctly (e.g. +91 9876543210 -> country_code: "+91", mobile_without_country_code: "9876543210"). If there are multiple phone numbers in one raw cell, extract only the first one here, and append the remaining numbers to the "crm_note" field. If no country code can be determined, set country_code to null. Remove brackets, dashes, and extra spaces.
- company, city, state, country: Clean and capitalize. Set to null if not available.
- lead_owner: Set to null if not available.
- crm_status: Classify based on descriptions or notes. Allowed values: "GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE" or null.
- crm_note: A helpful summary note of the lead details.
- data_source: Match the source of the lead. Allowed values: "leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots" or null.
- possession_time: Timeline e.g. "Immediate", "6 months", "Dec 2026" or null.
- description: Retain general summary details.
- _skip_reason: If the row lacks essential contact details (both phone and email are null, or name is missing), or it's clearly spam/junk, write the reason here (e.g. "No contact details provided"). Otherwise set to null.

Output a single JSON object with a "records" array matching this exact JSON Schema structure:
{
  "records": [
    {
      "created_at": "string or null (ISO date YYYY-MM-DD)",
      "name": "string or null",
      "email": "string or null",
      "country_code": "string or null",
      "mobile_without_country_code": "string or null",
      "company": "string or null",
      "city": "string or null",
      "state": "string or null",
      "country": "string or null",
      "lead_owner": "string or null",
      "crm_status": "GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE | null",
      "crm_note": "string or null",
      "data_source": "leads_on_demand | meridian_tower | eden_park | varah_swamy | sarjapur_plots | null",
      "possession_time": "string or null",
      "description": "string or null",
      "_skip_reason": "string or null"
    }
  ]
}

Make sure every single record in the returned "records" array maps 1-to-1 with a row in the batch. Ensure all fields are included in the JSON response for every record (use null for fields that cannot be populated).
`;

  const runBatchCall = async (): Promise<GrowEasyRecord[]> => {
    const response = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: 'Format and extract raw lead rows into structured CRM records. You must strictly output JSON matching the provided schema. Do not skip records.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      response_format: {
        type: 'json_object'
      }
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error('Received empty response from Groq API.');
    }

    const parsedJson = JSON.parse(responseText);
    const records = parsedJson.records;

    if (!Array.isArray(records)) {
      throw new Error('Groq did not return an array under the "records" field.');
    }

    return records.map((record) => validateRecord(record as Record<string, unknown>));
  };

  try {
    // Attempt 1
    logger.info(`Starting Groq Batch ${batchIndex + 1}/${totalBatches}`);
    return await runBatchCall();
  } catch (error) {
    logger.warn(`Batch ${batchIndex + 1} failed on first attempt. Retrying... Error: ${error instanceof Error ? error.message : String(error)}`);
    try {
      // Attempt 2 (Retry-once logic)
      return await runBatchCall();
    } catch (retryError) {
      logger.error(`Batch ${batchIndex + 1} failed on second attempt. Fallback applied. Error: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
      
      // Return a set of skipped records so the whole upload doesn't fail
      return batch.map((row) => ({
        created_at: safeString(row.created_at || row.Date || null),
        name: safeString(row.name || row.Name || row.Client || null),
        email: safeString(row.email || row.Email || null),
        country_code: null,
        mobile_without_country_code: safeString(row.mobile || row.phone || row.Phone || row.Contact || null),
        company: safeString(row.company || row.Company || null),
        city: safeString(row.city || null),
        state: safeString(row.state || null),
        country: safeString(row.country || null),
        lead_owner: safeString(row.lead_owner || null),
        crm_status: parseCrmStatus(row.crm_status),
        crm_note: safeString(row.crm_note),
        data_source: parseDataSource(row.data_source),
        possession_time: safeString(row.possession_time || null),
        description: safeString(row.description || null),
        _skip_reason: `AI processing failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`
      }));
    }
  }
}

// POST endpoint to parse and clean raw CSV rows
app.post('/api/csv/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'Payload must contain a "rows" array.' });
      return;
    }

    if (rows.length === 0) {
      res.json({ records: [] });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GROQ_API_KEY is not configured on the API server. Please configure it in your apps/api/.env file.'
      });
      return;
    }

    // Initialize the OpenAI SDK pointing to Groq's endpoint
    const openai = new OpenAI({ 
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });

    // 1. Chunk rows into batches
    const BATCH_SIZE = 25;
    const batches = chunkRows(rows as Record<string, unknown>[], BATCH_SIZE);

    // 2. Concurrency-limited parallel batch calls via p-limit
    const CONCURRENCY_LIMIT = 3;
    const limit = pLimit(CONCURRENCY_LIMIT);

    logger.info(`Processing ${rows.length} rows in ${batches.length} batches using Groq llama-3.3-70b-versatile with concurrency limit of ${CONCURRENCY_LIMIT}...`);

    // Set event stream headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx/proxies
    });

    let completedCount = 0;

    // Send initial layout queue event
    res.write(`data: ${JSON.stringify({ type: 'progress', current: 0, total: batches.length })}\n\n`);

    const tasks = batches.map((batch, index) => {
      return limit(async () => {
        const records = await processBatch(batch, index, batches.length, openai);
        completedCount++;
        res.write(`data: ${JSON.stringify({ type: 'progress', current: completedCount, total: batches.length })}\n\n`);
        return records;
      });
    });

    const results = await Promise.all(tasks);
    const allRecords = results.flat();

    res.write(`data: ${JSON.stringify({ type: 'done', records: allRecords })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('Error processing extract request:', error instanceof Error ? error.message : String(error));
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : String(error) })}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        error: 'An internal server error occurred while processing the CSV data.',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

app.listen(port, () => {
  logger.info(`GrowEasy CRM API listening at http://localhost:${port}`);
});
