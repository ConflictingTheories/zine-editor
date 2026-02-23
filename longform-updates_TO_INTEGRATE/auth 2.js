import { apiClient, setTokens, clearTokens } from "./client.js";

export async function register({ email, name, password }) {
  const data = await apiClient.post("/auth/register", { email, name, password });
  setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function login({ email, password }) {
  const data = await apiClient.post("/auth/login", { email, password });
  setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout(refreshToken) {
  await apiClient.post("/auth/logout", { refreshToken }).catch(() => {});
  clearTokens();
}
