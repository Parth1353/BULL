import path from "node:path";
import { mkdir } from "node:fs/promises";
import { config } from "@/lib/config";
import { parseDocument } from "@/lib/document-parser";
import { extractReport } from "@/lib/claude";
import { renderReportToFile } from "@/pdf/report-document";

const examples = [
  { companyName: "L&T Technology Services", source: "Instructions/LTTS Q2FY26.pdf", output: "LTTS-Q2FY26-Bull-AI-Research-live.pdf" },
  { companyName: "Pondy Oxides and Chemicals", source: "Instructions/POCL Q2FY26.pdf", output: "POCL-Q2FY26-Bull-AI-Research-live.pdf" },
];

async function main() {
  if (config.demoMode) throw new Error("examples:live requires DEMO_MODE=false.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is missing. Add it to .env.local before running examples:live.");
  const destination = path.resolve("examples/live");
  await mkdir(destination, { recursive: true });
  for (const example of examples) {
    const document = await parseDocument(path.resolve(example.source));
    const report = await extractReport(example.companyName, document);
    await renderReportToFile(report, path.join(destination, example.output));
    console.info(`Generated live report for ${example.companyName}`);
  }
  console.info(`Live examples written to ${destination}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
