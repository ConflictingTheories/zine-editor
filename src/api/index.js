
/**
 * API Helper Module
 * Provides a shared request helper and application-specific API calls
 * for payments, crowdfunding, and sovereign token operations.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });

    // Handle 401/403 gracefully - return null instead of throwing
    if (response.status === 401 || response.status === 403) {
        console.warn(`Auth required for ${endpoint}: ${response.status}`);
        return null;
    }

    if (!response.ok) {
        // Try to parse error as JSON, fallback to text
        let errorMessage = 'API request failed';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch (e) {
            // If JSON parsing fails, try to get text
            try {
                const text = await response.text();
                errorMessage = text || `HTTP ${response.status}`;
            } catch (textErr) {
                errorMessage = `HTTP ${response.status}`;
            }
        }
        throw new Error(errorMessage);
    }

    // Handle empty responses
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
