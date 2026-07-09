# GrowEasy CRM - Production-Grade AI CSV Importer Monorepo

An advanced, stateless, AI-powered CSV Importer structured as a Turborepo monorepo. It automatically maps, cleans, normalizes, and validates any raw CSV spreadsheet format into standard GrowEasy CRM records in a single pass using Groq.

---

## 🏗️ Architecture Diagram

```
                              [ User Client (Browser) ]
                                          |
                                          | 1. Uploads Raw CSV
                                          v
                    +-------------------------------------------+
                    |   apps/web (Next.js 14 Client App)        |
                    |   - PapaParse raw client-side parsing     |
                    |   - High-performance Table Virtualization |
                    |     (@tanstack/react-virtual)             |
                    +-------------------------------------------+
                                          |
                                          | 2. POST /api/csv/extract (Raw Rows JSON)
                                          v
                    +-------------------------------------------+
                    |   apps/api (Express.js Backend Server)    |
                    |   - CORS origin validation (via env)      |
                    |   - Row Chunking (batches of 25)          |
                    |   - Concurrency Control (p-limit = 3)     |
                    |   - Retry-once logic & fallback builder   |
                    +-------------------------------------------+
                                          |
                    +---------------------+---------------------+
                    |                                           |
                    | imports Zod Schema                        | 3. Structured JSON Request
                    v                                           v
      +----------------------------+             +-----------------------------+
      |  packages/types (Shared)   |             |  Groq API (OpenAI Compatible|
      |  - Zod Record Validation   |             |  - llama-3.3-70b-versatile  |
      |  - Inferred TS Typings     |             |  - response_format:         |
      +----------------------------+             |    json_object              |
                                                 +-----------------------------+
```

---

## 📂 Project Structure

- **[packages/types](file:///Users/yogeshmodi/Desktop/GrowEasy/packages/types)**: Shared package exporting Zod schemas and inferred TypeScript types (`GrowEasyRecord`, `GrowEasyCrmStatus`, `GrowEasyDataSource`) to guarantee type-safety.
- **[apps/api](file:///Users/yogeshmodi/Desktop/GrowEasy/apps/api)**: Node.js + Express backend utilizing the official `openai` SDK mapped to Groq.
- **[apps/web](file:///Users/yogeshmodi/Desktop/GrowEasy/apps/web)**: Next.js 14 client providing a virtualized preview grid and leads dashboard.

---

## 🧠 How the AI Extraction & Mapping Works

The importer does not require the user to configure column mappings manually:

1. **Client-side Parsing**: The raw CSV file is parsed into a list of generic JSON objects in the browser.
2. **Virtualized Preview**: The raw rows are fed into a virtualized table powered by `@tanstack/react-virtual`. This allows the UI to display lists of 1,000+ rows instantly.
3. **Chunking & Concurrency**: The backend API splits the uploaded rows into batches of 25. These batches are processed in parallel with a concurrency limit of 3 concurrent requests (managed via `p-limit`) to prevent API rate limits.
4. **Structured JSON Output**: The backend calls the `llama-3.3-70b-versatile` model on Groq. It sends the raw rows and configures the SDK's `response_format` using `json_object` mode with full inline JSON schema instructions embedded inside the system instruction. Llama acts as a combined parser, column mapper, and data cleaner:
   - Splits full names into consistent casing.
   - Cleans emails and isolates phone country codes dialing prefixes.
   - Infers `crm_status` and `data_source` from descriptions.
   - Identifies invalid records and marks them with a `_skip_reason`.
5. **Schema Validation**: Results are normalized and parsed through Zod at the backend. If a batch fails twice, a fallback parser generates invalid records with a skip description so that other successful batches are not lost.

---

## 🚀 Setup & Installation

### Local Setup
1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Build projects**:
   ```bash
   pnpm run build
   ```
3. **Configure environment**:
   Create a `.env` file under `apps/api/.env` (see [.env.example](file:///Users/yogeshmodi/Desktop/GrowEasy/apps/api/.env.example)):
   ```env
   PORT=3005
   GROQ_API_KEY=your_groq_api_key
   ALLOWED_ORIGIN=http://localhost:3003
   ```
4. **Start in dev mode**:
   ```bash
   pnpm run dev
   ```
   - Client: [http://localhost:3003](http://localhost:3003) (or [http://localhost:3000](http://localhost:3000) if port is free)
   - API: [http://localhost:3005](http://localhost:3005)

### Docker local development
You can build and spin up the API container directly:
```bash
docker-compose up --build
```

---

## 🧪 Testing

Run Vitest unit tests inside the backend workspace:
```bash
pnpm --filter @groweasy/api run test
```
The test suite validates:
- Row chunking/batching partitions.
- Empty value row normalization.
- Zod schema validations and fallback outputs.
