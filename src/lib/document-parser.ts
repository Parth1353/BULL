import { readFile } from "node:fs/promises";
import path from "node:path";

export type SourcePage = {
  page: number;
  /** Reading-order text of the page. */
  text: string;
  /** Rows reconstructed from the page's layout, e.g. "Revenue | 29,795 | 25,729". */
  rows: string[];
  /** text + rows, normalised once, used by the evidence reconciler. */
  searchText: string;
};

export type ParsedDocument = {
  fileName: string;
  pages: SourcePage[];
  /** Page-tagged transcript handed to the model. */
  transcript: string;
};

const supportedExtensions = new Set([".pdf", ".csv", ".txt"]);

export const isSupportedFile = (name: string) =>
  supportedExtensions.has(path.extname(name).toLowerCase());

/**
 * Collapse a string to the form used for every evidence comparison: lowercase,
 * no currency symbols, no thousands separators, no whitespace, and accounting
 * negatives — (1,234) — rewritten as -1234. Two strings that mean the same
 * number compare equal after this.
 */
export function normalise(input: string) {
  return input
    .toLowerCase()
    .replace(/\(([\d.,]+)\)/g, "-$1")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’“”]/g, "'")
    .replace(/[₹$€£,\s]/g, "");
}

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

type TextItem = { str: string; transform: number[]; width?: number };

/**
 * Group a page's text items into visual rows by their baseline, then order each
 * row left to right. Financial PDFs put table cells in arbitrary draw order, so
 * without this step a table reads as scrambled prose and its numbers can no
 * longer be tied back to their row label.
 */
export function buildRows(items: TextItem[]) {
  const buckets = new Map<number, Array<{ x: number; end: number; text: string }>>();
  for (const item of items) {
    const text = item.str.replace(/\s+/g, " ").trim();
    if (!text) continue;
    // 2.5pt buckets keep sub- and superscripts on the line they belong to.
    const y = Math.round(item.transform[5] / 2.5) * 2.5;
    const x = item.transform[4];
    // pdf.js reports the advance width; estimate it when a caller omits it.
    const width = item.width ?? text.length * 3.6;
    const bucket = buckets.get(y) ?? [];
    bucket.push({ x, end: x + width, text });
    buckets.set(y, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, cells]) => {
      const ordered = cells.sort((a, b) => a.x - b.x);
      const parts: string[] = [];
      let previousEnd = Number.NEGATIVE_INFINITY;
      for (const cell of ordered) {
        // Measure the gap from where the previous run of text ended. A wide gap
        // is a column boundary; a narrow one is just the space between words.
        if (parts.length && cell.x - previousEnd > 6) parts.push("|");
        parts.push(cell.text);
        previousEnd = cell.end;
      }
      return parts.join(" ").replace(/\s*\|\s*/g, " | ").trim();
    })
    .filter((row) => row.length > 1);
}

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const bytes = new Uint8Array(await readFile(filePath));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true, isEvalSupported: false } as never).promise;

  const pages: SourcePage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.filter(
      (item: unknown) => typeof (item as { str?: unknown }).str === "string",
    ) as TextItem[];
    const rows = buildRows(items);
    const text = rows.map((row) => row.replace(/ \| /g, "  ")).join("\n");
    pages.push({ page: pageNumber, text, rows, searchText: normalise(`${text}\n${rows.join("\n")}`) });
    page.cleanup();
  }
  await pdf.destroy();

  return { fileName: path.basename(filePath), pages, transcript: buildTranscript(pages) };
}

async function parseTextOrCsv(filePath: string): Promise<ParsedDocument> {
  const raw = await readFile(filePath, "utf8");
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const rows = lines
    .filter((line) => line.includes(",") || line.includes("\t"))
    .map((line) => line.split(/[,\t]/).map((cell) => cell.trim()).join(" | "));

  // Paginate long text sources so evidence still carries a usable locator.
  const pageSize = 120;
  const pages: SourcePage[] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    const slice = lines.slice(index, index + pageSize);
    const sliceText = slice.join("\n");
    const sliceRows = slice
      .filter((line) => line.includes(",") || line.includes("\t"))
      .map((line) => line.split(/[,\t]/).map((cell) => cell.trim()).join(" | "));
    pages.push({
      page: pages.length + 1,
      text: sliceText,
      rows: sliceRows,
      searchText: normalise(`${sliceText}\n${sliceRows.join("\n")}`),
    });
  }
  if (!pages.length) {
    pages.push({ page: 1, text, rows, searchText: normalise(text) });
  }

  return { fileName: path.basename(filePath), pages, transcript: buildTranscript(pages) };
}

function buildTranscript(pages: SourcePage[]) {
  return pages
    .map((page) => {
      const tables = page.rows.filter((row) => row.includes("|") && /\d/.test(row));
      const tableBlock = tables.length ? `\n--- reconstructed table rows ---\n${tables.join("\n")}` : "";
      return `===== PAGE ${page.page} =====\n${page.text}${tableBlock}`;
    })
    .join("\n\n");
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.has(ext)) throw new Error("Only PDF, CSV, and TXT files are supported.");
  const parsed = ext === ".pdf" ? await parsePdf(filePath) : await parseTextOrCsv(filePath);
  if (!parsed.pages.some((page) => page.text.trim().length > 40)) {
    throw new Error(
      "No machine-readable text was found in this document. Scanned or image-only PDFs are not supported.",
    );
  }
  return parsed;
}
