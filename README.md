# Bull AI — Financial Research Report Generator

Upload a company filing, get back a four-page equity-research PDF in which **every printed figure has been matched back to a page of that filing**.

The report template is reverse-engineered from the supplied Geojit sample (`Samples/Eternal-Geojit.pdf`): same section order, same front-page split between a reference column and a narrative column, the same combo bar-and-line charts, the same consolidated-financials page and disclosures page.

There is no demo mode and no fixture data. Reports are produced by calling Gemini on the document you upload, or the run fails and tells you why.

---

## Quick start

Requirements: **Node.js 22+** (the worker uses the built-in `node:sqlite` module).

```bash
npm install
cp .env.example .env.local     # then add your GEMINI_API_KEY
npm run dev
```

Open <http://localhost:3000>. `npm run dev` starts the Next.js server and the report worker together.

Generate a report from the command line instead:

```bash
npm run generate -- --company "L&T Technology Services" --source "Samples/LTTS Q2FY26.pdf"
```

That writes three files into `output/`:

| File | What it is |
| --- | --- |
| `<name>.pdf` | The rendered four-page report |
| `<name>.json` | The schema-validated structured output **and** the full machine-readable run trace |
| `<name>.trace.txt` | A human-readable run trace: per-pass model, tokens, timings, and every fact the reconciler rejected |

---

## How it works

```
upload ──▶ parse ──▶ extract (4 passes) ──▶ reconcile ──▶ render
           │          │                     │             │
           page-aware  Gemini structured    evidence gate  React-PDF
           + table     outputs, Zod-typed   drops anything
           rows                             it cannot verify
```

### 1. Parse — `src/lib/document-parser.ts`

`pdfjs-dist` reads the document one page at a time. Text items are grouped into visual rows by baseline and ordered left to right, with column boundaries inferred from the gap between the end of one run of text and the start of the next. Without that step a financial table reads as scrambled prose and its numbers can no longer be tied to their row labels; with it, a page comes back as:

```
Top 5 Clients | 15.0% | 15.1% | 15.1%
Total Headcount | 23,698 | 23,626 | 23,678
```

Each page keeps a `searchText` — normalised once, so `Rs. 29,795` and `29795` compare equal, and `(1,234)` compares equal to `-1234`. That is what the reconciler searches.

CSV and TXT sources go through the same pipeline and are paginated so their evidence still carries a locator.

### 2. Extract — `src/lib/extract.ts`

Four focused passes rather than one giant prompt, because a single request asking for the whole report returns thin tables and fails as a unit:

| Pass | Produces |
| --- | --- |
| `profile` | Sector, period, headline, description, highlights, outlook, company data, shareholding |
| `quarterly` | The quarterly income statement with its comparative columns |
| `statements` | P&L, balance sheet, cashflow, ratios and segment tables across whatever periods the document presents |
| `charts` | Two to four chartable time series, plus any targets the company itself published |

Each pass uses **constrained decoding** — `responseMimeType: "application/json"` plus a `responseJsonSchema` — so the response is guaranteed to parse and to match the contract. There is no JSON repair loop; the Zod `.parse()` after it is a contract check, not a parser.

Zod stays the single source of truth. `src/lib/json-schema.ts` converts each schema with `z.toJSONSchema()` and then prunes it to exactly the keyword subset Gemini's `responseJsonSchema` documents — unsupported keywords are not ignored by the API, they can get the request rejected. `npm run schema-check` asserts that pruning holds.

Every schema field that may be absent is `.nullable()` rather than optional, which forces the model to say "not disclosed" explicitly instead of quietly omitting a key.

The source transcript is byte-identical across all four passes and is sent as the first part of the request, so Gemini's implicit context caching can match the prefix; `cached_tokens` in the run trace shows how much was served that way.

Schemas live in [`src/lib/report-schema.ts`](src/lib/report-schema.ts) — that file is the single place to add or change a report field.

### 3. Reconcile — `src/lib/reconcile.ts`

The anti-fabrication gate. Nothing reaches the PDF until it has been matched back to the uploaded document:

- **Quote verification.** The model's evidence quote must appear verbatim on a real page. If it appears on a different page than the model cited, the page number is corrected and the correction is recorded.
- **Figure verification.** Every number carrying two or more significant digits must appear in that quote or on that page.
- **Quote repair.** If the quote does not match but the figure is provably on the cited page, the value is kept and the quote is **replaced with the document's own line**, so the reader sees the source's words rather than a model paraphrase.
- **Prose gating.** Narrative sentences are the model's summary, so the check is on the facts inside them: a sentence containing a figure that is not in the document is discarded whole.
- **Derived-value cross-check.** A stated YoY or QoQ percentage is recomputed from the two figures it is derived from and dropped if it does not follow (basis-point changes are exempt, being a different measure).
- **Chart points.** A plotted value must exist in the source; a chart with fewer than two surviving points is removed.

Anything that fails prints as **"Not disclosed"**. Rejections are not silent — they are counted and itemised in the run trace.

### 4. Render — `src/pdf/report-document.tsx`

`@react-pdf/renderer` produces a fixed four-page A4 document:

