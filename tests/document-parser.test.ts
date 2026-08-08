import { describe, expect, it } from "vitest";

import { buildRows, isSupportedFile, normalise, validateUploadContent } from "@/lib/document-parser";

const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe("buildRows", () => {
  it("groups items on the same baseline into one row, left to right", () => {
    const rows = buildRows([item("25,729", 300, 500), item("Revenue", 40, 500), item("29,795", 200, 500)]);
    expect(rows).toEqual(["Revenue | 29,795 | 25,729"]);
  });

  it("keeps words of the same cell together and separates distant columns", () => {
    const rows = buildRows([item("EBIT", 40, 400), item("margin", 58, 400), item("13.4%", 210, 400)]);
    expect(rows).toEqual(["EBIT margin | 13.4%"]);
  });

  it("orders rows top to bottom", () => {
    const rows = buildRows([item("Second", 40, 300), item("First", 40, 400)]);
    expect(rows).toEqual(["First", "Second"]);
  });
});

describe("normalise", () => {
  it("makes equivalent number formats compare equal", () => {
    expect(normalise("Rs. 29,795")).toBe(normalise("rs.29795"));
    expect(normalise("₹ 1,248 mn")).toBe("1248mn");
  });

  it("rewrites accounting negatives", () => {
    expect(normalise("(1,234)")).toBe("-1234");
  });
});

describe("upload validation", () => {
  it("accepts the supported extensions only", () => {
    expect(isSupportedFile("filing.pdf")).toBe(true);
    expect(isSupportedFile("data.CSV")).toBe(true);
    expect(isSupportedFile("deck.pptx")).toBe(false);
  });

  it("rejects a PDF without a PDF signature", () => {
    expect(() => validateUploadContent("filing.pdf", new TextEncoder().encode("not a pdf"))).toThrow(/signature/i);
  });

  it("rejects binary content disguised as text", () => {
    expect(() => validateUploadContent("data.csv", new Uint8Array([65, 0, 66]))).toThrow(/plain text/i);
  });

  it("accepts a well-formed CSV", () => {
    expect(() => validateUploadContent("data.csv", new TextEncoder().encode("a,b\n1,2\n"))).not.toThrow();
  });
});
