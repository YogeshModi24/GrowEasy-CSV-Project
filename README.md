# GrowEasy CRM - Production-Grade AI CSV Importer Monorepo

- **Hosted App**: https://grow-easy-csv-project-web.vercel.app/
- **GitHub Repository**: https://github.com/YogeshModi24/GrowEasy-CSV-Project

An advanced, stateless, AI-powered CSV Importer structured as a Turborepo monorepo. It automatically maps, cleans, normalizes, and validates any raw CSV spreadsheet format into standard GrowEasy CRM records in a single pass using Groq.

---

### ✨ Features & Bonus Criteria

- [x] **Drag & drop upload**: Smooth Drag & Drop area in the client dashboard.
- [x] **Progress indicators during AI processing**: Step-by-step parallel batch progress tracking.
- [x] **Streaming or incremental parsing**: SSE (Server-Sent Events) streaming from backend to update client in real-time.
- [x] **Retry mechanism for failed AI batches**: Automatic retry-once logic for failed API calls, fallback to direct parser.
- [x] **Virtualized table for large CSVs**: High-performance virtualization via `@tanstack/react-virtual` to handle 1,000+ rows instantly.
- [x] **Dark mode**: Fully responsive Tailwind dark mode toggle.
- [x] **Unit tests**: Full suite of Vitest unit tests covering parsing logic, normalizations, and Zod validations.
- [x] **Docker setup**: Orchestrated via Docker Compose and custom Alpine-Node Dockerfiles.
- [x] **Deployment**: Production deployment configurations for Render and Vercel.

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

## 🔌 API Reference

### POST `/api/csv/extract`

Processes and transforms raw CSV rows into standardized CRM records using AI.

* **Type**: Server-Sent Events (SSE) stream.
* **Headers**:
  * `Content-Type: application/json`

#### Request Body
```json
{
  "rows": [
    {
      "Date": "2026-07-08",
      "Name": "John Doe",
      "Email": "john@example.com, second@example.com",
      "Phone": "+91 98765 43210",
      "Company": "GrowEasy",
      "Comments": "Warm lead looking for immediate possession"
    }
  ]
}
```

#### Event Streams Emitted
1. **Initial Progress Event**:
   ```
   data: {"type":"progress","current":0,"total":1}
   ```
2. **Batch Completed Event**:
   ```
   data: {"type":"progress","current":1,"total":1}
   ```
3. **Done Event**:
   ```
   data: {"type":"done","records":[{"created_at":"2026-07-08","name":"John Doe","email":"john@example.com","country_code":"+91","mobile_without_country_code":"9876543210","company":"GrowEasy","city":null,"state":null,"country":null,"lead_owner":null,"crm_status":"GOOD_LEAD_FOLLOW_UP","crm_note":"Warm lead looking for immediate possession. Additional email: second@example.com","data_source":null,"possession_time":"Immediate","description":"Interested client","_skip_reason":null}]}
   ```

---

## 🚀 Setup & Installation

### Prerequisites

Before starting, ensure you have the following installed:
* **Node.js**: `>= 18` (e.g., `20.20.2`)
* **pnpm**: `v9.x` (specifically `v9.15.0` as configured in the workspaces)

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
   * **Backend**: Create a `.env` file under `apps/api/.env` (see [apps/api/.env.example](file:///Users/yogeshmodi/Desktop/GrowEasy/apps/api/.env.example)):
     ```env
     PORT=3005
     GROQ_API_KEY=your_groq_api_key
     ALLOWED_ORIGIN=http://localhost:3003
     ```
   * **Frontend**: Create a `.env` file under `apps/web/.env` (see [apps/web/.env.example](file:///Users/yogeshmodi/Desktop/GrowEasy/apps/web/.env.example)):
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:3005
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

