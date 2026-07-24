import path from "node:path";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type ReportJob = {
  id: string;
  companyName: string;
  originalName: string;
  uploadPath: string;
  mimeType: string;
  status: JobStatus;
  error: string | null;
  reportPath: string | null;
  reportJson: string | null;
  createdAt: string;
  updatedAt: string;
};

mkdirSync(path.resolve(config.storageRoot), { recursive: true });
const db = new DatabaseSync(path.resolve(config.storageRoot, "bull-ai.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS report_jobs (
    id TEXT PRIMARY KEY, company_name TEXT NOT NULL, original_name TEXT NOT NULL,
    upload_path TEXT NOT NULL, mime_type TEXT NOT NULL, status TEXT NOT NULL,
    error TEXT, report_path TEXT, report_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
`);

const mapJob = (row: Record<string, unknown>): ReportJob => ({
  id: String(row.id), companyName: String(row.company_name), originalName: String(row.original_name),
  uploadPath: String(row.upload_path), mimeType: String(row.mime_type), status: row.status as JobStatus,
  error: row.error ? String(row.error) : null, reportPath: row.report_path ? String(row.report_path) : null,
  reportJson: row.report_json ? String(row.report_json) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

export function createJob(input: Pick<ReportJob, "companyName" | "originalName" | "uploadPath" | "mimeType">) {
  const id = randomUUID(); const now = new Date().toISOString();
  db.prepare(`INSERT INTO report_jobs (id, company_name, original_name, upload_path, mime_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`)
    .run(id, input.companyName, input.originalName, input.uploadPath, input.mimeType, now, now);
  return getJob(id)!;
}

export function getJob(id: string) {
  const row = db.prepare("SELECT * FROM report_jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapJob(row) : null;
}

export function claimQueuedJob() {
  const row = db.prepare("SELECT * FROM report_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) return null;
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE report_jobs SET status='processing', updated_at=? WHERE id=? AND status='queued'").run(now, String(row.id));
  return result.changes ? getJob(String(row.id)) : null;
}

export function completeJob(id: string, reportPath: string, reportJson: string) {
  db.prepare("UPDATE report_jobs SET status='completed', report_path=?, report_json=?, error=NULL, updated_at=? WHERE id=?")
    .run(reportPath, reportJson, new Date().toISOString(), id);
}

export function failJob(id: string, error: string) {
  db.prepare("UPDATE report_jobs SET status='failed', error=?, updated_at=? WHERE id=?")
    .run(error.slice(0, 1200), new Date().toISOString(), id);
}

export function retryJob(id: string) {
  db.prepare("UPDATE report_jobs SET status='queued', error=NULL, updated_at=? WHERE id=? AND status='failed'")
    .run(new Date().toISOString(), id);
  return getJob(id);
}
