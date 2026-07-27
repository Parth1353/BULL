import { config as loadEnv } from "dotenv";

// Next.js loads .env.local for its server, but the standalone worker and scripts
// run directly under Node. Loading it here keeps every server-side entry point
// consistent without ever exposing the key to browser code.
loadEnv({ path: ".env.local" });
loadEnv();

export const config = {
  storageRoot: process.env.STORAGE_ROOT ?? "storage",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? "15") * 1024 * 1024,
  claudeModel: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
  claudeFallbackModel: process.env.CLAUDE_FALLBACK_MODEL ?? "claude-haiku-4-20250514",
  demoMode: process.env.DEMO_MODE === "true",
};
