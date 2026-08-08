/** Print the models this API key can actually reach. */
import { GoogleGenAI } from "@google/genai";
import { requireApiKey } from "@/lib/config";

async function main() {
  const ai = new GoogleGenAI({ apiKey: requireApiKey() });
  const names: string[] = [];
  for await (const model of await ai.models.list()) {
    const name = (model.name ?? "").replace("models/", "");
    if (/^gemini-/.test(name) && !/image|tts|live|embedding|audio|dialog|computer-use/.test(name)) names.push(name);
  }
  console.log(names.sort().join("\n"));
  console.log("\nNote: a listed model can still return 404 if it has been retired.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.slice(0, 300) : error);
  process.exit(1);
});
