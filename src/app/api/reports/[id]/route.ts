import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Report job not found." }, { status: 404 });
  return NextResponse.json({ id: job.id, companyName: job.companyName, originalName: job.originalName, status: job.status, error: job.error, downloadUrl: job.status === "completed" ? `/api/reports/${job.id}/download` : null, createdAt: job.createdAt });
}
