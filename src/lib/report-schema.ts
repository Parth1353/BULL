import { z } from "zod";

export const evidenceSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string().min(2).max(700),
});

export const evidenceValueSchema = z.object({
  value: z.string().min(1).max(80),
  evidence: evidenceSchema,
  derived: z.boolean().default(false),
});

export const financialMetricSchema = z.object({
  label: z.string().min(1).max(60),
  current: evidenceValueSchema.optional(),
  priorYear: evidenceValueSchema.optional(),
  previousQuarter: evidenceValueSchema.optional(),
  yoy: evidenceValueSchema.optional(),
  qoq: evidenceValueSchema.optional(),
});

export const chartSchema = z.object({
  title: z.string().min(1).max(42),
  unit: z.string().min(1).max(32),
  bars: z.array(z.object({
    label: z.string().min(1).max(16),
    value: z.number(),
    evidence: evidenceSchema,
  })).min(2).max(8),
  line: z.array(z.object({
    label: z.string().min(1).max(16),
    value: z.number(),
    evidence: evidenceSchema,
  })).max(8).optional(),
  lineLabel: z.string().max(28).optional(),
});

export const reportSchema = z.object({
  companyName: z.string().min(1).max(100),
  sector: z.string().min(1).max(100).default("Not disclosed"),
  reportDate: z.string().min(1).max(40),
  reportingPeriod: z.string().min(1).max(40),
  researchTitle: z.string().min(1).max(100),
  rating: z.string().min(1).max(30).default("Not rated"),
  targetPrice: z.string().min(1).max(40).default("Not disclosed"),
  currentPrice: z.string().min(1).max(40).default("Not disclosed"),
  companyDescription: z.object({ text: z.string().min(1).max(700), evidence: evidenceSchema }),
  highlights: z.array(z.object({ text: z.string().min(1).max(360), evidence: evidenceSchema })).min(2).max(6),
  outlook: z.object({ text: z.string().min(1).max(900), evidence: evidenceSchema }),
  companyData: z.array(z.object({ label: z.string().min(1).max(48), value: evidenceValueSchema.optional() })).max(8),
  quarterlyFinancials: z.array(financialMetricSchema).min(3).max(8),
  annualFinancials: z.array(z.object({
    metric: z.string().min(1).max(60),
    values: z.array(z.object({ period: z.string().min(1).max(16), value: evidenceValueSchema.optional() })).min(2).max(5),
  })).min(3).max(12),
  balanceSheet: z.array(z.object({
    metric: z.string().min(1).max(60),
    values: z.array(z.object({ period: z.string().min(1).max(16), value: evidenceValueSchema.optional() })).min(2).max(5),
  })).max(12),
  cashflow: z.array(z.object({
    metric: z.string().min(1).max(60),
    values: z.array(z.object({ period: z.string().min(1).max(16), value: evidenceValueSchema.optional() })).min(2).max(5),
  })).max(10),
  ratios: z.array(z.object({
    metric: z.string().min(1).max(60),
    values: z.array(z.object({ period: z.string().min(1).max(16), value: evidenceValueSchema.optional() })).min(2).max(5),
  })).max(12),
  charts: z.array(chartSchema).min(1).max(4),
  estimateChanges: z.array(z.object({
    label: z.string().min(1).max(40),
    oldEstimate: z.string().max(40),
    newEstimate: z.string().max(40),
    change: z.string().max(40),
  })).max(5),
  sources: z.array(evidenceSchema).min(1).max(20),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceValue = z.infer<typeof evidenceValueSchema>;
export type FinancialMetric = z.infer<typeof financialMetricSchema>;
export type ResearchReport = z.infer<typeof reportSchema>;

export const unavailable = () => undefined;
export const displayValue = (value?: EvidenceValue) => value?.value ?? "Not disclosed";
