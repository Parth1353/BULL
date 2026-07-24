import { readFile } from "node:fs/promises";
import path from "node:path";

export type SourcePage = { page: number; text: string; tableCandidates: string[] };
export type ParsedDocument = { pages: SourcePage[]; plainText: string };

const supportedExtensions = new Set([".pdf", ".csv", ".txt"]);
export const isSupportedFile = (name: string) => supportedExtensions.has(path.extname(name).toLowerCase());

export function validateUploadContent(name: string, bytes: Uint8Array) {
  const extension = path.extname(name).toLowerCase();
  if (!isSupportedFile(name)) throw new Error("Only PDF, CSV, and TXT files are supported.");
  if (extension === ".pdf") {
    const signature = String.fromCharCode(...bytes.slice(0, 5));
    if (signature !== "%PDF-") throw new Error("The uploaded PDF does not have a valid PDF signature.");
    return;
  }
  if (bytes.includes(0)) throw new Error("CSV and TXT uploads must be plain text, not binary files.");
  const preview = new TextDecoder().decode(bytes.slice(0, 4096)).trim();
  if (!preview) throw new Error("The uploaded CSV or TXT file is empty.");
}

export function buildTableCandidates(items: Array<{ str: string; transform: number[] }>) {
  const lines = new Map<number, Array<{ x: number; text: string }>>();
  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    const row = lines.get(y) ?? [];
    row.push({ x: item.transform[4], text }); lines.set(y, row);
  }
  const rows = [...lines.entries()].sort(([a], [b]) => b - a).map(([, row]) => row.sort((a, b) => a.x - b.x).map((cell) => cell.text).join(" | "));
  return rows.filter((row) => row.split("|").length >= 3 && /\d/.test(row)).slice(0, 80);
}

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const bytes = new Uint8Array(await readFile(filePath));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true } as never).promise;
  const pages: SourcePage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.filter((item: unknown) => typeof (item as { str?: unknown }).str === "string") as Array<{ str: string; transform: number[] }>;
    const text = items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    pages.push({ page: pageNumber, text, tableCandidates: buildTableCandidates(items) });
  }
  return { pages, plainText: pages.map((page) => `[Page ${page.page}]\n${page.text}\n${page.tableCandidates.join("\n")}`).join("\n\n") };
}

async function parseTextOrCsv(filePath: string): Promise<ParsedDocument> {
  const raw = await readFile(filePath, "utf8");
  const text = raw.replace(/\r\n/g, "\n").trim();
  const rows = text.split("\n").filter((line) => line.includes(",") || line.includes("\t")).slice(0, 80);
  return { pages: [{ page: 1, text, tableCandidates: rows }], plainText: `[Page 1]\n${text}` };
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.has(ext)) throw new Error("Only PDF, CSV, and TXT files are supported.");
  return ext === ".pdf" ? parsePdf(filePath) : parseTextOrCsv(filePath);
}
