import { config as loadEnv } from "dotenv";

// Next.js loads .env.local for its own server, but the standalone worker and the
// generate CLI run directly under Node. Loading here keeps every server-side
// entry point consistent without ever exposing the key to browser code.
loadEnv({ path: ".env.local" });
loadEnv();

export const config = {
  storageRoot: process.env.STORAGE_ROOT ?? "storage",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? "20") * 1024 * 1024,
  /**
   * Default is the current generally-available flagship. `gemini-3.1-pro-preview`
   * extracts dense tables slightly better but is a preview model, and Google has
   * already retired one preview in this family — so the shipped default is the
   * one that will still resolve months from now.
   */
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  geminiThinkingLevel: (process.env.GEMINI_THINKING_LEVEL ?? "HIGH").toUpperCase(),
  // Characters of source text handed to the model per extraction pass.
  maxSourceChars: Number(process.env.MAX_SOURCE_CHARS ?? "400000"),
};

export function requireApiKey() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example) before generating a report. " +
        "Create a key at https://aistudio.google.com/apikey",
    );
  }
  return apiKey;
}
