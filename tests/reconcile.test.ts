import { describe, expect, it } from "vitest";

import { normalise, type SourcePage } from "@/lib/document-parser";
import { Reconciler, meaningfulNumbers, roundingHalfStep, splitSentences, toNumber } from "@/lib/reconcile";

function page(number: number, text: string, rows: string[] = []): SourcePage {
  return { page: number, text, rows, searchText: normalise(`${text}\n${rows.join("\n")}`) };
}

const pages = [
  page(
    1,
    "Q2 FY26 revenue stood at Rs. 29,795 million, up 15.8% YoY.\nEBIT margin was 13.4% for the quarter.",
    ["Revenue | 29,795 | 25,729", "EBIT margin | 13.4% | 15.1%"],
  ),
  page(2, "Net profit for the quarter was Rs. 3,287 million.", ["PAT | 3,287 | 3,197"]),
];

describe("meaningfulNumbers", () => {
  it("extracts comparable numeric tokens and ignores separators", () => {
    expect(meaningfulNumbers("Rs. 29,795 million")).toEqual(["29795"]);
    expect(meaningfulNumbers("13.4%")).toEqual(["13.4"]);
  });

  it("skips single digits, which cannot be verified against a document", () => {
    expect(meaningfulNumbers("up 4 units")).toEqual([]);
  });

  it("treats accounting negatives as their magnitude", () => {
    expect(meaningfulNumbers("(1,234)")).toEqual(["1234"]);
  });
});

describe("toNumber", () => {
  it("reads signed values including accounting negatives", () => {
    expect(toNumber("29,795")).toBe(29795);
    expect(toNumber("(199)")).toBe(-199);
    expect(toNumber("15.8%")).toBe(15.8);
    expect(toNumber("Not disclosed")).toBeNull();
  });
});

describe("Reconciler.value", () => {
  it("accepts a value whose quote and figure are both in the source", () => {
    const gate = new Reconciler(pages);
    const result = gate.value("revenue", {
      value: "29,795",
      page: 1,
      quote: "revenue stood at Rs. 29,795 million",
    });
    expect(result).toEqual({ value: "29,795", page: 1, quote: "revenue stood at Rs. 29,795 million" });
    expect(gate.rejections).toHaveLength(0);
  });

  it("rejects a figure that does not appear anywhere in the source", () => {
    const gate = new Reconciler(pages);
    expect(gate.value("revenue", { value: "31,400", page: 1, quote: "revenue stood at Rs. 29,795 million" })).toBeNull();
    expect(gate.rejections[0].kind).toBe("value_not_in_source");
  });

  it("rejects a value whose evidence quote is invented", () => {
    const gate = new Reconciler(pages);
    expect(gate.value("revenue", { value: "77,777", page: 1, quote: "revenue grew to a record high of 77,777" })).toBeNull();
    expect(gate.rejections).toHaveLength(1);
  });

  it("corrects a wrong page number when the quote lives elsewhere", () => {
    const gate = new Reconciler(pages);
    const result = gate.value("pat", { value: "3,287", page: 1, quote: "Net profit for the quarter was Rs. 3,287 million." });
    expect(result?.page).toBe(2);
    expect(gate.pagesCorrected).toBe(1);
  });

  it("repairs a paraphrased quote using the real source line", () => {
    const gate = new Reconciler(pages);
    const result = gate.value("pat", { value: "3,287", page: 2, quote: "PAT came in at thirty-two eighty-seven" });
    expect(result?.value).toBe("3,287");
    expect(result?.quote).toContain("3,287");
    expect(gate.quotesRepaired).toBe(1);
  });

  it("treats explicit non-answers as missing", () => {
    const gate = new Reconciler(pages);
    expect(gate.value("x", { value: "N/A", page: 1, quote: "anything" })).toBeNull();
    expect(gate.value("x", { value: null, page: null, quote: null })).toBeNull();
  });
});

