import dotenv from "dotenv";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

dotenv.config();

function summarizeData(data) {
  if (Array.isArray(data)) {
    return {
      kind: "array",
      length: data.length,
      sample: data.slice(0, 1),
    };
  }

  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    const summary = {
      kind: "object",
      keys,
    };

    for (const key of keys) {
      const value = data[key];

      if (Array.isArray(value)) {
        summary[`${key}Summary`] = {
          kind: "array",
          length: value.length,
          sample: value.slice(0, 1),
        };
      }
    }

    return summary;
  }

  return {
    kind: typeof data,
    value: data,
  };
}

async function testEndpoint(label, path) {
  try {
    const resp = await fishbowlClient.request({
      method: "GET",
      path,
    });

    console.log(`\n=== ${label} ===`);
    console.log(`PATH: ${path}`);
    console.log(`STATUS: ${resp.status}`);
    console.log(`OK: ${resp.ok}`);

    if (resp.ok) {
      console.log("DATA SUMMARY:");
      console.log(JSON.stringify(summarizeData(resp.data), null, 2));
    } else {
      console.log("ERROR:");
      console.log(JSON.stringify(resp.data, null, 2));
    }
  } catch (err) {
    console.log(`\n=== ${label} ===`);
    console.log(`PATH: ${path}`);
    console.log("EXCEPTION:");
    console.log(err.message);
  }
}

async function run() {
  const tests = [
    // baseline
    ["Parts baseline", "/api/parts"],

    // common pagination guesses
    ["Parts page=0 size=100", "/api/parts?page=0&size=100"],
    ["Parts page=1 size=100", "/api/parts?page=1&size=100"],
    ["Parts page=2 size=100", "/api/parts?page=2&size=100"],
    ["Parts limit=100 offset=0", "/api/parts?limit=100&offset=0"],
    ["Parts limit=100 offset=100", "/api/parts?limit=100&offset=100"],
    ["Parts pageNumber=1 pageSize=100", "/api/parts?pageNumber=1&pageSize=100"],
    ["Parts pageNumber=2 pageSize=100", "/api/parts?pageNumber=2&pageSize=100"],

    // likely inventory-ish guesses
    ["Inventory baseline", "/api/inventory"],
    ["Part quantities", "/api/part-quantities"],
    ["Locations", "/api/locations"],
    ["Part details 1", "/api/parts/1"],

    // likely pricing-ish guesses
    ["Prices baseline", "/api/prices"],
    ["Price rules", "/api/price-rules"],
    ["Products baseline", "/api/products"],
  ];

  for (const [label, path] of tests) {
    await testEndpoint(label, path);
  }
}

run().catch((err) => {
  console.error("❌ DISCOVERY ERROR:", err.message);
  process.exit(1);
});