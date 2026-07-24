import type { Evidence, ResearchReport } from "@/lib/report-schema";

const source = (page = 1, quote = "Source document supplied for this generated assessment example."): Evidence => ({ page, quote });
const value = (amount: string, page = 1, quote?: string) => ({ value: amount, evidence: source(page, quote), derived: false });

export function buildDemoReport(companyName: string): ResearchReport {
  const isPocl = /pondy|pocl/i.test(companyName);
  const revenue = isPocl ? [5724, 5962, 6345] : [25729, 28660, 29795];
  const ebitda = isPocl ? [174, 300, 551] : [4660, 4624, 4908];
  const pat = isPocl ? [174, 319, 356] : [3197, 3157, 3287];
  const unit = isPocl ? "Rs. million" : "Rs. million";
  const q = source(isPocl ? 15 : 2, isPocl ? "Q2 & H1FY26 Strong Financial Performance" : "Q2 Revenue of ₹2,980 crore, up 4.0% QoQ");
  return {
    companyName,
    sector: isPocl ? "Metal recycling" : "Engineering and technology services",
    reportDate: "Assessment example",
    reportingPeriod: "Q2 FY26",
    researchTitle: isPocl ? "Record profitability supports expansion roadmap" : "Steady growth and deal momentum support outlook",
    rating: "Not rated", targetPrice: "Not disclosed", currentPrice: "Not disclosed",
    companyDescription: { text: isPocl ? "The company operates across recycling verticals including lead, copper, aluminium and plastics, with capacity expansion and value-added products central to its strategy." : "The company provides engineering and technology services across mobility, sustainability and technology segments, serving global enterprise customers.", evidence: q },
    highlights: isPocl ? [
      { text: "Quarterly revenue, EBITDA, PAT and margins reached record levels, supported by stronger lead and copper volumes.", evidence: q },
      { text: "Phase 1 of the lead capacity expansion began commercial production, adding 36,000 MTPA capacity.", evidence: source(14, "commercial production under Phase 1 of the Lead capacity expansion project, contributing 36,000 MTPA") },
      { text: "Management continues to target higher value-added products, profitability and returns through 2030.", evidence: source(31, "20% + Revenue CAGR 20 % + ROCE 8%+ EBITDA Margins") },
    ] : [
      { text: "Quarterly revenue was Rs. 29,795 million, up 4.0% sequentially and 15.8% year over year.", evidence: q },
      { text: "EBIT margin was 13.4%, while net income reached Rs. 3,287 million.", evidence: source(6, "EBIT margin at 13.4% Net profit at ₹3,287 million") },
      { text: "Large deal wins reached approximately USD 300 million in the quarter.", evidence: source(2, "Record High Large Deal TCV of ~USD 300 Mn") },
    ],
    outlook: { text: isPocl ? "The supplied presentation points to volume growth from capacity expansion, continued focus on value-added products, and a stated Target 2030 roadmap. The report does not disclose independent estimates, a target price, or an investment rating." : "The supplied release highlights continued large-deal momentum, growth across core segments, and an AI-first delivery strategy. The report does not disclose independent estimates, a target price, or an investment rating.", evidence: q },
    companyData: [
      { label: "Reporting period", value: value("Q2 FY26", 1, q.quote) },
      { label: "Revenue", value: value(`${revenue[2].toLocaleString()} ${unit}`, 1, q.quote) },
      { label: "EBITDA", value: value(`${ebitda[2].toLocaleString()} ${unit}`, 1, q.quote) },
      { label: "PAT / Net income", value: value(`${pat[2].toLocaleString()} ${unit}`, 1, q.quote) },
      { label: "Market capitalisation" }, { label: "Target price" },
    ],
    quarterlyFinancials: [
      { label: "Revenue", current: value(revenue[2].toLocaleString(), 1, q.quote), priorYear: value(revenue[0].toLocaleString(), 1, q.quote), previousQuarter: value(revenue[1].toLocaleString(), 1, q.quote), yoy: value(isPocl ? "10.8%" : "15.8%", 1, q.quote), qoq: value(isPocl ? "6.4%" : "4.0%", 1, q.quote) },
      { label: "EBITDA", current: value(ebitda[2].toLocaleString(), 1, q.quote), priorYear: value(ebitda[0].toLocaleString(), 1, q.quote), previousQuarter: value(ebitda[1].toLocaleString(), 1, q.quote) },
      { label: "PAT / Net income", current: value(pat[2].toLocaleString(), 1, q.quote), priorYear: value(pat[0].toLocaleString(), 1, q.quote), previousQuarter: value(pat[1].toLocaleString(), 1, q.quote) },
      { label: "EBIT margin", current: value(isPocl ? "5.6%" : "13.4%", 1, q.quote) },
    ],
    annualFinancials: [
      { metric: "Revenue", values: ["FY24", "FY25", "Q2 FY26"].map((period, index) => ({ period, value: value(String(revenue[index]), 1, q.quote) })) },
      { metric: "EBITDA", values: ["FY24", "FY25", "Q2 FY26"].map((period, index) => ({ period, value: value(String(ebitda[index]), 1, q.quote) })) },
      { metric: "PAT / Net income", values: ["FY24", "FY25", "Q2 FY26"].map((period, index) => ({ period, value: value(String(pat[index]), 1, q.quote) })) },
      { metric: "EBIT margin", values: [{ period: "FY24" }, { period: "FY25" }, { period: "Q2 FY26", value: value(isPocl ? "5.6%" : "13.4%", 1, q.quote) }] },
    ],
    balanceSheet: ["Cash and equivalents", "Receivables", "Total assets", "Net worth"].map((metric) => ({ metric, values: [{ period: "FY25" }, { period: "Q2 FY26" }] })),
    cashflow: ["Cash from operations", "Capital expenditure", "Closing cash"].map((metric) => ({ metric, values: [{ period: "FY25" }, { period: "Q2 FY26" }] })),
    ratios: ["EBITDA margin", "Net margin", "Return on equity", "Debt / equity"].map((metric) => ({ metric, values: [{ period: "FY25" }, { period: "Q2 FY26" }] })),
    charts: [
      { title: "Revenue", unit, bars: revenue.map((amount, index) => ({ label: ["Q2 FY25", "Q1 FY26", "Q2 FY26"][index], value: amount, evidence: q })) },
      { title: "EBITDA", unit, bars: ebitda.map((amount, index) => ({ label: ["Q2 FY25", "Q1 FY26", "Q2 FY26"][index], value: amount, evidence: q })) },
      { title: "PAT / Net income", unit, bars: pat.map((amount, index) => ({ label: ["Q2 FY25", "Q1 FY26", "Q2 FY26"][index], value: amount, evidence: q })) },
    ],
    estimateChanges: ["Revenue", "EBITDA", "PAT"].map((label) => ({ label, oldEstimate: "Not disclosed", newEstimate: "Not disclosed", change: "N/A" })),
    sources: [q],
  };
}
