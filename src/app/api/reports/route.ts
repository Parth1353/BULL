import { NextResponse } from "next/server";
import { createJob } from "@/lib/db";
import { config } from "@/lib/config";
import { isSupportedFile, validateUploadContent } from "@/lib/document-parser";
import { persistUpload } from "@/lib/files";
import { allowReportRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const limit = allowReportRequest(request);
    if (!limit.allowed) return NextResponse.json({ error: "Too many report requests. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const formData = await request.formData();
    const companyName = String(formData.get("companyName") ?? "").trim();
    const file = formData.get("file");
    if (companyName.length < 2 || companyName.length > 100) return NextResponse.json({ error: "Enter a company name between 2 and 100 characters." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach a PDF, CSV, or TXT context document." }, { status: 400 });
    if (!isSupportedFile(file.name)) return NextResponse.json({ error: "Only PDF, CSV, and TXT files are supported." }, { status: 415 });
    if (!file.size || file.size > config.maxUploadBytes) return NextResponse.json({ error: `Files must be smaller than ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.` }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateUploadContent(file.name, bytes);
    const uploadPath = await persistUpload(file.name, bytes);
    const job = createJob({ companyName, originalName: file.name, uploadPath, mimeType: file.type || "application/octet-stream" });
    return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start the report job." }, { status: 500 });
  }
}
