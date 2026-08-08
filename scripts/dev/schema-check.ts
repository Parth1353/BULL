/** Assert the generated JSON Schemas only use keywords Gemini documents. */
import { toGeminiJsonSchema } from "@/lib/json-schema";
import { profileSchema, quarterlySchema, statementsSchema, chartsSchema } from "@/lib/report-schema";

const ALLOWED = new Set(["$id","$defs","$ref","$anchor","type","format","title","description","enum","items","prefixItems","minItems","maxItems","minimum","maximum","anyOf","oneOf","properties","additionalProperties","required","propertyOrdering"]);
const MAP_VALUED = new Set(["properties", "$defs"]);

function walk(node: unknown, path: string, bad: string[]) {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`, bad));
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) bad.push(`${path}.${key}`);
    // Keys inside `properties`/`$defs` are names, not keywords — skip a level.
    if (MAP_VALUED.has(key) && value && typeof value === "object") {
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, `${path}.${key}.${name}`, bad);
      }
    } else {
      walk(value, `${path}.${key}`, bad);
    }
  }
}

let failed = false;
for (const [name, schema] of Object.entries({ profile: profileSchema, quarterly: quarterlySchema, statements: statementsSchema, charts: chartsSchema })) {
  const json = toGeminiJsonSchema(schema);
  const bad: string[] = [];
  walk(json, name, bad);
  const size = JSON.stringify(json).length;
  console.log(`${name.padEnd(12)} ${String(size).padStart(6)} chars  ${bad.length ? `✗ ${bad.join(", ")}` : "✓ all keywords supported"}`);
  if (bad.length) failed = true;
}
process.exit(failed ? 1 : 0);
