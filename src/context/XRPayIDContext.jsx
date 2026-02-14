
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useVP } from './VPContext.jsx'

const XRPayIDContext = createContext()

export const useXRPayID = () => useContext(XRPayIDContext)

const XRPayIDProvider = ({ children }) => {
    const { vpState } = useVP()
    const token = vpState.token

    const [xrState, setXrState] = useState({
        wallet: null,
        credits: 0,
        tokens: [],
        trustLines: [],
        subscriptions: [],
        subscribers: [],
        bids: [],
        reputation: null,
        transactions: [],
        isLoading: true,
        error: null
    })

    const updateXrState = (updates) => {
        setXrState(prev => ({ ...prev, ...updates }))
    }

    // API helper
    const api = async (endpoint, method = 'GET', body = null) => {
        if (!token) {
            // If it's a GET request and we're not logged in, just return null
            // This prevents "Not authenticated" errors from breaking the state
            if (method === 'GET') return null
            throw new Error('Not authenticated')
        }

        const headers = { 'Content-Type': 'application/json' }
        headers['Authorization'] = `Bearer ${token}`

        const res = await fetch('/api' + endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        })

        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Request failed' }))
            // If session expired, don't crash the context, let VPContext handle logout
            throw new Error(error.error || 'Request failed')
        }

        return res.json()
    }

    // Load initial data
    const loadData = async () => {
        if (!token) {
            setXrState(prev => ({
                ...prev,
                wallet: null,
                credits: 0,
                tokens: [],
                trustLines: [],
                subscriptions: [],
                subscribers: [],
                bids: [],
                transactions: [],
                isLoading: false,
                error: null
            }))
            return
        }

        try {
            const [walletRes, creditsRes, tokensRes, trustLinesRes, subsRes, bidsRes, transactionsRes] = await Promise.all([
                api('/wallet').catch(() => ({ xrp_address: null, payid: null, is_verified: false })),
                api('/credits/balance').catch(() => ({ balance: 0 })),
                api('/tokens').catch(() => []),
                api('/trustlines').catch(() => []),
                api('/subscriptions').catch(() => []),
                api('/bids').catch(() => []),
                api('/transactions').catch(() => [])
            ])

            // Get subscribers
            let subscribersRes = []
            try {
                subscribersRes = await api('/subscriptions?type=subscribers')
            } catch (e) { }

            setXrState(prev => ({
                ...prev,
                wallet: walletRes,
                credits: creditsRes.balance || 0,
                tokens: tokensRes,
                trustLines: trustLinesRes,
                subscriptions: subsRes,
                subscribers: subscribersRes,
                bids: bidsRes,
                transactions: transactionsRes,
                isLoading: false,
                error: null
            }))
        } catch (err) {
            setXrState(prev => ({
                ...prev,
                isLoading: false,
                error: err.message
            }))
        }
    }

    useEffect(() => {
        loadData()
    }, [token])

    // Wallet functions
    const connectWallet = async (xrpAddress, payid) => {
        const result = await api('/wallet/create', 'POST', { xrpAddress, payid })
        await loadData()
        return result
    }

    // Credit functions
    const purchaseCredits = async (amount) => {
        const result = await api('/credits/purchase', 'POST', { amount, paymentMethod: 'simulated' })
        await loadData()
        return result
    }

    // Token functions
    const createToken = async (tokenCode, tokenName, description, initialSupply, pricePerToken) => {
        const result = await api('/tokens/create', 'POST', {
            tokenCode,
            tokenName,
            description,
            initialSupply,
            pricePerToken
        })
        await loadData()
        return result
    }

    const buyTokens = async (tokenId, amount) => {
        const result = await api(`/tokens/${tokenId}/buy`, 'POST', { amount })
        await loadData()
        return result
    }

    // Trust line functions
    const createTrustLine = async (tokenId, limit) => {
        const result = await api('/trustlines', 'POST', { tokenId, limit })
        await loadData()
        return result
    }

    // Subscription functions
    const subscribe = async (creatorId, tokenId, amountPerPeriod) => {
        const result = await api('/subscriptions/subscribe', 'POST', {
            creatorId,
            tokenId,
            amountPerPeriod
        })
        await loadData()
        return result
    }

    const cancelSubscription = async (subscriptionId) => {
        const result = await api('/subscriptions/cancel', 'POST', { subscriptionId })
        await loadData()
        return result
    }

    // Bid functions
    const placeBid = async (zineId, amount, message) => {
        const result = await api('/bids/create', 'POST', { zineId, amount, message })
        await loadData()
        return result
    }

    const acceptBid = async (bidId) => {
        const result = await api(`/bids/${bidId}/accept`, 'POST', {})
        await loadData()
        return result
    }

    const rejectBid = async (bidId) => {
        const result = await api(`/bids/${bidId}/reject`, 'POST', {})
        await loadData()
        return result
    }

    // Reputation functions
    const getReputation = async (userId) => {
        const result = await api(`/reputation/${userId}`)
        return result
    }

    // Zine tokenization
    const setTokenGate = async (zineId, tokenPrice, isTokenGated) => {
        const result = await api(`/zines/${zineId}/token-gate`, 'POST', {
            tokenPrice,
            isTokenGated
        })
        return result
    }

    const checkAccess = async (zineId) => {
        const result = await api(`/zines/${zineId}/access`)
        return result
    }

    const value = {
        xrState,
        updateXrState,
        loadData,
        api,
        // Wallet
        connectWallet,
        // Credits
        purchaseCredits,
        // Tokens
        createToken,
        buyTokens,
        // Trust Lines
        createTrustLine,
        // Subscriptions
        subscribe,
        cancelSubscription,
        // Bids
        placeBid,
        acceptBid,
        rejectBid,
        // Reputation
        getReputation,
        // Zine
        setTokenGate,
        checkAccess
    }

    return (
        <XRPayIDContext.Provider value={value}>
            {children}
        </XRPayIDContext.Provider>
    )
}

export { XRPayIDContext, XRPayIDProvider }

