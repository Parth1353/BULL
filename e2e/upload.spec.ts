import { test, expect } from "@playwright/test";
import path from "node:path";

test("uploads a context document and reaches a downloadable report", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("e.g. L&T Technology Services").fill("LTTS");
  await page.locator('input[type="file"]').setInputFiles(path.resolve("fixtures/ltts-q2fy26.txt"));
  await page.getByRole("button", { name: /Generate research report/i }).click();
  await expect(page.getByText(/Queued|Building your report|Report ready/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Download PDF/i })).toBeVisible({ timeout: 30000 });
});
