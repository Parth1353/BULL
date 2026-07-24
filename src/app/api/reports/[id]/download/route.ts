import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const job = getJob(id);
  if (!job || job.status !== "completed" || !job.reportPath) return NextResponse.json({ error: "The report is not ready yet." }, { status: 404 });
  const pdf = await readFile(job.reportPath);
  const name = `${job.companyName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-bull-ai-research.pdf`;
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
