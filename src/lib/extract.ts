import { ApiError, FinishReason, GoogleGenAI, type ThinkingLevel } from "@google/genai";
import type { z } from "zod";

import { config, requireApiKey } from "@/lib/config";
import type { ParsedDocument } from "@/lib/document-parser";
import { toGeminiJsonSchema } from "@/lib/json-schema";
import { Reconciler, type Rejection } from "@/lib/reconcile";
import {
  chartsSchema,
  profileSchema,
  quarterlySchema,
  statementsSchema,
  type Charts,
  type Cited,
  type ResearchReport,
  type VerifiedProfile,
} from "@/lib/report-schema";

export type PassTrace = {
  pass: string;
  model: string;
  durationMs: number;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  cachedTokens: number;
  finishReason: string;
  attempts: number;
};

export type RunTrace = {
  startedAt: string;
  finishedAt: string;
  demoMode: false;
  provider: "Google Gemini";
  model: string;
  thinkingLevel: string;
  sourceFile: string;
  sourcePages: number;
  sourceCharacters: number;
  passes: PassTrace[];
  failedPasses: Array<{ pass: string; reason: string }>;
  totals: { promptTokens: number; outputTokens: number; thoughtTokens: number; cachedTokens: number; durationMs: number };
  reconciliation: {
    valuesAccepted: number;
    valuesRejected: number;
    quotesRepaired: number;
    pagesCorrected: number;
    rejections: Rejection[];
  };
  output: {
    highlights: number;
    keyHighlights: number;
    quarterlyRows: number;
    profitAndLossRows: number;
    balanceSheetRows: number;
    cashflowRows: number;
    ratioRows: number;
    segmentRows: number;
    shareholdingRows: number;
    companyDataRows: number;
    charts: number;
    chartPoints: number;
    sources: number;
  };
};

const SYSTEM_PROMPT = `You extract facts from a company's own published financial document so they can be typeset into a research report.

Rules, in order of importance:
1. Never state a number, date, name, ratio or claim that is not in the document. There is no outside knowledge, no estimation, no inference from typical industry values, and no arithmetic you invent.
2. Every factual field carries evidence: the 1-based "page" it came from and a "quote" copied character-for-character from that page. Quotes must be excerpts, never paraphrases — an inexact quote causes the value to be discarded downstream.
3. When the document does not disclose something, return null for that value (and null page and quote). Returning null is correct and expected; guessing is a failure.
4. Copy figures exactly as reported, including the sign, decimals and the unit the document uses. Do not rescale crore into million or convert currencies.
5. Only report a growth rate or margin if the document itself states it. Do not compute one.
6. This is a factual extraction task, not investment advice. Do not produce ratings, target prices, recommendations or forecasts unless the document contains them, in which case attribute them as the document does.

The pages are supplied with reconstructed table rows, where "|" separates cells of the same row. Those rows are the most reliable source for tabular figures.`;

type PassName = "profile" | "quarterly" | "statements" | "charts";

const PASS_INSTRUCTIONS: Record<PassName, (company: string) => string> = {
  profile: (company) => `Extract the report front-matter for ${company}.

Write the headline, description, highlights and outlook in plain, specific prose grounded in the document. Prefer sentences that carry a disclosed figure over generic statements. For "outlook", describe what the document actually says about the road ahead; if it gives no forward guidance, say so plainly rather than inventing one.

For companyData, include only reference facts the document discloses. Use rows the document supports — for example market capitalisation, shares outstanding, listing codes, credit ratings, installed capacity, plant count, employee count, promoter holding. Do not invent stock-market data such as 52-week ranges or beta if the document does not carry them; emit those rows with a null cell instead.`,

  quarterly: (company) => `Extract the consolidated quarterly income statement for ${company} for the quarter this document reports on.

Build one row per reported line: revenue/net sales, EBITDA, EBITDA margin, EBIT, PBT, tax, reported PAT, adjusted PAT and EPS, plus any other income-statement line the document shows. Fill current, prior-year quarter and previous quarter from the document's own comparative columns. Only populate yoy and qoq when the document prints those growth figures itself — otherwise null.

State the unit exactly as the document does.`,

  statements: (company) => `Extract the multi-period financial statements for ${company}.

Use the period columns the document actually presents (they may be quarters, half-years or full years). Populate profitAndLoss, balanceSheet, cashflow and ratios only from disclosed lines — many quarterly documents disclose few or none of these, and an empty array is the correct answer in that case. Every value must carry the period label it belongs to.

Also extract "segments": the business-line, product or geography breakdown the document discloses, with its own period labels in segmentPeriods.`,

  charts: (company) => `Extract chartable time series for ${company}.

Choose 2 to 4 measures the document discloses across at least two periods each — for example quarterly revenue, EBITDA, PAT, volumes or a segment's revenue. Values must be plain numbers in the stated unit, with no commas or currency symbols, ordered oldest first. Where the document also discloses a matching ratio for the same periods (a margin, a growth rate), supply it as the secondary "line" series with a lineLabel; otherwise return an empty line array and a null lineLabel.

Also extract "guidance": forward-looking targets the document itself states, such as capacity additions, stated goals or management targets. If it states none, return an empty array.`,
};

