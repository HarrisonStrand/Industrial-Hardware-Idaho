const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

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
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }

  return data;
}