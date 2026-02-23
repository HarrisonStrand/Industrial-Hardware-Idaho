/**
 * apiFetch(url, options?, { onUnauthorized? })
 *
 * - Prepends VITE_API_BASE_URL for relative paths ("/api/...")
 * - Always includes cookies (credentials: "include")
 * - Safely parses JSON
 * - Throws on non-OK responses (Error.message from {error})
 * - If response is 401, triggers onUnauthorized() before throwing
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function buildUrl(url) {
  // If caller passes an absolute URL, use it as-is
  if (/^https?:\/\//i.test(url)) return url;

  // If it's a relative API route, prefix with API_BASE
  if (url.startsWith("/")) return `${API_BASE}${url}`;

  // Otherwise treat as already-correct
  return url;
}

export async function apiFetch(url, options = {}, { onUnauthorized } = {}) {
  const finalUrl = buildUrl(url);

  const res = await fetch(finalUrl, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    try {
      onUnauthorized?.();
    } catch {
      // ignore
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}