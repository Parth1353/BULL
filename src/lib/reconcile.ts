import { normalise, type SourcePage } from "@/lib/document-parser";
import type { Cited, CitedText, LabelledRow } from "@/lib/report-schema";

/**
 * The anti-fabrication gate.
 *
 * Nothing the model returns reaches the PDF until it has been matched back to
 * the uploaded document. Two things are checked, in order of strength:
 *
 *   1. the evidence quote appears verbatim on a real page, and
 *   2. every meaningful number in the value appears in that quote or on that page.
 *
 * A value whose quote does not match but whose number is provably on the cited
 * page is kept with its quote *replaced* by the real source line — the reader
 * then sees the document's own words rather than a model paraphrase. Anything
 * that fails both checks is dropped and rendered as "Not disclosed".
 */

export type RejectionKind =
  | "quote_not_found"
  | "value_not_in_source"
  | "derived_mismatch"
  | "chart_point_unverified"
  | "empty";

export type Rejection = { field: string; kind: RejectionKind; detail: string };

export class Reconciler {
  readonly rejections: Rejection[] = [];
  /** Values kept after the quote was repaired from the real source line. */
  quotesRepaired = 0;
  /** Values whose model-supplied page number was wrong and got corrected. */
  pagesCorrected = 0;
  accepted = 0;

  constructor(private readonly pages: SourcePage[]) {}

  private reject(field: string, kind: RejectionKind, detail: string) {
    this.rejections.push({ field, kind, detail: detail.slice(0, 160) });
  }

  /** Find the page whose text contains this quote, preferring the cited page. */
  private locateQuote(quote: string, hintedPage: number | null) {
    const needle = normalise(quote);
    if (needle.length < 8) return null;
    const order = hintedPage
      ? [hintedPage, ...this.pages.map((page) => page.page).filter((page) => page !== hintedPage)]
      : this.pages.map((page) => page.page);
    for (const pageNumber of order) {
      const page = this.pages.find((candidate) => candidate.page === pageNumber);
      if (page?.searchText.includes(needle)) return page;
    }
    return null;
  }

  /** Find any page containing all the meaningful numbers of a value. */
  private locateNumbers(tokens: string[], hintedPage: number | null) {
    if (!tokens.length) return null;
    const order = hintedPage
      ? [hintedPage, ...this.pages.map((page) => page.page).filter((page) => page !== hintedPage)]
      : this.pages.map((page) => page.page);
    for (const pageNumber of order) {
      const page = this.pages.find((candidate) => candidate.page === pageNumber);
      if (page && tokens.every((token) => containsNumber(page.searchText, token))) return page;
    }
    return null;
  }

  /** Pull the real source line that carries a number, to replace a bad quote. */
  private sourceLineFor(page: SourcePage, tokens: string[]) {
    const lines = [...page.rows, ...page.text.split("\n")];
    const match = lines.find((line) => {
      const haystack = normalise(line);
      return tokens.every((token) => containsNumber(haystack, token));
    });
    return match?.replace(/\s+/g, " ").trim().slice(0, 300) ?? null;
  }

  /**
   * Verify one cited value. Returns the value with a verified page and quote,
   * or null when the source does not support it.
   */
  value(field: string, cell: Cited | null | undefined): Cited | null {
    if (!cell || !cell.value || !cell.value.trim()) return null;
    const value = cell.value.trim();
    if (/^(n\/?a|nil|none|not disclosed|not available|-|--)$/i.test(value)) return null;

    const tokens = meaningfulNumbers(value);

    // Strong path: the quote is real and carries the number.
    if (cell.quote) {
      const page = this.locateQuote(cell.quote, cell.page);
      if (page) {
        const quoteHaystack = normalise(cell.quote);
        const supported =
          !tokens.length ||
          tokens.every(
            (token) => containsNumber(quoteHaystack, token) || containsNumber(page.searchText, token),
          );
        if (supported) {
          if (cell.page !== page.page) this.pagesCorrected += 1;
          this.accepted += 1;
          return { value, page: page.page, quote: cell.quote.trim() };
        }
        this.reject(field, "value_not_in_source", `"${value}" is not present on page ${page.page}`);
        return null;
      }
    }

    // Repair path: the quote did not match, but the number is provably in the
    // source. Keep the value and swap in the document's own line as evidence.
    const page = this.locateNumbers(tokens, cell.page);
    if (page) {
      const line = this.sourceLineFor(page, tokens);
      if (line) {
        this.quotesRepaired += 1;
        if (cell.page !== page.page) this.pagesCorrected += 1;
        this.accepted += 1;
        return { value, page: page.page, quote: line };
      }
    }

    this.reject(
      field,
      cell.quote ? "quote_not_found" : "value_not_in_source",
      `"${value}"${cell.quote ? ` cited to p${cell.page} but the quote is not on any page` : " has no evidence"}`,
    );
    return null;
  }

