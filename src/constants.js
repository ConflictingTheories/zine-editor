/**
 * Frontend Constants - Loaded from Vite environment variables
 * All values are determined at build time via .env file
 * 
 * Security Note: Only VITE_* prefixed variables are accessible in browser
 * Sensitive keys like JWT_SECRET, STRIPE_SECRET_KEY stay backend-only
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'SVRN Publishing'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

// API Endpoints (derived from base URL)
// Note: API_BASE_URL already includes '/api' prefix
export const API = {
    AUTH: {
        REGISTER: `${API_BASE_URL}/auth/register`,
        LOGIN: `${API_BASE_URL}/auth/login`,
        LOGOUT: `${API_BASE_URL}/auth/logout`,
        VERIFY: `${API_BASE_URL}/auth/verify`,
    },
    ZINES: {
        LIST: `${API_BASE_URL}/zines`,
        CREATE: `${API_BASE_URL}/zines`,
        GET: (id) => `${API_BASE_URL}/zines/${id}`,
        UPDATE: (id) => `${API_BASE_URL}/zines/${id}`,
        DELETE: (id) => `${API_BASE_URL}/zines/${id}`,
        PUBLISH: (id) => `${API_BASE_URL}/zines/${id}/publish`,
        PUBLISHED: `${API_BASE_URL}/published`,
    },
    CREDITS: {
        GET_BALANCE: `${API_BASE_URL}/credits/balance`,
        GET_TRANSACTIONS: `${API_BASE_URL}/credits/transactions`,
    },
    PAYMENT: {
        INITIATE: `${API_BASE_URL}/payment/initiate`,
        CONFIRM: `${API_BASE_URL}/payment/confirm`,
    },
    WALLET: {
        GET: `${API_BASE_URL}/wallet`,
        CREATE: `${API_BASE_URL}/wallet/create`,
    },
}

// Feature flags (can be toggled via env vars if needed)
export const FEATURES = {
    ENABLE_XRP: true,
    ENABLE_MONETIZATION: true,
    ENABLE_REPUTATION: true,
    ENABLE_COMMENTS: false, // Coming soon
}

// Constants for UI/UX
export const CREDIT_PACKAGES = [
    { amount: 500, price: 5.00, label: '500 Credits' },
    { amount: 2500, price: 20.00, label: '2,500 Credits', popular: true },
    { amount: 5000, price: 35.00, label: '5,000 Credits' },
    { amount: 10000, price: 60.00, label: '10,000 Credits' },
]

// Validation constants
export const VALIDATION = {
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 30,
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    MIN_ZINE_TITLE_LENGTH: 1,
    MAX_ZINE_TITLE_LENGTH: 200,
}

// UI Theme constants
export const THEMES = {
    DEFAULT: 'default',
    DARK: 'dark',
    LIGHT: 'light',
}

// Canonical zine page size (half-letter / digest) — keep editor, preview, and exports in sync
export const PAGE_W = 528
export const PAGE_H = 816

// Toast notification durations (ms)
export const TOAST_DURATION = {
    SHORT: 2000,
    MEDIUM: 4000,
    LONG: 6000,
}

// Environment detection
export const ENV = {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE,
}

// Debug logging (only in dev)
if (ENV.isDev) {
    console.log(`%c[SVRN Publishing] ${APP_VERSION}`, 'color: #d4af37; font-weight: bold;')
    console.log(`%cAPI: ${API_BASE_URL}`, 'color: #8b5cf6;')
}
