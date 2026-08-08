import { z } from "zod";

/**
 * Every schema here is written for constrained JSON decoding, so it obeys two
 * rules: no string length constraints (outside the keyword subset Gemini's
 * `responseJsonSchema` supports — see `src/lib/json-schema.ts`), and no
 * `.optional()` — a field that may be absent is `.nullable()` instead. That
 * forces the model to say "null" rather than quietly omit a key, which is
 * exactly the signal the reconciler needs to mark a field as not disclosed.
 */

/** A single fact plus the source location that backs it. */
export const citedSchema = z.object({
  value: z.string().nullable().describe("The figure or phrase exactly as the source states it, including its unit. null if the source does not disclose it."),
  page: z.number().int().nullable().describe("1-based page number of the source page this came from. null if not disclosed."),
  quote: z.string().nullable().describe("A short contiguous excerpt copied verbatim from that page containing this value. null if not disclosed."),
});
export type Cited = z.infer<typeof citedSchema>;

export const citedTextSchema = z.object({
  text: z.string(),
  page: z.number().int().nullable(),
  quote: z.string().nullable(),
});
export type CitedText = z.infer<typeof citedTextSchema>;

export const labelledRowSchema = z.object({
  label: z.string(),
  values: z.array(z.object({ period: z.string(), cell: citedSchema })),
});
export type LabelledRow = z.infer<typeof labelledRowSchema>;

// ---------------------------------------------------------------- pass 1
export const profileSchema = z.object({
  sector: z.string().nullable(),
  reportingPeriod: z.string().describe("The period this document reports on, e.g. 'Q2 FY26'."),
  reportDate: z.string().nullable().describe("Publication or results date stated in the document."),
  documentType: z.string().nullable().describe("e.g. 'Quarterly results presentation', 'Press release'."),
  headline: z.string().describe("A short factual headline for this report, under 80 characters, drawn only from what the document says."),
  description: citedTextSchema.describe("Two to four sentences describing what the company does, from the document."),
  highlights: z.array(citedTextSchema).describe("3 to 5 short result highlights for the front page. One sentence each."),
  keyHighlights: z.array(citedTextSchema).describe("4 to 6 longer highlights covering segments, operations, capacity and strategy."),
  outlook: citedTextSchema.describe("What the document says about outlook, guidance or strategy. State plainly if it discloses no forward guidance."),
  companyData: z
    .array(z.object({ label: z.string(), cell: citedSchema }))
    .describe("Company/stock reference data disclosed in the document (market cap, shares outstanding, listing codes, credit rating, employee count, plant capacity...). Use null cells for anything not disclosed rather than omitting the row."),
  shareholdingPeriods: z.array(z.string()).describe("Column labels for the shareholding table, oldest first. Empty array if not disclosed."),
  shareholding: z.array(labelledRowSchema).describe("Shareholding pattern rows. Empty array if the document does not disclose it."),
});
export type Profile = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------- pass 2
export const quarterlySchema = z.object({
  unit: z.string().describe("Reporting unit for this table exactly as the document states it, e.g. 'Rs. mn' or 'Rs. cr'."),
  currentLabel: z.string().describe("Label of the quarter being reported, e.g. 'Q2FY26'."),
  priorYearLabel: z.string().nullable().describe("Label of the same quarter a year earlier, e.g. 'Q2FY25'."),
  previousQuarterLabel: z.string().nullable().describe("Label of the immediately preceding quarter, e.g. 'Q1FY26'."),
  rows: z
    .array(
      z.object({
        metric: z.string(),
        current: citedSchema,
        priorYear: citedSchema,
        yoy: citedSchema.describe("Year-on-year change, only if the document states it."),
        previousQuarter: citedSchema,
        qoq: citedSchema.describe("Quarter-on-quarter change, only if the document states it."),
      }),
    )
    .describe("Income-statement lines for the quarter: revenue, EBITDA, margin, EBIT, PBT, PAT, EPS and similar."),
});
export type Quarterly = z.infer<typeof quarterlySchema>;

// ---------------------------------------------------------------- pass 3
const statementSchema = z.array(labelledRowSchema);

export const statementsSchema = z.object({
  unit: z.string(),
  periods: z.array(z.string()).describe("Period column labels shared by these statements, oldest first."),
  profitAndLoss: statementSchema,
  balanceSheet: statementSchema,
  cashflow: statementSchema,
  ratios: statementSchema,
  segments: statementSchema.describe("Segment or business-line revenue/margin breakdown if the document discloses one."),
  segmentPeriods: z.array(z.string()),
});
export type Statements = z.infer<typeof statementsSchema>;

// ---------------------------------------------------------------- pass 4
export const chartPointSchema = z.object({
  label: z.string().describe("Period label for this point, e.g. 'Q2FY25'."),
  value: z.number(),
  page: z.number().int().nullable(),
  quote: z.string().nullable(),
});

export const chartsSchema = z.object({
  charts: z
    .array(
      z.object({
        title: z.string(),
        unit: z.string(),
        bars: z.array(chartPointSchema).describe("At least two periods of the same measure, oldest first."),
        lineLabel: z.string().nullable().describe("Label for the secondary line series, e.g. 'Margin (%)'. null when there is no line."),
        line: z.array(chartPointSchema).describe("Optional secondary series plotted on a right-hand axis, aligned to the same period labels. Empty array when absent."),
      }),
    )
    .describe("2 to 4 time series the document actually discloses, e.g. revenue, EBITDA, PAT, volumes."),
  guidance: z
    .array(citedTextSchema)
    .describe("Forward-looking targets the document itself discloses (capacity plans, stated goals). Empty array if none."),
});
export type Charts = z.infer<typeof chartsSchema>;

// ---------------------------------------------------------------- assembled
/**
 * The shape after reconciliation. It differs from the model-facing schemas in
 * one way: `outlook` can be absent entirely, because a passage whose figures
 * do not appear in the source is removed rather than printed.
 */
export type VerifiedProfile = Omit<Profile, "outlook"> & { outlook: CitedText | null };

export type ResearchReport = {
  companyName: string;
  sourceFile: string;
  generatedAt: string;
  profile: VerifiedProfile;
  quarterly: Quarterly;
  statements: Statements;
  charts: Charts;
  sources: Array<{ page: number; quote: string }>;
};

export const displayValue = (cell: Cited | null | undefined) =>
  cell && cell.value ? cell.value : "Not disclosed";

export const hasValue = (cell: Cited | null | undefined): cell is Cited & { value: string } =>
  Boolean(cell && cell.value);
