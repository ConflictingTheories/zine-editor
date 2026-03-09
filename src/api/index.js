import { SovereignSDK } from '../lib/sovereign-sdk.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export function setTokens(access, refresh) {
    if (access) localStorage.setItem('token', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error("No refresh token available");

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
        clearTokens();
        throw new Error("Session expired — please log in again");
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
}

export async function request(endpoint, method = 'GET', body = null, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchConfig = {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    };

    // Integrate Sovereign Token Identity (4D Steganographic Identity)
    if (window._sovereign_identity && SovereignSDK) {
        try {
            await SovereignSDK.intercept(fetchConfig, window._sovereign_identity);
        } catch (e) {
            console.warn("Failed to attach Sovereign Signature:", e);
        }
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchConfig);

    // Handle 401 gracefully - attempt refresh
    if (response.status === 401 && retry && localStorage.getItem('refreshToken')) {
        console.warn(`Auth required for ${endpoint}. Attempting refresh...`);
        try {
            await refreshAccessToken();
            return request(endpoint, method, body, false); // Retry exactly once
        } catch (e) {
            console.error("Refresh failed", e);
            // Session is dead, clear it out.
            window.dispatchEvent(new Event('session-expired'));
            throw e;
        }
    }

    if (response.status === 401 || response.status === 403) {
        let errorMessage = response.status === 401 ? 'Session expired' : 'Access denied';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) { /* use default */ }
        throw new Error(errorMessage);
    }

    if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch (e) {
            errorMessage = `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return null;
    }

    return response.json();
}

// Payment API
export async function createPaymentIntent(zineId, amount_dollars) {
    return request(`/zines/${zineId}/contribute`, 'POST', { amount_dollars });
}

// Crowdfunding API
export async function getZineFunding(zineId) {
    return request(`/zines/${zineId}/funding`);
}

export async function setZineFunding(zineId, fundingGoal, currency, deadline) {
    return request(`/zines/${zineId}/funding`, 'POST', { fundingGoal, currency, deadline });
}

export async function contributeToZine(zineId, amount, paymentIntentId) {
    return request(`/zines/${zineId}/fund`, 'POST', { amount, paymentIntentId });
}

export async function getZineContributors(zineId) {
    return request(`/zines/${zineId}/contributors`);
}

export async function getZineProducers(zineId) {
    return request(`/zines/${zineId}/producers`);
}

export async function checkZineAccess(zineId) {
    return request(`/zines/${zineId}/access`);
}

// Sovereign Token API
export async function createSovereignToken(identity, claims = {}) {
    return request('/sovereign/create-token', 'POST', { identity, claims });
}

export async function getUserSovereignTokens() {
    return request('/sovereign/tokens');
}

export async function verifySovereignToken(tokenData) {
    return request('/sovereign/verify', 'POST', { tokenData });
}

export async function sealContent(zineId, tokenId, content) {
    return request('/sovereign/seal', 'POST', { zineId, tokenId, content });
}

export async function unlockContent(gateId, tokenData) {
    return request('/sovereign/unlock', 'POST', { gateId, tokenData });
}

export async function createDelegation(tokenId, userId, purpose, ttl) {
    return request('/sovereign/delegate', 'POST', { tokenId, userId, purpose, ttl });
}

export async function getGateInfo(gateId) {
    return request(`/gates/${gateId}`);
}
