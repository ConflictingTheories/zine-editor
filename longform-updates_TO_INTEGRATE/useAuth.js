import { useState, useCallback } from "react";
import * as authApi from "../api/auth.js";
import { hasStoredSession, apiClient, setTokens } from "../api/client.js";

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(hasStoredSession());

  // On app mount, try to restore session using stored refresh token
  const restoreSession = useCallback(async () => {
    if (!hasStoredSession()) return;
    try {
      // Trigger the auto-refresh in the API client by making an authenticated call
      // The client will use the stored refresh token automatically
      const data = await apiClient.post("/auth/refresh", {
        refreshToken: localStorage.getItem("longform_refresh_token"),
      });
      setTokens(data.accessToken, data.refreshToken);
      // Decode user from access token (no extra request needed)
      const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
      setUser({ id: payload.sub, email: payload.email, name: payload.name });
    } catch {
      setUser(null); // Session invalid, user must log in
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials) => {
    const loggedInUser = await authApi.login(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (details) => {
    const newUser = await authApi.register(details);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return { user, loading, restoreSession, login, register, logout };
}
