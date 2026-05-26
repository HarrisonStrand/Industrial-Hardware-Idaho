import "../config/env.js";

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function mask(value = "") {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return "********";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function cleanBase(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function joinUrl(base = "", path = "") {
  const b = cleanBase(base);
  const p = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
  return `${b}${p}`;
}

function apiAwareJoinUrl(base = "", path = "") {
  const b = cleanBase(base);
  let p = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;

  // If FISHBOWL_BASE_URL already ends with /api, avoid producing /api/api/...
  if (/\/api$/i.test(b) && /^\/api\//i.test(p)) {
    p = p.replace(/^\/api/i, "");
  }

  return `${b}${p}`;
}

async function fetchRaw(url, { method = "GET", token = "", body = null } = {}) {
  const headers = {
    Accept: "application/json, text/plain, */*",
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== null && body !== undefined) headers["Content-Type"] = "application/json";

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text || null;
    }

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      ms: Date.now() - started,
      contentType: res.headers.get("content-type") || "",
      bodyKind: Array.isArray(parsed) ? "array" : typeof parsed,
      bodyKeys: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed).slice(0, 30) : [],
      bodyPreview:
        typeof parsed === "string"
          ? parsed.slice(0, 800)
          : parsed
            ? JSON.stringify(parsed, null, 2).slice(0, 1200)
            : "",
      data: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      status: "FETCH_ERROR",
      statusText: error?.message || "Fetch failed",
      ms: Date.now() - started,
      contentType: "",
      bodyKind: "error",
      bodyKeys: [],
      bodyPreview: error?.stack || error?.message || String(error),
      data: null,
    };
  }
}

async function tryLogin(baseUrl) {
  const payload = {
    appName: process.env.FISHBOWL_APP_NAME,
    appDescription: process.env.FISHBOWL_APP_DESCRIPTION,
    appId: Number(process.env.FISHBOWL_APP_ID),
    username: process.env.FISHBOWL_USERNAME,
    password: process.env.FISHBOWL_PASSWORD,
  };

  const loginPaths = ["/api/login", "/login"];
  const attempts = [];

  for (const path of loginPaths) {
    const url = apiAwareJoinUrl(baseUrl, path);
    const resp = await fetchRaw(url, { method: "POST", body: payload });
    attempts.push({ path, url, ...summarize(resp) });

    if (resp.ok && resp.data?.token) {
      return {
        ok: true,
        token: resp.data.token,
        user: resp.data.user || null,
        path,
        url,
        attempts,
      };
    }
  }

  return { ok: false, token: "", user: null, attempts };
}

function summarize(resp) {
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    ms: resp.ms,
    contentType: resp.contentType,
    bodyKind: resp.bodyKind,
    bodyKeys: resp.bodyKeys,
    bodyPreview: resp.bodyPreview,
  };
}

function collectCandidatePaths(partNumber = "") {
  const part = encodeURIComponent(partNumber || "");
  const paths = [
    "/api",
    "/api/",
    "/api/swagger.json",
    "/api/openapi.json",
    "/swagger.json",
    "/openapi.json",
    "/api/docs",
    "/docs",
    "/api/health",

    "/api/parts",
    "/api/part",
    "/api/products",
    "/api/product",
    "/api/items",
    "/api/item",
    "/api/inventory",
    "/api/inventories",
    "/api/quantities",
    "/api/part-quantities",
    "/api/partQuantities",
    "/api/locations",
    "/api/uoms",
  ];

  if (part) {
    paths.push(
      `/api/parts/${part}`,
      `/api/part/${part}`,
      `/api/products/${part}`,
      `/api/product/${part}`,
      `/api/items/${part}`,
      `/api/item/${part}`,
      `/api/inventory/${part}`,
      `/api/parts?number=${part}`,
      `/api/parts?partNumber=${part}`,
      `/api/parts?num=${part}`,
      `/api/parts?search=${part}`,
      `/api/parts?searchTerm=${part}`,
      `/api/parts?q=${part}`,
      `/api/products?number=${part}`,
      `/api/products?partNumber=${part}`,
      `/api/products?search=${part}`,
      `/api/inventory?number=${part}`,
      `/api/inventory?partNumber=${part}`,
      `/api/part-quantities?number=${part}`,
      `/api/part-quantities?partNumber=${part}`,
    );
  }

  paths.push(
    "/api/parts?pageNumber=1&pageSize=10",
    "/api/parts?page=1&size=10",
    "/api/parts?limit=10&offset=0",
    "/api/products?pageNumber=1&pageSize=10",
    "/api/products?page=1&size=10",
    "/api/products?limit=10&offset=0",
  );

  return [...new Set(paths)];
}

async function main() {
  const baseUrl = process.env.FISHBOWL_BASE_URL || "";
  const partNumber = argValue("part", "1221GALV");
  const verbose = hasFlag("verbose");

  console.log("🔎 Fishbowl catalog API diagnostic");
  console.log(
    JSON.stringify(
      {
        FISHBOWL_BASE_URL: baseUrl,
        baseEndsWithApi: /\/api$/i.test(cleanBase(baseUrl)),
        FISHBOWL_USERNAME: mask(process.env.FISHBOWL_USERNAME || ""),
        FISHBOWL_APP_NAME: process.env.FISHBOWL_APP_NAME || "",
        FISHBOWL_APP_ID: process.env.FISHBOWL_APP_ID || "",
        partNumber,
      },
      null,
      2,
    ),
  );

  const login = await tryLogin(baseUrl);

  console.log("\n===== LOGIN =====");
  console.log(
    JSON.stringify(
      {
        ok: login.ok,
        path: login.path || "",
        userKeys: login.user && typeof login.user === "object" ? Object.keys(login.user) : [],
        userPreview: login.user ? JSON.stringify(login.user, null, 2).slice(0, 1000) : "",
        attempts: login.attempts,
      },
      null,
      2,
    ),
  );

  if (!login.ok) {
    console.log("\n❌ Login did not return a token, so catalog endpoints cannot be tested.");
    process.exit(1);
  }

  const paths = collectCandidatePaths(partNumber);
  const results = [];

  console.log("\n===== ENDPOINT TESTS =====");
  for (const path of paths) {
    const url = apiAwareJoinUrl(baseUrl, path);
    const resp = await fetchRaw(url, { method: "GET", token: login.token });
    const row = { path, url, ...summarize(resp) };
    results.push(row);

    const marker = resp.ok ? "✅" : resp.status === 404 ? "▫️" : "⚠️";
    console.log(`${marker} ${path} -> ${resp.status} ${resp.statusText || ""}`.trim());
    if (verbose || resp.ok || (resp.status !== 404 && resp.status !== 405)) {
      console.log(JSON.stringify(row, null, 2));
    }
  }

  const likely = results.filter((row) => row.ok);
  console.log("\n===== LIKELY WORKING ENDPOINTS =====");
  console.log(JSON.stringify(likely, null, 2));

  if (!likely.length) {
    console.log("\nNo GET catalog/list endpoint responded successfully. This usually means one of these is true:");
    console.log("1) Fishbowl's REST API does not expose parts/products on this server/version.");
    console.log("2) The integration user/app has login access but not catalog endpoint permission.");
    console.log("3) The base URL points to a limited/proxy API, not the full Fishbowl REST API surface.");
    console.log("4) The endpoint requires a specific search/body shape instead of simple GET.");
  }
}

main().catch((error) => {
  console.error("❌ Diagnostic failed:", error);
  process.exit(1);
});
