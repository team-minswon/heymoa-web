import { readFileSync, writeFileSync } from "node:fs";
import { Document, isMap, isSeq, parseDocument } from "yaml";

// Input must be the server-generated docs mirror read with moa docs-read.sh.
// Keep only the public contract and schemas reachable by its consumers.
const source = process.argv[2];
if (!source)
  throw new Error("Usage: node scripts/sync-openapi.mjs <server-mirror.yml>");
const document = parseDocument(readFileSync(source, "utf8"), {
  uniqueKeys: true,
});
if (document.errors.length) throw document.errors[0];
const paths = document.get("paths");
for (const item of [...paths.items]) {
  if (String(item.key).startsWith("/internal")) paths.delete(String(item.key));
}
document.deleteIn(["components", "securitySchemes", "internalToken"]);
const plain = document.toJS();
const schemas = plain.components?.schemas ?? {};
function refs(value, into) {
  if (Array.isArray(value)) {
    for (const item of value) refs(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (
        key === "$ref" &&
        typeof item === "string" &&
        item.startsWith("#/components/schemas/")
      )
        into.add(item.slice("#/components/schemas/".length));
      else refs(item, into);
    }
  }
}
const reachable = new Set();
const pending = new Set();
refs(plain.paths, pending);
refs(
  Object.fromEntries(
    Object.entries(plain.components ?? {}).filter(([key]) => key !== "schemas")
  ),
  pending
);
while (pending.size) {
  const name = pending.values().next().value;
  pending.delete(name);
  if (reachable.has(name)) continue;
  if (!(name in schemas)) throw new Error(`Missing referenced schema: ${name}`);
  reachable.add(name);
  refs(schemas[name], pending);
}
for (const name of Object.keys(schemas)) {
  if (!reachable.has(name)) document.deleteIn(["components", "schemas", name]);
}
// Preserve the existing mirror's key order for a readable diff. Values always
// come from the generated server contract; the baseline controls formatting only.
const target = new URL("../openapi3.yml", import.meta.url);
const baseline = parseDocument(readFileSync(target, "utf8"));
function ordered(value, previous) {
  if (isSeq(value)) {
    value.items.forEach((item, index) =>
      ordered(item, isSeq(previous) ? previous.items[index] : undefined)
    );
  } else if (isMap(value)) {
    const keys = isMap(previous)
      ? previous.items.map((item) => String(item.key))
      : [];
    value.items.sort((a, b) => {
      const ai = keys.indexOf(String(a.key));
      const bi = keys.indexOf(String(b.key));
      return (ai < 0 ? keys.length : ai) - (bi < 0 ? keys.length : bi);
    });
    value.items.forEach((item) =>
      ordered(
        item.value,
        isMap(previous) ? previous.get(String(item.key), true) : undefined
      )
    );
  }
}
const formatted = new Document(document.toJS(), { compat: "yaml-1.1" });
ordered(formatted.contents, baseline.contents);
const output = formatted.toString({
  lineWidth: 0,
  indentSeq: false,
  singleQuote: true,
  compat: "yaml-1.1",
});
if (output.includes("#/components/securitySchemes/internalToken"))
  throw new Error("Internal security reference remains in the public contract");
writeFileSync(target, output);
console.log(
  `Public mirror: ${Object.keys(plain.paths).length} paths, ${reachable.size} schemas`
);
