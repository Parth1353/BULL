import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { claimQueuedJob, completeJob, failJob } from "@/lib/db";
import { parseDocument } from "@/lib/document-parser";
import { extractReport } from "@/lib/extract";
import { ensureStorage, reportsDir } from "@/lib/files";
import { renderReportToFile } from "@/pdf/report-document";

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function processOne() {
  const job = claimQueuedJob();
  if (!job) return false;

  console.info(`[worker] starting job ${job.id} (${job.companyName})`);
  try {
    const document = await parseDocument(job.uploadPath);
    console.info(`[worker] parsed ${document.pages.length} pages from ${document.fileName}`);

    const { report, trace } = await extractReport(job.companyName, document);
    console.info(
      `[worker] extracted in ${(trace.totals.durationMs / 1000).toFixed(1)}s — ` +
        `${trace.reconciliation.valuesAccepted} facts verified, ` +
        `${trace.reconciliation.valuesRejected} rejected`,
    );

    if (trace.failedPasses.length) {
      console.warn(
        `[worker] partial extraction: ${trace.failedPasses.map((f) => f.pass).join(", ")} did not complete`,
      );
    }

    await ensureStorage();
    const reportPath = path.join(reportsDir, `${job.id}.pdf`);
    await renderReportToFile(report, reportPath);
    completeJob(job.id, reportPath, JSON.stringify(report), JSON.stringify(trace));
    console.info(`[worker] completed job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected report generation error.";
    failJob(job.id, message);
    console.error(`[worker] job ${job.id} failed: ${message}`);
  }
  return true;
}

async function run() {
  await ensureStorage();
  console.info("Bull AI report worker is ready.");
  while (!stopping) {
    if (!(await processOne())) await delay(800);
  }
  console.info("Bull AI report worker stopped.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
