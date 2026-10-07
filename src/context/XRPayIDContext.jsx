/*
 * Context: XRPayIDContext
 *
 * STUBBED (P5, 2026-10-06): the XRP/PayID wallet, token, trustline and
 * sovereign-identity backend was deleted — every endpoint this context
 * called 404'd. The live payment rail is Stripe -> credit vault
 * (server/economyService.cjs + vaultService.cjs, /api/account/* routes).
 *
 * When monetization UI is un-gated (PHASE 2), rewrite this provider against
 * /api/account, /api/account/ledger and /api/account/topup. Until then it
 * exposes a disabled state and makes no network calls.
 */

import React, { createContext, useContext } from 'react'

const XRPayIDContext = createContext()

export const useXRPayID = () => useContext(XRPayIDContext)

const disabledState = {
    enabled: false,
    wallet: null,
    credits: 0,
    tokens: [],
    trustLines: [],
    subscriptions: [],
    subscribers: [],
    bids: [],
    reputation: null,
    transactions: [],
    isLoading: false,
    error: null
}

const XRPayIDProvider = ({ children }) => {
    const value = {
        xrState: disabledState,
        // No-op placeholders kept so any lingering call sites don't crash.
        refresh: async () => disabledState,
        updateXrState: () => {}
    }
    return <XRPayIDContext.Provider value={value}>{children}</XRPayIDContext.Provider>
}

export { XRPayIDProvider }
export default XRPayIDContext
