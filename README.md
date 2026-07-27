# Bull AI Financial Research Report Generator

Turn a public company filing into an evidence-backed, four-page financial research report.

The project was built for the Bull AI software-engineer assessment. It uses page-aware parsing, Claude structured extraction, source reconciliation, and server-side PDF generation to avoid fabricated financial facts.

## Features

- Upload PDF, CSV, or TXT context documents.
- Durable SQLite-backed report jobs with a separate worker and polling UI.
- Page-aware PDF extraction with reconstructed table candidates.
- Claude structured JSON output validated with Zod.
- Source-evidence reconciliation for extracted metrics and highlights.
- Fixed four-page, Bull AI-branded PDF with compact tables, narrative, charts, disclosures, and clear missing-data handling.
- Demo mode for the UI and tests without an API key.

## Quick start

Requirements: Node.js 22+ and pnpm 9+.

```bash
pnpm install
cp .env.example .env.local
# add ANTHROPIC_API_KEY to .env.local, or set DEMO_MODE=true
pnpm dev
```

Open `http://localhost:3000`. `pnpm dev` starts both the web server and the report worker. The worker writes runtime files to `storage/`, which is intentionally ignored by Git.

To use the Claude API, create a key in the [Anthropic Console](https://console.anthropic.com/settings/keys), set `ANTHROPIC_API_KEY`, and keep it server-side. Set `CLAUDE_MODEL` and `CLAUDE_FALLBACK_MODEL` in `.env.local` if you want to use different Claude models.

## Architecture

1. The UI posts `companyName` and a file to `POST /api/reports`.
2. The API validates the upload, writes it locally, and creates a queued SQLite job.
3. `src/worker.ts` claims queued jobs, parses the source, calls Claude, reconciles evidence, and renders the PDF.
4. The UI polls `GET /api/reports/:id` and downloads the result from `GET /api/reports/:id/download`.

The report fields and validation contract live in [src/lib/report-schema.ts](src/lib/report-schema.ts). `src/lib/reconcile.ts` is the anti-fabrication gate: it verifies a model-provided evidence quote against the cited page and checks numeric tokens before retaining a value.

## Input and data rules

- Supported formats: `.pdf`, `.csv`, and `.txt`.
- PDFs are read with `pdfjs-dist` one page at a time; text blocks are grouped into likely table rows for AI context.
- Claude is asked for JSON only and each factual output includes an exact source quote and page number.
- Missing values are `Not disclosed`, not guessed. Derived values must retain supporting source operands.
- The app is intended for public source documents. Do not upload confidential material.

## Development commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Examples

- `Instructions/LTTS Q2FY26.pdf` and `Instructions/POCL Q2FY26.pdf` are the primary supplied example sources.
- `fixtures/ltts-q2fy26.txt` and `fixtures/pocl-q2fy26.csv` demonstrate non-PDF ingestion.
- `examples/generated/` contains the two committed, API-key-free assessment PDFs. They are deliberately labeled demo outputs rather than claims of a live model run.
- `examples/live/` is created by the live generation command below and contains Claude-extracted, evidence-reconciled reports.

Generate the committed demo PDFs with:

```bash
pnpm examples
```

With `ANTHROPIC_API_KEY` in `.env.local`, generate the same LTTS and POCL reports through the actual PDF parsing → Claude → Zod → reconciliation → PDF path:

```bash
pnpm examples:live
```

Alternatively, start the app with `DEMO_MODE=true`, upload either fixture, and download the completed report. A Claude-configured worker accepts the supplied LTTS or POCL PDFs directly.

## Limits

This is an assessment workflow, not investment advice or a market-data platform. It does not fetch prices, forecasts, or targets; those fields stay explicitly unavailable when the uploaded document does not disclose them.

## Deploy to Railway

This application must run as a single persistent service: the web process and worker share SQLite state, uploaded files, and generated reports. Do not deploy it as multiple replicas or a stateless serverless function.

1. Push this repository to GitHub and create a Railway project from it.
2. Add one persistent volume mounted at `/data`.
3. Add these Railway variables (never commit them): `ANTHROPIC_API_KEY`, `CLAUDE_MODEL=claude-sonnet-4-20250514`, `CLAUDE_FALLBACK_MODEL=claude-haiku-4-20250514`, `DEMO_MODE=false`, `STORAGE_ROOT=/data`, and optionally `MAX_UPLOAD_MB=15`.
4. Railway reads [`railway.json`](railway.json), runs `pnpm build`, starts both the web application and worker with `pnpm start`, and checks `/api/health`.
5. Generate the public domain and upload a small fixture first to confirm the completed-report download.

The persistent volume is required because SQLite and report files are local. For a multi-instance production system, move jobs to a managed database/queue and documents to object storage.
