/**
 * apiFetch(url, options?, { onUnauthorized? })
 *
 * - Always includes cookies (credentials: "include")
 * - Safely parses JSON
 * - Throws on non-OK responses (Error.message from {error})
 * - If response is 401, triggers onUnauthorized() before throwing
 */
export async function apiFetch(url, options = {}, { onUnauthorized } = {}) {
  const res = await fetch(url, {
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
