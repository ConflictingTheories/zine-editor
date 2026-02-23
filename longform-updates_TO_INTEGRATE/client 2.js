// Central HTTP client. All API calls go through here.
// Handles: base URL, JSON headers, access token, and automatic silent refresh.
//
// The refresh token is stored in an HttpOnly cookie set by the server.
// This file never reads, writes, or knows about the refresh token — the browser
// sends it automatically with every request to /api/auth/*, making it
// inaccessible to JavaScript and therefore safe from XSS.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

// Access token lives in memory only — never persisted to localStorage.
// It is short-lived (15 min) so losing it on page refresh is acceptable;
// the /auth/refresh call restores it silently using the HttpOnly cookie.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

// Attempt to restore the access token from the server using the HttpOnly
// refresh cookie. Call this once on app startup. Returns the user if
// a valid session exists, null otherwise.
export async function restoreSession() {
  try {
    const data = await request("/auth/refresh", { method: "POST" }, false);
    setAccessToken(data.accessToken);
    return data.user;
  } catch {
    return null; // No valid session — user must log in
  }
}

// Core request function — retries once after a silent token refresh on 401
async function request(path, options = {}, retry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // Required: sends the HttpOnly refresh cookie
  });

  if (response.status === 401 && retry) {
    // Try to silently refresh the access token, then retry once
    try {
      const refreshData = await request("/auth/refresh", { method: "POST" }, false);
      setAccessToken(refreshData.accessToken);
      return request(path, options, false);
    } catch {
      clearAccessToken();
      throw new Error("Session expired — please log in again");
    }
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error ?? `Request failed (${response.status})`);
  }

  return json;
}

export const apiClient = {
  get:    (path)       => request(path),
  post:   (path, body) => request(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    (path, body) => request(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: (path)       => request(path, { method: "DELETE" }),
};