const MAX_ATTEMPTS = 4;

const RETRYABLE_FINISH = new Set<string>([FinishReason.MAX_TOKENS, FinishReason.OTHER]);
const BLOCKED_FINISH: Record<string, string> = {
  [FinishReason.SAFETY]: "the safety filters blocked the response",
  [FinishReason.PROHIBITED_CONTENT]: "the response was blocked as prohibited content",
  [FinishReason.BLOCKLIST]: "the response hit a blocklist",
  [FinishReason.SPII]: "the response was blocked for sensitive personal information",
  [FinishReason.RECITATION]: "the response was blocked as recitation",
};

async function runPass<T extends z.ZodType>(
  ai: GoogleGenAI,
  pass: PassName,
  schema: T,
  companyName: string,
  document: ParsedDocument,
  trace: PassTrace[],
): Promise<z.infer<T>> {
  const transcript = document.transcript.slice(0, config.maxSourceChars);
  const startedAt = Date.now();
  const responseJsonSchema = toGeminiJsonSchema(schema);

  let lastError: unknown;
  let useThinkingConfig = true;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: config.geminiModel,
        contents: [
          {
            role: "user",
            parts: [
              // The document is byte-identical across all four passes and is sent
              // first, so Gemini's implicit context caching can match the prefix
              // and bill passes 2-4 at the cached rate.
              { text: `Source document: ${document.fileName}\n\n${transcript}` },
              { text: PASS_INSTRUCTIONS[pass](companyName) },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema,
          maxOutputTokens: 60000,
          ...(useThinkingConfig
            ? { thinkingConfig: { thinkingLevel: config.geminiThinkingLevel as ThinkingLevel } }
            : {}),
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = String(candidate?.finishReason ?? "UNSPECIFIED");

      if (BLOCKED_FINISH[finishReason]) {
        throw new Error(`Gemini did not return this pass: ${BLOCKED_FINISH[finishReason]}.`);
      }
      if (finishReason === FinishReason.MAX_TOKENS) {
        throw new Error("The model hit its output limit before finishing this pass.");
      }

      const text = response.text;
      if (!text?.trim()) throw new Error("The model returned an empty response for this pass.");

      // responseJsonSchema constrains the output, so this is a contract check
      // rather than a parser: a failure here means the contract moved.
      const parsed = schema.parse(JSON.parse(text));

      const usage = response.usageMetadata;
      trace.push({
        pass,
        model: response.modelVersion ?? config.geminiModel,
        durationMs: Date.now() - startedAt,
        promptTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        thoughtTokens: usage?.thoughtsTokenCount ?? 0,
        cachedTokens: usage?.cachedContentTokenCount ?? 0,
        finishReason,
        attempts: attempt,
      });
      return parsed as z.infer<T>;
    } catch (error) {
      lastError = error;

      // Not every model in the family accepts a thinking level. Rather than
      // hard-coding which do, drop the setting once and retry.
      if (
        useThinkingConfig &&
        error instanceof ApiError &&
        error.status === 400 &&
        /thinking/i.test(error.message ?? "")
      ) {
        useThinkingConfig = false;
        continue;
      }

      const status = error instanceof ApiError ? (error.status ?? 0) : 0;

      if (status === 429) {
        const message = error instanceof Error ? error.message : "";
        // A per-day project quota will not clear by waiting a few seconds, so
        // say so plainly instead of burning the remaining attempts on it.
        if (/PerDay|per day|requests_per_day/i.test(message)) {
          throw new Error(
            `Extraction pass "${pass}" stopped: the API key's daily free-tier quota for ${config.geminiModel} is used up. ` +
              "Wait for the quota to reset, set GEMINI_MODEL to another model, or enable billing on the project.",
          );
        }
        // Otherwise honour the server's own retry hint before trying again.
        const hinted = Number(message.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? 0);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(hinted, 2 * attempt) * 1000 + 500));
          continue;
        }
        break;
      }

      const retryable =
        status >= 500 ||
        (error instanceof Error && /output limit|empty response|fetch failed|ETIMEDOUT/i.test(error.message));
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      // A 503 here means the model is busy, not that the request is bad, so
      // back off properly rather than hammering it three times in six seconds.
      await new Promise((resolve) => setTimeout(resolve, [4000, 12000, 30000][attempt - 1] ?? 30000));
    }
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Extraction pass "${pass}" failed: ${message}`);
}

export async function extractReport(
  companyName: string,
  document: ParsedDocument,
): Promise<{ report: ResearchReport; trace: RunTrace }> {
  const ai = new GoogleGenAI({ apiKey: requireApiKey() });
  const passes: PassTrace[] = [];
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const failedPasses: Array<{ pass: string; reason: string }> = [];

  /**
   * Only the profile pass is load-bearing — without it there is no report. If a
   * later pass is still failing after its retries, that section is left empty
   * and recorded, rather than discarding the passes that already succeeded.
   */
  async function optional<T>(name: PassName, run: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      failedPasses.push({ pass: name, reason });
      console.warn(`[extract] ${name} pass failed, continuing without it: ${reason}`);
      return fallback;
    }
  }

  // Sequential rather than parallel: passes 2-4 reuse the cached document prefix
  // that pass 1 establishes, which is cheaper than four cold requests.
  const rawProfile = await runPass(ai, "profile", profileSchema, companyName, document, passes);
  const rawQuarterly = await optional(
    "quarterly",
    () => runPass(ai, "quarterly", quarterlySchema, companyName, document, passes),
    { unit: "", currentLabel: "", priorYearLabel: null, previousQuarterLabel: null, rows: [] },
  );
  const rawStatements = await optional(
    "statements",
    () => runPass(ai, "statements", statementsSchema, companyName, document, passes),
    { unit: "", periods: [], profitAndLoss: [], balanceSheet: [], cashflow: [], ratios: [], segments: [], segmentPeriods: [] },
  );
  const rawCharts = await optional(
    "charts",
    () => runPass(ai, "charts", chartsSchema, companyName, document, passes),
    { charts: [], guidance: [] },
  );

  const gate = new Reconciler(document.pages);

  const profile: VerifiedProfile = {
    ...rawProfile,
    description: gate.text("profile.description", rawProfile.description) ?? {
      text: `This report was generated from ${document.fileName}. The document does not contain a verifiable company description.`,
      page: null,
      quote: null,
    },
    highlights: compact(rawProfile.highlights?.map((item, index) => gate.text(`profile.highlight[${index}]`, item))),
    keyHighlights: compact(
      rawProfile.keyHighlights?.map((item, index) => gate.text(`profile.keyHighlight[${index}]`, item)),
    ),
    outlook: gate.text("profile.outlook", rawProfile.outlook),
    companyData: (rawProfile.companyData ?? [])
      .filter((entry) => entry.label?.trim())
      .map((entry) => ({
        label: entry.label,
        cell: gate.value(`profile.companyData.${entry.label}`, entry.cell) ?? emptyCell(),
      })),
    shareholding: gate.rows("profile.shareholding", rawProfile.shareholding),
  };

  const quarterly = {
    ...rawQuarterly,
    rows: (rawQuarterly.rows ?? [])
      .filter((row) => row.metric?.trim())
      .map((row) => {
        const current = gate.value(`quarterly.${row.metric}.current`, row.current);
        const priorYear = gate.value(`quarterly.${row.metric}.priorYear`, row.priorYear);
        const previousQuarter = gate.value(`quarterly.${row.metric}.previousQuarter`, row.previousQuarter);
        return {
          metric: row.metric,
          current: current ?? emptyCell(),
          priorYear: priorYear ?? emptyCell(),
          yoy:
            gate.derived(
              `quarterly.${row.metric}.yoy`,
              current,
              priorYear,
              gate.value(`quarterly.${row.metric}.yoy`, row.yoy),
            ) ?? emptyCell(),
          previousQuarter: previousQuarter ?? emptyCell(),
          qoq:
            gate.derived(
              `quarterly.${row.metric}.qoq`,
              current,
              previousQuarter,
              gate.value(`quarterly.${row.metric}.qoq`, row.qoq),
            ) ?? emptyCell(),
        };
      })
      .filter((row) => row.current.value || row.priorYear.value || row.previousQuarter.value),
  };

  const statements = {
    ...rawStatements,
    profitAndLoss: gate.rows("statements.profitAndLoss", rawStatements.profitAndLoss),
    balanceSheet: gate.rows("statements.balanceSheet", rawStatements.balanceSheet),
    cashflow: gate.rows("statements.cashflow", rawStatements.cashflow),
    ratios: gate.rows("statements.ratios", rawStatements.ratios),
    segments: gate.rows("statements.segments", rawStatements.segments),
  };

  const charts: Charts = {
    charts: (rawCharts.charts ?? [])
      .map((chart) => ({
        ...chart,
        bars: (chart.bars ?? []).filter((point, index) =>
          gate.chartPoint(`charts.${chart.title}.bar[${index}]`, point),
        ),
        line: (chart.line ?? []).filter((point, index) =>
          gate.chartPoint(`charts.${chart.title}.line[${index}]`, point),
        ),
      }))
      .filter((chart) => chart.bars.length >= 2)
      .slice(0, 4),
    guidance: compact(rawCharts.guidance?.map((item, index) => gate.text(`charts.guidance[${index}]`, item))),
  };

  if (!profile.highlights.length && !profile.keyHighlights.length && !quarterly.rows.length) {
    throw new Error(
      "Nothing in the model's output could be verified against the uploaded document. " +
        "Check that the file is the company filing you intended to upload.",
    );
  }

  const report: ResearchReport = {
    companyName,
    sourceFile: document.fileName,
    generatedAt: new Date().toISOString(),
    profile,
    quarterly,
    statements,
    charts,
    sources: collectSources(profile, quarterly, statements, charts),
  };

  const trace: RunTrace = {
    startedAt,
    finishedAt: new Date().toISOString(),
    demoMode: false,
    provider: "Google Gemini",
    model: config.geminiModel,
    thinkingLevel: config.geminiThinkingLevel,
    sourceFile: document.fileName,
    sourcePages: document.pages.length,
    sourceCharacters: document.transcript.length,
    passes,
    failedPasses,
    totals: {
      promptTokens: passes.reduce((sum, pass) => sum + pass.promptTokens, 0),
      outputTokens: passes.reduce((sum, pass) => sum + pass.outputTokens, 0),
      thoughtTokens: passes.reduce((sum, pass) => sum + pass.thoughtTokens, 0),
      cachedTokens: passes.reduce((sum, pass) => sum + pass.cachedTokens, 0),
      durationMs: Date.now() - start,
    },
    reconciliation: {
      valuesAccepted: gate.accepted,
      valuesRejected: gate.rejections.length,
      quotesRepaired: gate.quotesRepaired,
      pagesCorrected: gate.pagesCorrected,
      rejections: gate.rejections,
    },
    output: {
      highlights: profile.highlights.length,
      keyHighlights: profile.keyHighlights.length,
      quarterlyRows: quarterly.rows.length,
      profitAndLossRows: statements.profitAndLoss.length,
      balanceSheetRows: statements.balanceSheet.length,
      cashflowRows: statements.cashflow.length,
      ratioRows: statements.ratios.length,
      segmentRows: statements.segments.length,
      shareholdingRows: profile.shareholding.length,
      companyDataRows: profile.companyData.filter((entry) => entry.cell.value).length,
      charts: charts.charts.length,
      chartPoints: charts.charts.reduce((sum, chart) => sum + chart.bars.length + chart.line.length, 0),
      sources: report.sources.length,
    },
  };

  return { report, trace };
}

const emptyCell = (): Cited => ({ value: null, page: null, quote: null });

function compact<T>(items: Array<T | null> | undefined): T[] {
  return (items ?? []).filter((item): item is T => item !== null);
}

function collectSources(
  profile: VerifiedProfile,
  quarterly: ResearchReport["quarterly"],
  statements: ResearchReport["statements"],
  charts: Charts,
) {
  const seen = new Map<string, { page: number; quote: string }>();
  const add = (page: number | null, quote: string | null) => {
    if (!page || !quote) return;
    const trimmed = quote.replace(/\s+/g, " ").trim();
    // A reconstructed table row and the same row read as prose differ only by
    // their separators, so they are deduplicated on the underlying characters.
    const key = `${page}::${trimmed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 90)}`;
    if (!seen.has(key)) seen.set(key, { page, quote: trimmed });
  };

  add(profile.description.page, profile.description.quote);
  for (const item of [...profile.highlights, ...profile.keyHighlights, ...charts.guidance]) add(item.page, item.quote);
  if (profile.outlook) add(profile.outlook.page, profile.outlook.quote);
  for (const entry of profile.companyData) add(entry.cell.page, entry.cell.quote);
  for (const row of quarterly.rows) {
    for (const cell of [row.current, row.priorYear, row.previousQuarter]) add(cell.page, cell.quote);
  }
  for (const table of [
    statements.profitAndLoss,
    statements.balanceSheet,
    statements.cashflow,
    statements.ratios,
    statements.segments,
    profile.shareholding,
  ]) {
    for (const row of table) for (const entry of row.values) add(entry.cell.page, entry.cell.quote);
  }

  return [...seen.values()].sort((a, b) => a.page - b.page);
}
