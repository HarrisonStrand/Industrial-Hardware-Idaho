import "../config/env.js";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function summarize(value, depth = 0) {
  if (depth > 3) return "[MaxDepth]";
  if (Array.isArray(value)) {
    return {
      kind: "array",
      length: value.length,
      sample: value.slice(0, 5).map((item) => summarize(item, depth + 1)),
    };
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const out = { kind: "object", keys: keys.slice(0, 80) };
    for (const key of keys.slice(0, 20)) {
      const child = value[key];
      if (child && typeof child === "object") out[key] = summarize(child, depth + 1);
      else out[key] = child;
    }
    return out;
  }
  return value;
}

function collectText(value, path = "", rows = []) {
  if (value === null || value === undefined) return rows;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    rows.push({ path, value: String(value) });
    return rows;
  }

  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((item, index) => collectText(item, `${path}[${index}]`, rows));
    return rows;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectText(child, path ? `${path}.${key}` : key, rows);
    }
  }

  return rows;
}

function findLikelyRoutes(data) {
  const textRows = collectText(data);
  return textRows
    .filter((row) => {
      const haystack = `${row.path} ${row.value}`.toLowerCase();
      return (
        haystack.includes("inventory") ||
        haystack.includes("quantity") ||
        haystack.includes("quantities") ||
        haystack.includes("part") ||
        haystack.includes("product") ||
        haystack.includes("stock")
      );
    })
    .slice(0, 200);
}

const paths = [
  "/",
  "/api",
  "/swagger.json",
  "/openapi.json",
  "/api/swagger.json",
  "/api/openapi.json",
  "/api/docs",
  "/docs",
  "/api/help",
  "/help",
  "/api/endpoints",
  "/api/status",
  "/api/health",
  "/api/parts",
  "/api/products",
  "/api/inventory",
  "/api/part-inventory",
  "/api/part-quantities",
  "/api/quantities",
];

async function main() {
  const verbose = hasFlag("verbose");
  const working = [];

  console.log("🔎 Inspecting Fishbowl API surface");
  console.log(`Base URL: ${process.env.FISHBOWL_BASE_URL || "(missing FISHBOWL_BASE_URL)"}`);

  for (const path of paths) {
    try {
      const resp = await fishbowlClient.request({ method: "GET", path });
      const contentType = clean(resp?.headers?.get?.("content-type") || resp?.headers?.["content-type"] || "");
      const routeHints = findLikelyRoutes(resp.data);

      console.log(`\n=== ${path} ===`);
      console.log(JSON.stringify({ status: resp.status, ok: resp.ok, contentType, routeHintCount: routeHints.length }, null, 2));

      if (routeHints.length) {
        console.log("LIKELY ROUTE / FIELD HINTS:");
        console.log(JSON.stringify(routeHints.slice(0, 40), null, 2));
      }

      if (verbose || routeHints.length) {
        console.log("SUMMARY:");
        console.log(JSON.stringify(summarize(resp.data), null, 2));
      }

      if (resp.ok) working.push({ path, status: resp.status, routeHintCount: routeHints.length });
    } catch (err) {
      console.log(`\n=== ${path} ===`);
      console.log(JSON.stringify({ error: err.message }, null, 2));
    }
  }

  console.log("\n===== WORKING PATHS =====");
  console.log(JSON.stringify(working, null, 2));
  console.log("✅ Done");
}

main().catch((err) => {
  console.error("❌ Fishbowl API surface inspection failed:", err);
  process.exit(1);
});
