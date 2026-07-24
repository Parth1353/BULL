import { GoogleGenAI } from "@google/genai";
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
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({ model, contents: input, config: { responseMimeType: "application/json", temperature: 0.1 } });
  if (!response.text) throw new Error("Gemini returned an empty response.");
  return response.text;
}

export async function extractReport(companyName: string, document: ParsedDocument): Promise<ResearchReport> {
  if (config.demoMode) return buildDemoReport(companyName);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing. Add it to .env.local or enable DEMO_MODE.");
  const input = prompt(companyName, document);
  let raw: string;
  try { raw = await callModel(config.geminiModel, input, apiKey); }
  catch (primaryError) {
    try { raw = await callModel(config.geminiFallbackModel, input, apiKey); }
    catch { throw new Error(`Gemini generation failed: ${primaryError instanceof Error ? primaryError.message : "unknown error"}`); }
  }
  const candidate = reportSchema.parse(JSON.parse(stripFence(raw)));
  return reconcileReport(candidate, document.pages);
}
