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

// ── Feature flags ─────────────────────────────────────────────────────────────
// Phase 1 is a single-account authoring build: every mode works offline against
// local storage, and the network layer is there but not load-bearing.
//
// The economy and reputation stack is Phase 2. It is real code and stays
// reachable, but it must stay OFF until the authoring experience is finished,
// because with it on every single boot fires seven requests that all 404 while
// the local API is not running — which buries genuine failures in noise and
// makes the console useless for diagnosing anything else.
export const PHASE = 1

export const FEATURES = {
    PHASE,
    // Phase 2 features. Flip PHASE to 2 when the authoring experience is done.
    ENABLE_XRP: PHASE >= 2,
    ENABLE_MONETIZATION: PHASE >= 2,
    ENABLE_REPUTATION: PHASE >= 2,
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
