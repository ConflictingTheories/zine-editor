// Central HTTP client. All API calls go through here.
// Handles: base URL, JSON headers, auth tokens, and automatic token refresh.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

// In-memory token store. For a real app, consider a React context or Zustand store.
let accessToken  = null;
let refreshToken = localStorage.getItem("longform_refresh_token");

export function setTokens(access, refresh) {
  accessToken  = access;
  refreshToken = refresh;
  if (refresh) localStorage.setItem("longform_refresh_token", refresh);
}

export function clearTokens() {
  accessToken  = null;
  refreshToken = null;
  localStorage.removeItem("longform_refresh_token");
}

export function hasStoredSession() {
  return !!localStorage.getItem("longform_refresh_token");
}

async function refreshAccessToken() {
  if (!refreshToken) throw new Error("No refresh token available");

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw new Error("Session expired — please log in again");
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// Core request function — retries once with a fresh token on 401
async function request(path, options = {}, retry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && retry && refreshToken) {
    await refreshAccessToken();
    return request(path, options, false); // one retry
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error ?? `Request failed (${response.status})`);
  }

  return json;
}

export const apiClient = {
  get:    (path)          => request(path),
  post:   (path, body)    => request(path, { method: "POST",  body: JSON.stringify(body) }),
  put:    (path, body)    => request(path, { method: "PUT",   body: JSON.stringify(body) }),
  delete: (path)          => request(path, { method: "DELETE" }),
};