  /**
   * Verify narrative prose. The sentences are the model's own summary, so the
   * gate is on the facts inside them: every meaningful number must exist in the
   * document, or the passage is discarded.
   */
  text(field: string, entry: CitedText | null | undefined): CitedText | null {
    if (!entry || !entry.text || entry.text.trim().length < 12) return null;

    // Gate sentence by sentence. A passage is usually several independent
    // claims, and dropping the whole thing because one sentence restated
    // "140K MT" as "140,000 MT" would throw away four good sentences with it.
    const sentences = splitSentences(entry.text.trim());
    const kept: string[] = [];
    const dropped: string[] = [];
    for (const sentence of sentences) {
      const unsupported = meaningfulNumbers(sentence).filter(
        (token) => !this.pages.some((page) => containsNumber(page.searchText, token)),
      );
      if (unsupported.length) dropped.push(unsupported.join(", "));
      else kept.push(sentence);
    }
    if (dropped.length) {
      this.reject(
        field,
        "value_not_in_source",
        `dropped ${dropped.length} of ${sentences.length} sentence(s) citing ${dropped.join("; ")}`,
      );
    }

    const text = kept.join(" ").trim();
    if (text.length < 12) return null;
    const tokens = meaningfulNumbers(text);

    let page = entry.page;
    let quote = entry.quote;
    if (quote) {
      const located = this.locateQuote(quote, entry.page);
      if (located) {
        if (entry.page !== located.page) this.pagesCorrected += 1;
        page = located.page;
      } else if (tokens.length) {
        const numeric = this.locateNumbers(tokens.slice(0, 2), entry.page);
        if (numeric) {
          page = numeric.page;
          quote = this.sourceLineFor(numeric, tokens.slice(0, 2));
          this.quotesRepaired += 1;
        } else {
          quote = null;
        }
      } else {
        quote = null;
      }
    }
    this.accepted += 1;
    return { text, page, quote };
  }

  /** Verify a period-keyed table, dropping only the cells that fail. */
  rows(field: string, rows: LabelledRow[] | undefined): LabelledRow[] {
    if (!rows?.length) return [];
    return rows
      .map((row) => ({
        label: row.label,
        values: (row.values ?? []).map((entry) => ({
          period: entry.period,
          cell: this.value(`${field}.${row.label}.${entry.period}`, entry.cell) ?? emptyCell(),
        })),
      }))
      .filter((row) => row.label?.trim() && row.values.some((entry) => entry.cell.value));
  }

