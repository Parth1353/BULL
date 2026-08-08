import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";

export const uploadsDir = path.resolve(config.storageRoot, "uploads");
export const reportsDir = path.resolve(config.storageRoot, "reports");

export async function ensureStorage() {
  await Promise.all([mkdir(uploadsDir, { recursive: true }), mkdir(reportsDir, { recursive: true })]);
}

export function safeFileName(name: string) {
  const extension = path.extname(name).toLowerCase();
  const base = path.basename(name, extension).replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-").slice(0, 70) || "context";
  return `${base}-${randomUUID()}${extension}`;
}

export async function persistUpload(name: string, bytes: Uint8Array) {
  await ensureStorage();
  const storedName = safeFileName(name);
  const storedPath = path.join(uploadsDir, storedName);
  await writeFile(storedPath, bytes);
  return storedPath;
}

export const readStoredFile = (filePath: string) => readFile(filePath);
