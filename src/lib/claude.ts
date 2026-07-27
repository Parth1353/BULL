import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import type { ParsedDocument } from "@/lib/document-parser";
import { reportSchema, type ResearchReport } from "@/lib/report-schema";
import { reconcileReport } from "@/lib/reconcile";
import { buildDemoReport } from "@/lib/demo-report";

const stripFence = (text: string) => text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

function prompt(companyName: string, document: ParsedDocument) {
  return `You are extracting facts from a public company filing for a research-report template. Return only valid JSON. Never create a number, market value, forecast, price, rating, or fact that is absent from the source. Use "Not disclosed" for text fields that lack data and omit unavailable metric values. Every factual field needs evidence: {page:number,quote:string} where quote is an exact contiguous excerpt from that page. Use at most 6 highlights and compact values that fit a four-page report. Use financial figures as reported, including their stated units. Do not provide investment advice.\n\nCompany name: ${companyName}\n\nRequired JSON shape:\n${JSON.stringify({ companyName, sector: "string", reportDate: "string", reportingPeriod: "string", researchTitle: "string", rating: "Not rated", targetPrice: "Not disclosed", currentPrice: "Not disclosed", companyDescription: { text: "string", evidence: { page: 1, quote: "exact source" } }, highlights: [{ text: "string", evidence: { page: 1, quote: "exact source" } }], outlook: { text: "string", evidence: { page: 1, quote: "exact source" } }, companyData: [{ label: "string", value: { value: "string", evidence: { page: 1, quote: "exact source" } } }], quarterlyFinancials: [{ label: "Revenue", current: { value: "string", evidence: { page: 1, quote: "exact source" } } }], annualFinancials: [{ metric: "Revenue", values: [{ period: "FY25", value: { value: "string", evidence: { page: 1, quote: "exact source" } } }, { period: "Q2 FY26" }]}], balanceSheet: [], cashflow: [], ratios: [], charts: [{ title: "Revenue", unit: "reported unit", bars: [{ label: "Q2 FY25", value: 1, evidence: { page: 1, quote: "exact source" } }, { label: "Q2 FY26", value: 2, evidence: { page: 1, quote: "exact source" } }]}], estimateChanges: [], sources: [{ page: 1, quote: "exact source" }] }, null, 2)}\n\nSource pages (including reconstructed table candidates):\n${document.plainText.slice(0, 180000)}`;
}

async function callModel(model: string, input: string, apiKey: string) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 16384,
    temperature: 0.1,
    system: "You are a financial data extraction assistant. You MUST respond with valid JSON only. No prose, no markdown fences, no explanation — just the raw JSON object.",
    messages: [{ role: "user", content: input }],
  });
  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  if (!text) throw new Error("Claude returned an empty response.");
  return text;
}

async function extractCandidate(model: string, input: string, apiKey: string) {
  const raw = await callModel(model, input, apiKey);
  return reportSchema.parse(JSON.parse(stripFence(raw)));
}

export async function extractReport(companyName: string, document: ParsedDocument): Promise<ResearchReport> {
  if (config.demoMode) return buildDemoReport(companyName);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing. Add it to .env.local or enable DEMO_MODE.");
  const input = prompt(companyName, document);
  let candidate: ResearchReport;
  try { candidate = await extractCandidate(config.claudeModel, input, apiKey); }
  catch (primaryError) {
    try { candidate = await extractCandidate(config.claudeFallbackModel, input, apiKey); }
    catch { throw new Error(`Claude generation failed: ${primaryError instanceof Error ? primaryError.message : "unknown error"}`); }
  }
  return reconcileReport(candidate, document.pages);
}