  /**
   * Cross-check a stated growth rate against the two figures it is derived
   * from. A percentage that does not follow from the reported numbers is
   * dropped rather than printed.
   */
  derived(field: string, current: Cited | null, prior: Cited | null, change: Cited | null): Cited | null {
    if (!change?.value) return null;
    // Basis-point style changes ("-260bps") are a different measure — skip them.
    if (/bps|bp\b/i.test(change.value)) return change;

    const currentNumber = toNumber(current?.value);
    const priorNumber = toNumber(prior?.value);
    const changeNumber = toNumber(change.value);
    if (currentNumber === null || priorNumber === null || changeNumber === null) return change;
    // A negative base makes "percentage growth" ambiguous; leave it as reported.
    if (priorNumber <= 0) return change;

    // The operands are printed rounded, so the growth they imply is a range,
    // not a point. A company reporting 15 against 10 may really be 15.4 against
    // 9.6 — anywhere from 38% to 63% — and treating the naive 50% as truth
    // would reject the correct figure. Only a rate outside the whole feasible
    // range is a genuine contradiction.
    const currentHalf = roundingHalfStep(current!.value!);
    const priorHalf = roundingHalfStep(prior!.value!);
    const lowBase = priorNumber - priorHalf;
    if (lowBase <= 0) return change;

    const highest = ((currentNumber + currentHalf - lowBase) / lowBase) * 100;
    const lowest =
      ((currentNumber - currentHalf - (priorNumber + priorHalf)) / (priorNumber + priorHalf)) * 100;
    const tolerance = roundingHalfStep(change.value);

    if (changeNumber < lowest - tolerance || changeNumber > highest + tolerance) {
      this.reject(
        field,
        "derived_mismatch",
        `stated ${change.value} but ${currentNumber} vs ${priorNumber} allows only ${lowest.toFixed(1)}%..${highest.toFixed(1)}%`,
      );
      return null;
    }
    return change;
  }

  /** Verify a chart point: the plotted number must exist in the source. */
  chartPoint(field: string, point: { label: string; value: number; page: number | null; quote: string | null }) {
    const token = String(point.value);
    const tokens = meaningfulNumbers(token);
    if (!tokens.length) {
      // Single-digit values are unfalsifiable; require a matching quote instead.
      if (point.quote && this.locateQuote(point.quote, point.page)) return true;
      this.reject(field, "chart_point_unverified", `${point.label}=${point.value}`);
      return false;
    }
    if (this.locateNumbers(tokens, point.page)) return true;
    this.reject(field, "chart_point_unverified", `${point.label}=${point.value} not found in the source`);
    return false;
  }
}

const emptyCell = (): Cited => ({ value: null, page: null, quote: null });

/**
 * Numbers worth checking. A bare single digit cannot be meaningfully verified
 * against a document full of digits, so only tokens carrying two or more
 * significant digits are treated as claims.
 */
export function meaningfulNumbers(input: string) {
  const matches = normalise(input).match(/-?\d+(?:\.\d+)?/g) ?? [];
  const tokens = matches
    .map((token) => token.replace(/^-/, ""))
    .filter((token) => token.replace(/[^0-9]/g, "").length >= 2);
  return [...new Set(tokens)];
}

/** Substring match with tolerance for trailing-zero formatting differences. */
function containsNumber(haystack: string, token: string) {
  if (haystack.includes(token)) return true;
  if (token.includes(".")) {
    const trimmed = token.replace(/0+$/, "").replace(/\.$/, "");
    if (trimmed.length >= 2 && haystack.includes(trimmed)) return true;
  }
  return false;
}

/**
 * Half the precision a figure was printed to: "58" was rounded to the nearest
 * whole number so it stands for 57.5–58.5, while "13.4" stands for 13.35–13.45.
 */
export function roundingHalfStep(display: string) {
  const decimals = normalise(display).match(/\d+\.(\d+)/)?.[1]?.length ?? 0;
  return 0.5 * 10 ** -decimals;
}

const ABBREVIATIONS = /(?:\b(?:rs|no|nos|inc|ltd|pvt|co|approx|est|vs|mn|bn|cr|fig|ref|etc|dr|mr|ms)\.)$/i;

/** Split prose into sentences without breaking on "Rs." and similar. */
export function splitSentences(text: string) {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z“"(‘'])/);
  const sentences: string[] = [];
  for (const part of parts) {
    const previous = sentences[sentences.length - 1];
    if (previous && ABBREVIATIONS.test(previous.trim())) {
      sentences[sentences.length - 1] = `${previous} ${part}`;
    } else {
      sentences.push(part);
    }
  }
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

export function toNumber(input: string | null | undefined) {
  if (!input) return null;
  const cleaned = normalise(input);
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  return cleaned.trimStart().startsWith("-") ? -Math.abs(parsed) : parsed;
}
