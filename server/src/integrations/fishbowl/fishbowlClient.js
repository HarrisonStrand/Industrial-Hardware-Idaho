// src/integrations/fishbowl/fishbowlClient.js
import crypto from "crypto";

function env(name, fallback) {
  const v = process.env[name];
  if (v == null || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

function toUrl(baseUrl, path) {
  const b = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export class FishbowlClient {
  constructor({
    baseUrl = process.env.FISHBOWL_BASE_URL,
    username = process.env.FISHBOWL_USERNAME,
    password = process.env.FISHBOWL_PASSWORD,
    appName = process.env.FISHBOWL_APP_NAME,
    appDescription = process.env.FISHBOWL_APP_DESCRIPTION,
    appId = process.env.FISHBOWL_APP_ID,
    timeoutMs = Number(process.env.FISHBOWL_TIMEOUT_MS || 10000),
  } = {}) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.appName = appName;
    this.appDescription = appDescription;
    this.appId = appId;
    this.timeoutMs = timeoutMs;

    this.instanceId = crypto.randomBytes(4).toString("hex");
    this._token = null;
    this._user = null;
  }

  assertConfigured() {
    env("FISHBOWL_BASE_URL");
    env("FISHBOWL_USERNAME");
    env("FISHBOWL_PASSWORD");
    env("FISHBOWL_APP_NAME");
    env("FISHBOWL_APP_DESCRIPTION");
    env("FISHBOWL_APP_ID");
  }

  async _fetchJson(url, { method = "GET", headers = {}, body } = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });

      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

      return { ok: res.ok, status: res.status, headers: res.headers, data };
    } finally {
      clearTimeout(t);
    }
  }

  async login({ mfaCode } = {}) {
    this.assertConfigured();

    const url = toUrl(env("FISHBOWL_BASE_URL"), "/api/login");
    const payload = {
      appName: env("FISHBOWL_APP_NAME"),
      appDescription: env("FISHBOWL_APP_DESCRIPTION"),
      appId: Number(env("FISHBOWL_APP_ID")),
      username: env("FISHBOWL_USERNAME"),
      password: env("FISHBOWL_PASSWORD"),
      ...(mfaCode ? { mfaCode } : {}),
    };

    const resp = await this._fetchJson(url, { method: "POST", body: payload });

    // Fishbowl requires first-time approval of the integrated app. :contentReference[oaicite:3]{index=3}
    if (!resp.ok) {
      const mfaHeader = resp.headers?.get?.("MFA");
      return {
        ok: false,
        status: resp.status,
        mfaRequired: mfaHeader?.toLowerCase?.() === "required",
        error: resp.data,
      };
    }

    this._token = resp.data?.token || null;
    this._user = resp.data?.user || null;

    return { ok: true, token: this._token, user: this._user };
  }

  async logout() {
    if (!this._token) return { ok: true, skipped: true };

    const url = toUrl(env("FISHBOWL_BASE_URL"), "/api/logout");
    const resp = await this._fetchJson(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this._token}` },
    });

    // Regardless of response, clear local token so we can recover cleanly.
    this._token = null;
    this._user = null;

    return resp.ok ? { ok: true } : { ok: false, status: resp.status, error: resp.data };
  }

  async ensureToken() {
    if (this._token) return { ok: true, token: this._token, user: this._user };

    const loginResp = await this.login();

    // If the integrated app isn't approved yet, Fishbowl will block logins until approved. :contentReference[oaicite:4]{index=4}
    return loginResp;
  }

  async request({ method, path, body }) {
    const t = await this.ensureToken();
    if (!t.ok) {
      return {
        ok: false,
        status: t.status || 401,
        error: t.error || "Fishbowl login failed",
        mfaRequired: t.mfaRequired,
      };
    }

    const url = toUrl(env("FISHBOWL_BASE_URL"), path);
    let resp = await this._fetchJson(url, {
      method,
      headers: { Authorization: `Bearer ${this._token}` },
      body,
    });

    // If token expired/invalid, retry once with fresh login.
    if (resp.status === 401) {
      this._token = null;
      this._user = null;
      const t2 = await this.ensureToken();
      if (!t2.ok) return { ok: false, status: t2.status || 401, error: t2.error, mfaRequired: t2.mfaRequired };

      resp = await this._fetchJson(url, {
        method,
        headers: { Authorization: `Bearer ${this._token}` },
        body,
      });
    }

    return resp;
  }

  async health() {
    this.assertConfigured();

    // Login returns serverVersion in the user object. :contentReference[oaicite:5]{index=5}
    const login = await this.login();
    if (!login.ok) {
      return {
        ok: false,
        error: login.error,
        status: login.status,
        mfaRequired: login.mfaRequired,
        instanceId: this.instanceId,
      };
    }

    const serverVersion = login.user?.serverVersion || null;

    // Optional: close session to avoid accumulating sessions during dev.
    await this.logout();

    return {
      ok: true,
      serverVersion,
      baseUrl: env("FISHBOWL_BASE_URL"),
      instanceId: this.instanceId,
      note: "If this is the first login for this appId, approve the integration inside Fishbowl.",
    };
  }
}

export const fishbowlClient = new FishbowlClient();