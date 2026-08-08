import { describe, expect, it } from "vitest";
import { allowReportRequest } from "@/lib/rate-limit";

describe("report request throttling", () => {
  it("limits a client after ten report creation attempts", () => {
    const request = new Request("http://localhost/api/reports", { headers: { "x-forwarded-for": "203.0.113.42" } });
    for (let index = 0; index < 10; index += 1) expect(allowReportRequest(request).allowed).toBe(true);
    expect(allowReportRequest(request).allowed).toBe(false);
  });
});
