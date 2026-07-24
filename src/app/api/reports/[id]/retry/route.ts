import { NextResponse } from "next/server";
import { retryJob } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const job = retryJob(id);
  if (!job) return NextResponse.json({ error: "Retry is only available for failed jobs." }, { status: 409 });
  return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
}
