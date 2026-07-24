import { config as loadEnv } from "dotenv";

// Next.js loads .env.local for its server, but the standalone worker and scripts
// run directly under Node. Loading it here keeps every server-side entry point
// consistent without ever exposing the key to browser code.
loadEnv({ path: ".env.local" });
loadEnv();

export const config = {
  storageRoot: process.env.STORAGE_ROOT ?? "storage",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? "15") * 1024 * 1024,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite",
  demoMode: process.env.DEMO_MODE === "true",
};
