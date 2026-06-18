import "../config/env.js";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

function summarize(value, depth = 0) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return {
      kind: "array",
      length: value.length,
      sample: value.slice(0, 5).map((item) => summarize(item, depth + 1)),
    };
  }

  if (typeof value === "object") {
    if (depth >= 3) return "[MaxDepth]";

    const entries = Object.entries(value).slice(0, 40);
    return Object.fromEntries(
      entries.map(([key, item]) => [key, summarize(item, depth + 1)])
    );
  }

  return value;
}

function getArgPath() {
  const directPath = process.argv[2];
  const namedPath = process.argv.find((item) => item.startsWith("--path="));
  return namedPath ? namedPath.slice("--path=".length) : directPath;
}

async function main() {
  const path = getArgPath() || "/api/parts/inventory?number=1221GALV";

  console.log("🔎 Fishbowl path probe");
  console.log(
    JSON.stringify(
      {
        FISHBOWL_BASE_URL: process.env.FISHBOWL_BASE_URL,
        path,
      },
      null,
      2
    )
  );

  const response = await fishbowlClient.request({
    method: "GET",
    path,
  });

  console.log("\n===== RESPONSE =====");
  console.log(
    JSON.stringify(
      {
        ok: response.ok,
        status: response.status,
        dataSummary: summarize(response.data),
        errorSummary: summarize(response.error),
      },
      null,
      2
    )
  );

  if (response.data) {
    console.log("\n===== RAW DATA =====");
    console.log(JSON.stringify(response.data, null, 2).slice(0, 12000));
  }

  await fishbowlClient.logout();
}

main().catch(async (error) => {
  console.error("❌ ERROR:", error?.stack || error?.message || error);
  try {
    await fishbowlClient.logout();
  } catch {
    // ignore logout failure during diagnostics
  }
  process.exit(1);
});
