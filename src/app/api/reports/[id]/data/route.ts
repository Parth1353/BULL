import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";

export const runtime = "nodejs";

/** The validated structured output and run trace behind a completed report. */
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job || job.status !== "completed" || !job.reportJson) {
    return NextResponse.json({ error: "The report is not ready yet." }, { status: 404 });
  }
  return NextResponse.json(
    { report: JSON.parse(job.reportJson), trace: job.traceJson ? JSON.parse(job.traceJson) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
