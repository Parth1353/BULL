/**
 * Generate a report from the command line, through the same code path the web
 * app uses. Emits three files per run: the PDF, the validated structured output
 * as JSON, and a plain-text run trace.
 *
 *   npm run generate -- --company "L&T Technology Services" --source "Samples/LTTS Q2FY26.pdf"
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { config, requireApiKey } from "@/lib/config";
import { parseDocument } from "@/lib/document-parser";
import { extractReport, type RunTrace } from "@/lib/extract";
import { renderReportToFile } from "@/pdf/report-document";
import type { ResearchReport } from "@/lib/report-schema";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function slug(input: string) {
  return input.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "report";
}

function formatTrace(report: ResearchReport, trace: RunTrace) {
  const lines: string[] = [];
  const push = (key: string, value: string | number) => lines.push(`${key.padEnd(26)}${value}`);

  lines.push("BULL AI — REPORT RUN TRACE");
  lines.push("=".repeat(72));
  push("company", report.companyName);
  push("source_file", trace.sourceFile);
  push("source_pages", trace.sourcePages);
  push("source_characters", trace.sourceCharacters);
  push("started_at", trace.startedAt);
  push("finished_at", trace.finishedAt);
  push("demo_mode", "false");
  push("provider", trace.provider);
  push("model", trace.model);
  push("thinking_level", trace.thinkingLevel);
  push("total_duration_s", (trace.totals.durationMs / 1000).toFixed(1));
  push("prompt_tokens", trace.totals.promptTokens);
  push("output_tokens", trace.totals.outputTokens);
  push("thought_tokens", trace.totals.thoughtTokens);
  push("cached_tokens", trace.totals.cachedTokens);

  lines.push("");
  lines.push("EXTRACTION PASSES");
  lines.push("-".repeat(72));
  lines.push(
    ["pass".padEnd(12), "model".padEnd(20), "secs".padStart(6), "prompt".padStart(8), "out".padStart(7), "thought".padStart(8), "cached".padStart(8), "finish"].join(" "),
  );
  for (const pass of trace.passes) {
    lines.push(
      [
        pass.pass.padEnd(12),
        pass.model.slice(0, 20).padEnd(20),
        (pass.durationMs / 1000).toFixed(1).padStart(6),
        String(pass.promptTokens).padStart(8),
        String(pass.outputTokens).padStart(7),
        String(pass.thoughtTokens).padStart(8),
        String(pass.cachedTokens).padStart(8),
        pass.finishReason,
      ].join(" "),
    );
  }

  if (trace.failedPasses.length) {
    lines.push("");
    lines.push("PASSES THAT DID NOT COMPLETE");
    lines.push("-".repeat(72));
    for (const failure of trace.failedPasses) lines.push(`  ${failure.pass}: ${failure.reason}`);
    lines.push("  (these sections are empty in the report, not sourced from elsewhere)");
  }

  lines.push("");
  lines.push("EVIDENCE RECONCILIATION");
  lines.push("-".repeat(72));
  push("facts_verified", trace.reconciliation.valuesAccepted);
  push("facts_rejected", trace.reconciliation.valuesRejected);
  push("quotes_repaired", trace.reconciliation.quotesRepaired);
  push("pages_corrected", trace.reconciliation.pagesCorrected);
  if (trace.reconciliation.rejections.length) {
    lines.push("");
    lines.push("rejected (not printed in the PDF):");
    for (const rejection of trace.reconciliation.rejections.slice(0, 40)) {
      lines.push(`  - [${rejection.kind}] ${rejection.field}: ${rejection.detail}`);
    }
    if (trace.reconciliation.rejections.length > 40) {
      lines.push(`  … and ${trace.reconciliation.rejections.length - 40} more`);
    }
  }

  lines.push("");
  lines.push("STRUCTURED OUTPUT");
  lines.push("-".repeat(72));
  for (const [key, value] of Object.entries(trace.output)) {
    push(key.replace(/([A-Z])/g, "_$1").toLowerCase(), value);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.get("source");
  const companyName = args.get("company");

  if (!source || !companyName) {
    console.error(
      'Usage: npm run generate -- --company "Company Name" --source "path/to/filing.pdf" [--out output]',
    );
    process.exit(1);
  }

  requireApiKey();

  const outDir = path.resolve(args.get("out") ?? "output");
  await mkdir(outDir, { recursive: true });
  const stem = args.get("name") ?? slug(companyName);

  console.info(`Parsing ${source} …`);
  const document = await parseDocument(path.resolve(source));
  console.info(`  ${document.pages.length} pages, ${document.transcript.length.toLocaleString()} characters`);

  console.info(`Extracting with ${config.geminiModel} (thinking: ${config.geminiThinkingLevel}) …`);
  const { report, trace } = await extractReport(companyName, document);
  console.info(
    `  ${trace.reconciliation.valuesAccepted} facts verified, ` +
      `${trace.reconciliation.valuesRejected} rejected, ` +
      `${(trace.totals.durationMs / 1000).toFixed(1)}s`,
  );

  const pdfPath = path.join(outDir, `${stem}.pdf`);
  const jsonPath = path.join(outDir, `${stem}.json`);
  const tracePath = path.join(outDir, `${stem}.trace.txt`);

  await renderReportToFile(report, pdfPath);
  await writeFile(jsonPath, `${JSON.stringify({ report, trace }, null, 2)}\n`);
  await writeFile(tracePath, formatTrace(report, trace));

  console.info(`\nWrote:\n  ${pdfPath}\n  ${jsonPath}\n  ${tracePath}`);

  if (trace.failedPasses.length) {
    // The report is real but incomplete. Say so loudly and exit non-zero, so a
    // partial run is never mistaken for a good one — or silently committed over
    // a complete report generated earlier.
    console.error(
      `\n!! PARTIAL REPORT — ${trace.failedPasses.length} of 4 extraction passes did not complete:\n` +
        trace.failedPasses.map((f) => `     ${f.pass}: ${f.reason}`).join("\n") +
        "\n   Those sections are empty in the PDF. Re-run once the cause is resolved before sending this out.",
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`\nGeneration failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