| Page | Contents |
| --- | --- |
| 1 | Header, metadata strip, company data / shareholding / financial summary column, headline, description, highlights, outlook, quarterly financials |
| 2 | Key highlights, up to four bar-and-line combo charts on dual axes, segment table or stated targets |
| 3 | Consolidated financials (P&L, balance sheet, cashflow, ratios) and a source-coverage table |
| 4 | Method, scope and limitations, the source-evidence appendix, disclaimer |

Where the Geojit sample prints market data, this template prints the evidence trail. That is deliberate: a company filing does not disclose share prices, ratings, target prices or broker estimates, so those slots carry an explicit "Not disclosed" rather than an invented number.

---

## Where the template fields are defined

| Concern | File |
| --- | --- |
| Report fields and the model-facing contract | `src/lib/report-schema.ts` |
| Zod → Gemini JSON Schema conversion | `src/lib/json-schema.ts` |
| Extraction prompts and pass structure | `src/lib/extract.ts` |
| Verification rules | `src/lib/reconcile.ts` |
| Page layout, tables and charts | `src/pdf/report-document.tsx` |
| Parsing and table reconstruction | `src/lib/document-parser.ts` |

Adding a field is a three-line change: add it to the schema, mention it in the relevant pass instruction, and place it in the template. Adding a company requires nothing — the pipeline is company-agnostic.

---

## Input and data rules

- Supported formats: **PDF, CSV and TXT** (`fixtures/` contains a CSV and a TXT sample for the non-PDF paths).
- Upload ceiling defaults to 20 MB; scanned image-only PDFs are rejected with a clear message rather than producing an empty report.
- Figures are reproduced in the unit the company reported. No rescaling, no currency conversion.
- Missing values render as "Not disclosed". Nothing is inferred, interpolated or carried across periods.
- The app is for public source documents. Do not upload confidential material.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | **Required.** Server-side only; never sent to the browser. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Extraction model. `gemini-3.1-pro-preview` extracts dense tables somewhat better but is a preview model. |
| `GEMINI_THINKING_LEVEL` | `HIGH` | `MINIMAL` / `LOW` / `MEDIUM` / `HIGH`, model dependent. Dropped automatically and retried if the model rejects it. |
| `MAX_UPLOAD_MB` | `20` | Web upload ceiling. |
| `MAX_SOURCE_CHARS` | `400000` | Source characters sent per pass. |
| `STORAGE_ROOT` | `storage` | SQLite database, uploads and generated PDFs. |

**On model choice and quota.** Model IDs in this family move quickly — `gemini-2.5-flash` now returns 404 even though it is still listed by `models.list`, and preview IDs get retired. If a run fails on an unknown model, `npm run models` prints what the key can actually reach.

One report is four requests. The free tier caps requests per model per day, so generating a couple of reports can exhaust it; the quota is per model, so switching `GEMINI_MODEL` gives a fresh allowance. A daily-quota rejection fails fast with that advice rather than retrying, while a busy-model 503 or a per-minute limit is retried with backoff.

---

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Two offline helpers, useful for working on the parser or the template without spending API calls:

```bash
npm run parse-check -- "Samples/POCL Q2FY26.pdf" 5     # show what the parser sees
npm run render-check -- output/report.json out.pdf     # re-render a saved payload
npm run schema-check                                   # assert the JSON Schemas stay Gemini-compatible
```

The test suite covers the two pieces where correctness actually matters: table-row reconstruction and every branch of the evidence gate — accepted values, invented figures, invented quotes, corrected page numbers, repaired quotes, contradictory growth rates and unverifiable chart points.

---

## Architecture notes

The web path is durable rather than request-scoped: `POST /api/reports` validates the upload, writes it to disk and queues a SQLite job; `src/worker.ts` claims the job and runs the pipeline; the UI polls `GET /api/reports/:id`. A generation takes minutes, so doing it inside the request would time out.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/reports` | Queue a job from a company name and a file |
| `GET /api/reports/:id` | Job status |
| `GET /api/reports/:id/download` | The generated PDF |
| `GET /api/reports/:id/data` | Structured output and run trace as JSON |
| `POST /api/reports/:id/retry` | Requeue a failed job |
| `GET /api/health` | Health check |

## Deploying

The web process and the worker share SQLite state and the filesystem, so this runs as **one persistent service, not multiple replicas and not a serverless function**.

1. Push to GitHub and create a Railway project from the repo.
2. Add one persistent volume mounted at `/data`.
3. Set `GEMINI_API_KEY`, `STORAGE_ROOT=/data`, and optionally `GEMINI_MODEL` / `GEMINI_THINKING_LEVEL`.
4. Railway reads [`railway.json`](railway.json), builds with `npm ci && npm run build`, starts both processes with `npm start`, and health-checks `/api/health`.

For a multi-instance production system the jobs table would move to a managed queue and the documents to object storage; the pipeline itself is already stateless.

## Limitations

This is an extraction and typesetting system, not a research desk. It does not fetch market data, and it does not produce ratings, target prices, forecasts or investment advice. Its output is only as good as the filing it is given, and a company can restate the figures it reproduces.
