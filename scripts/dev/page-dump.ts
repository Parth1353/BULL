import { parseDocument } from "@/lib/document-parser";
async function main() {
  const doc = await parseDocument(process.argv[2]);
  for (const n of process.argv.slice(3).map(Number)) {
    const p = doc.pages.find((x) => x.page === n);
    console.log(`\n──── PAGE ${n} (rows=${p?.rows.length}) ────`);
    console.log(p?.rows.join("\n"));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
