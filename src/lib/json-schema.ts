import { z } from "zod";

/**
 * Gemini's `responseJsonSchema` accepts standard JSON Schema, but only a
 * documented subset of keywords. Anything outside that subset is not ignored —
 * it can cause the request to be rejected — so a Zod schema is converted and
 * then pruned to exactly the supported set before it is sent.
 *
 * Supported per the API reference: $id, $defs, $ref, $anchor, type, format,
 * title, description, enum, items, prefixItems, minItems, maxItems, minimum,
 * maximum, anyOf, oneOf, properties, additionalProperties, required, and the
 * non-standard propertyOrdering.
 */
const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

/** Keywords that hold a nested schema (or map/array of schemas) to recurse into. */
const SCHEMA_VALUED = new Set(["items", "additionalProperties"]);
const SCHEMA_ARRAY_VALUED = new Set(["anyOf", "oneOf", "prefixItems"]);
const SCHEMA_MAP_VALUED = new Set(["properties", "$defs"]);

function prune(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(prune);
  if (!node || typeof node !== "object") return node;

  const input = node as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!SUPPORTED_KEYWORDS.has(key)) continue;

    if (SCHEMA_MAP_VALUED.has(key) && value && typeof value === "object") {
      const mapped: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
        mapped[name] = prune(child);
      }
      output[key] = mapped;
    } else if (SCHEMA_ARRAY_VALUED.has(key) && Array.isArray(value)) {
      output[key] = value.map(prune);
    } else if (SCHEMA_VALUED.has(key) && value && typeof value === "object") {
      output[key] = prune(value);
    } else {
      output[key] = value;
    }
  }

  // Zod emits an int64-wide minimum/maximum for `z.number().int()`. Those bounds
  // are meaningless to the model and only add noise to the schema.
  if (output.type === "integer" && output.minimum === Number.MIN_SAFE_INTEGER) {
    delete output.minimum;
    delete output.maximum;
  }

  return output;
}

/** Convert a Zod schema into a Gemini-compatible JSON Schema. */
export function toGeminiJsonSchema(schema: z.ZodType) {
  return prune(z.toJSONSchema(schema, { io: "output" })) as Record<string, unknown>;
}
