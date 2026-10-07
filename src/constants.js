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

/**
 * Print sizes for Portfolio books, in inches, and their bleed.
 *
 * A photography book is not a screen layout that gets exported to a PDF. It is a
 * bound object: the page is trim size, the margin is what the binding eats, and
 * a photograph that runs to the edge needs bleed so the trim does not leave a
 * white hairline. Without this the canvas size was a hardcoded pixel number, so
 * every "export" produced pages that were the wrong physical size and could not
 * be printed without white edges.
 *
 * Sizes are the standard photographic ones a photographer would actually ask
 * for. `spread` is the *page*; a landscape spread is two pages side by side.
 */
export const PAPER_SIZES = {
    'digest': { label: 'Digest', w: 5.5, h: 8.5 },
    'a5': { label: 'A5', w: 5.83, h: 8.27 },
    'a4': { label: 'A4', w: 8.27, h: 11.69 },
    'letter': { label: 'US Letter', w: 8.5, h: 11 },
    'tabloid': { label: 'Tabloid', w: 11, h: 17 },
    'square': { label: 'Square', w: 10, h: 10 },
    'wide': { label: 'Wide landscape', w: 10, h: 8 },
    'panorama': { label: 'Panorama', w: 13.33, h: 7.5 }
}

/** Default bleed added outside the trim, in inches. */
export const DEFAULT_BLEED = 0.125

/** Default inside margin lost to the binding, in inches. */
export const DEFAULT_GUTTER = 0.25

/**
 * Convert a paper size to canvas pixels at the given DPI.
 *
 * 150 DPI is the working resolution for on-screen layout and matte compositing;
 * export raises it to 300 for print. Keeping the two explicit stops the classic
 * bug where a layout is composed at one scale and exported at another, so the
 * matte ratios in the preview do not match the book.
 */
export const paperToPixels = (sizeKey, dpi = 150) => {
    const size = PAPER_SIZES[sizeKey] || PAPER_SIZES.digest
    return {
        width: Math.round(size.w * dpi),
        height: Math.round(size.h * dpi),
        dpi,
        bleed: Math.round(DEFAULT_BLEED * dpi),
        gutter: Math.round(DEFAULT_GUTTER * dpi)
    }
}

/** The default paper size a new portfolio book starts on. */
export const DEFAULT_PAPER = 'digest'

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
