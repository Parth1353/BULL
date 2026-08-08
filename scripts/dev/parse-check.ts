/** Inspect what the parser sees in a document, without calling the model. */
import { parseDocument } from "@/lib/document-parser";

async function main() {
  const file = process.argv[2];
  if (!file) { console.error("usage: npm run parse-check -- <file>"); process.exit(1); }
  const doc = await parseDocument(file);
  console.log(`file=${doc.fileName} pages=${doc.pages.length} chars=${doc.transcript.length}`);
  const limit = Number(process.argv[3] ?? 3);
  for (const p of doc.pages.slice(0, limit)) {
    console.log(`\n──── PAGE ${p.page} (rows=${p.rows.length}) ────`);
    console.log(p.rows.slice(0, 16).join("\n"));
  }
  console.log(`\npages with 3+ digit numbers: ${doc.pages.filter((p) => /\d{3,}/.test(p.text)).length}/${doc.pages.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
