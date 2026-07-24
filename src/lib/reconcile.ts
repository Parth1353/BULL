import { reportSchema, type Evidence, type EvidenceValue, type ResearchReport } from "@/lib/report-schema";
import type { SourcePage } from "@/lib/document-parser";

const normalise = (input: string) => input.toLowerCase().replace(/[₹$€£,\s]/g, "").replace(/[()]/g, "-");
const digits = (input: string) => input.replace(/[^0-9.-]/g, "");
const sourceFor = (evidence: Evidence, pages: SourcePage[]) => pages.find((page) => page.page === evidence.page)?.text ?? "";

export function evidenceIsPresent(evidence: Evidence, pages: SourcePage[]) {
  const source = normalise(sourceFor(evidence, pages));
  return source.includes(normalise(evidence.quote));
}

export function valueIsSupported(value: EvidenceValue, pages: SourcePage[]) {
  const source = sourceFor(value.evidence, pages);
  const numeric = digits(value.value);
  return evidenceIsPresent(value.evidence, pages) && (!numeric || normalise(source).includes(numeric.replace("-", "")) || normalise(value.evidence.quote).includes(numeric.replace("-", "")));
}

const validValue = (value: EvidenceValue | undefined, pages: SourcePage[]) => value && valueIsSupported(value, pages) ? value : undefined;

export function reconcileReport(candidate: ResearchReport, pages: SourcePage[]): ResearchReport {
  const reconciled: ResearchReport = {
    ...candidate,
    companyData: candidate.companyData.map((entry) => ({ ...entry, value: validValue(entry.value, pages) })),
    quarterlyFinancials: candidate.quarterlyFinancials.map((metric) => ({ ...metric, current: validValue(metric.current, pages), priorYear: validValue(metric.priorYear, pages), previousQuarter: validValue(metric.previousQuarter, pages), yoy: validValue(metric.yoy, pages), qoq: validValue(metric.qoq, pages) })),
    annualFinancials: candidate.annualFinancials.map((row) => ({ ...row, values: row.values.map((cell) => ({ ...cell, value: validValue(cell.value, pages) })) })),
    balanceSheet: candidate.balanceSheet.map((row) => ({ ...row, values: row.values.map((cell) => ({ ...cell, value: validValue(cell.value, pages) })) })),
    cashflow: candidate.cashflow.map((row) => ({ ...row, values: row.values.map((cell) => ({ ...cell, value: validValue(cell.value, pages) })) })),
    ratios: candidate.ratios.map((row) => ({ ...row, values: row.values.map((cell) => ({ ...cell, value: validValue(cell.value, pages) })) })),
    charts: candidate.charts.map((chart) => ({
      ...chart,
      bars: chart.bars.filter((bar) => evidenceIsPresent(bar.evidence, pages) && normalise(sourceFor(bar.evidence, pages)).includes(digits(String(bar.value)).replace("-", ""))),
      line: chart.line?.filter((point) => evidenceIsPresent(point.evidence, pages) && normalise(sourceFor(point.evidence, pages)).includes(digits(String(point.value)).replace("-", ""))),
    })).filter((chart) => chart.bars.length >= 2),
    highlights: candidate.highlights.filter((item) => evidenceIsPresent(item.evidence, pages)),
    sources: candidate.sources.filter((item) => evidenceIsPresent(item, pages)),
  };
  if (!evidenceIsPresent(reconciled.companyDescription.evidence, pages) || !evidenceIsPresent(reconciled.outlook.evidence, pages)) throw new Error("The model returned narrative without verifiable source evidence.");
  if (reconciled.highlights.length < 2) throw new Error("The model returned fewer than two verifiable highlights.");
  if (!reconciled.charts.length) throw new Error("The model returned no verifiable chart data.");
  return reportSchema.parse(reconciled);
}
