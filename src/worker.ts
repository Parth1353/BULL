import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { claimQueuedJob, completeJob, failJob } from "@/lib/db";
import { parseDocument } from "@/lib/document-parser";
import { extractReport } from "@/lib/claude";
import { ensureStorage, reportsDir } from "@/lib/files";
import { renderReportToFile } from "@/pdf/report-document";

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function processOne() {
  const job = claimQueuedJob();
  if (!job) return false;
  try {
    const document = await parseDocument(job.uploadPath);
    const report = await extractReport(job.companyName, document);
    await ensureStorage();
    const reportPath = path.join(reportsDir, `${job.id}.pdf`);
    await renderReportToFile(report, reportPath);
    completeJob(job.id, reportPath, JSON.stringify(report));
    console.info(`Completed report job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected report generation error.";
    failJob(job.id, message); console.error(`Report job ${job.id} failed: ${message}`);
  }
  return true;
}

async function run() {
  await ensureStorage(); console.info("Bull AI report worker is ready.");
  while (!stopping) { if (!await processOne()) await delay(800); }
  console.info("Bull AI report worker stopped.");
}

run().catch((error) => { console.error(error); process.exit(1); });
