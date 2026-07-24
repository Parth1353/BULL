import { describe, expect, it } from "vitest";
import { buildDemoReport } from "@/lib/demo-report";
import { evidenceIsPresent, valueIsSupported } from "@/lib/reconcile";
import { reportSchema } from "@/lib/report-schema";

const pages = [{ page: 1, text: "Revenue at Rs. 29,795 million; growth of 15.8% YoY and 4.0% QoQ.", tableCandidates: [] }];

describe("source evidence reconciliation", () => {
  it("accepts exact evidence and a number present in the cited source", () => {
    const evidence = { page: 1, quote: "Revenue at Rs. 29,795 million" };
    expect(evidenceIsPresent(evidence, pages)).toBe(true);
    expect(valueIsSupported({ value: "29,795", evidence, derived: false }, pages)).toBe(true);
  });

  it("rejects fabricated numeric values", () => {
    const evidence = { page: 1, quote: "Revenue at Rs. 29,795 million" };
    expect(valueIsSupported({ value: "99,999", evidence, derived: false }, pages)).toBe(false);
  });

  it("builds a report that respects the public report schema", () => {
    const report = buildDemoReport("LTTS");
    expect(report.charts).toHaveLength(3);
    expect(report.rating).toBe("Not rated");
  });

  it("requires evidence for optional line-chart points", () => {
    const report = buildDemoReport("LTTS");
    report.charts[0].line = [{ label: "Q2 FY25", value: 12.5, evidence: report.charts[0].bars[0].evidence }];
    report.charts[0].lineLabel = "Margin %";
    expect(reportSchema.parse(report).charts[0].line?.[0].evidence.page).toBeGreaterThan(0);
  });
});
