import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: { command: "DEMO_MODE=true pnpm dev", url: "http://127.0.0.1:3000", reuseExistingServer: true, timeout: 120000 },
});