describe("Reconciler.text", () => {
  it("keeps prose whose figures are all present in the source", () => {
    const gate = new Reconciler(pages);
    const result = gate.text("highlight", {
      text: "Revenue reached Rs. 29,795 million with an EBIT margin of 13.4%.",
      page: 1,
      quote: "EBIT margin was 13.4% for the quarter.",
    });
    expect(result?.page).toBe(1);
  });

  it("discards prose containing a figure that is not in the source", () => {
    const gate = new Reconciler(pages);
    expect(
      gate.text("highlight", { text: "Revenue reached Rs. 44,120 million this quarter.", page: 1, quote: null }),
    ).toBeNull();
  });

  it("drops only the offending sentence, keeping the rest of the passage", () => {
    const gate = new Reconciler(pages);
    const result = gate.text("description", {
      text: "Revenue was Rs. 29,795 million. Capacity stands at 140,000 MT. EBIT margin was 13.4%.",
      page: 1,
      quote: null,
    });
    expect(result?.text).toBe("Revenue was Rs. 29,795 million. EBIT margin was 13.4%.");
    expect(gate.rejections[0].kind).toBe("value_not_in_source");
  });
});

describe("roundingHalfStep", () => {
  it("reads the precision a figure was printed to", () => {
    expect(roundingHalfStep("58")).toBe(0.5);
    expect(roundingHalfStep("13.4")).toBeCloseTo(0.05);
    expect(roundingHalfStep("29,795")).toBe(0.5);
  });
});

describe("splitSentences", () => {
  it("does not break on Rs. and similar abbreviations", () => {
    expect(splitSentences("Revenue was Rs. 29,795 million. Margin held at 13.4%.")).toEqual([
      "Revenue was Rs. 29,795 million.",
      "Margin held at 13.4%.",
    ]);
  });
});

describe("Reconciler.derived", () => {
  const gate = () => new Reconciler(pages);
  const cell = (value: string) => ({ value, page: 1, quote: "x" });

  it("keeps a growth rate that follows from the reported figures", () => {
    expect(gate().derived("yoy", cell("29795"), cell("25729"), cell("15.8%"))?.value).toBe("15.8%");
  });

  it("drops a growth rate that contradicts the reported figures", () => {
    const reconciler = gate();
    expect(reconciler.derived("yoy", cell("29795"), cell("25729"), cell("42.0%"))).toBeNull();
    expect(reconciler.rejections[0].kind).toBe("derived_mismatch");
  });

  it("allows for rounding when the operands are small", () => {
    // 15 vs 10 could really be 15.4 vs 9.6, so a stated 57% is reachable.
    expect(gate().derived("yoy", cell("15"), cell("10"), cell("57%"))?.value).toBe("57%");
    expect(gate().derived("yoy", cell("87"), cell("56"), cell("57%"))?.value).toBe("57%");
  });

  it("still rejects a rate no rounding of the operands could produce", () => {
    expect(gate().derived("yoy", cell("15"), cell("10"), cell("310%"))).toBeNull();
  });

  it("leaves a negative base alone, where percentage growth is ambiguous", () => {
    expect(gate().derived("yoy", cell("12"), cell("-8"), cell("250%"))?.value).toBe("250%");
  });

  it("leaves basis-point changes alone, since they are a different measure", () => {
    expect(gate().derived("margin", cell("1.6"), cell("4.2"), cell("-260bps"))?.value).toBe("-260bps");
  });
});

describe("Reconciler.chartPoint", () => {
  it("accepts a plotted value that exists in the document", () => {
    expect(new Reconciler(pages).chartPoint("c", { label: "Q2FY26", value: 29795, page: 1, quote: null })).toBe(true);
  });

  it("rejects a plotted value that does not", () => {
    expect(new Reconciler(pages).chartPoint("c", { label: "Q2FY26", value: 31400, page: 1, quote: null })).toBe(false);
  });
});
