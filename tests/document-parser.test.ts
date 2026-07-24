import { describe, expect, it } from "vitest";
import { buildTableCandidates, validateUploadContent } from "@/lib/document-parser";

describe("document ingestion safeguards", () => {
  it("reconstructs a positioned PDF table row in reading order", () => {
    const rows = buildTableCandidates([
      { str: "Q2 FY26", transform: [1, 0, 0, 1, 210, 400] },
      { str: "Revenue", transform: [1, 0, 0, 1, 20, 400] },
      { str: "29,795", transform: [1, 0, 0, 1, 130, 400] },
    ]);
    expect(rows).toEqual(["Revenue | 29,795 | Q2 FY26"]);
  });

  it("requires a PDF signature and non-empty plain-text uploads", () => {
    expect(() => validateUploadContent("filing.pdf", new Uint8Array([1, 2, 3]))).toThrow("valid PDF signature");
    expect(() => validateUploadContent("filing.csv", new Uint8Array())).toThrow("empty");
    expect(() => validateUploadContent("filing.txt", new TextEncoder().encode("Revenue,29795"))).not.toThrow();
  });
});
