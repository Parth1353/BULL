/** Render the PDF template from a saved JSON payload, without calling the model. */
import { readFile } from "node:fs/promises";
import { renderReportToFile } from "@/pdf/report-document";

async function main() {
  const raw = JSON.parse(await readFile(process.argv[2], "utf8"));
  const report = raw.report ?? raw;
  await renderReportToFile(report, process.argv[3] ?? "output/render-check.pdf");
  console.log("ok");
}
main().catch((e) => { console.error(e); process.exit(1); });
