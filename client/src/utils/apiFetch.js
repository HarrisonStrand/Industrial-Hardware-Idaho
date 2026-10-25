const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ""
).replace(/\/$/, "");

export async function apiFetch(path, options = {}) {
  const safePath = String(path || "");
  const url = safePath.startsWith("http")
    ? safePath
    : `${API_BASE_URL}${safePath.startsWith("/") ? safePath : `/${safePath}`}`;

  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Request failed (${response.status})`);
    // Callers can branch on these, e.g. code "EMAIL_NOT_VERIFIED".
    error.status = response.status;
    error.code = data?.code || "";
    error.data = data;
    throw error;
  }

  return data;
}