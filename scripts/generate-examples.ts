import path from "node:path";
import { mkdir } from "node:fs/promises";
import { buildDemoReport } from "@/lib/demo-report";
import { parseDocument } from "@/lib/document-parser";
import { renderReportToFile } from "@/pdf/report-document";

async function main() {
  const destination = path.resolve("examples/generated");
  await mkdir(destination, { recursive: true });
  const [ltts, pocl] = await Promise.all([
    parseDocument(path.resolve("Instructions/LTTS Q2FY26.pdf")),
    parseDocument(path.resolve("Instructions/POCL Q2FY26.pdf")),
  ]);
  if (ltts.pages.length < 2 || pocl.pages.length < 2) throw new Error("Supplied source documents could not be parsed.");
  await renderReportToFile(buildDemoReport("L&T Technology Services"), path.join(destination, "LTTS-Q2FY26-Bull-AI-Research.pdf"));
  await renderReportToFile(buildDemoReport("Pondy Oxides and Chemicals"), path.join(destination, "POCL-Q2FY26-Bull-AI-Research.pdf"));
  console.info(`Generated assessment examples in ${destination}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
