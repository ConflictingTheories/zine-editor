
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

        try {
            const res = await fetch('/api' + endpoint, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            })

            // Handle 401/403 gracefully - return null instead of throwing
            if (res.status === 401 || res.status === 403) {
                console.warn(`Auth required for ${endpoint}: ${res.status}`)
                return null
            }

            if (!res.ok) {
                // Try to parse error as JSON, fallback to text
                let errorMessage = 'Request failed'
                try {
                    const errorData = await res.json()
                    errorMessage = errorData.error || errorData.message || `HTTP ${res.status}`
                } catch (e) {
                    try {
                        const text = await res.text()
                        errorMessage = text || `HTTP ${res.status}`
                    } catch (textErr) {
                        errorMessage = `HTTP ${res.status}`
                    }
                }
                throw new Error(errorMessage)
            }

            // Handle empty responses
            const contentType = res.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                return null
            }

            return res.json()
        } catch (err) {
            console.error(`API error for ${endpoint}:`, err)
            throw err
        }
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
            const [walletRes, creditsRes, tokensRes, trustLinesRes, subsRes, bidsRes, transactionsRes, subscribersRes] = await Promise.all([
                api('/wallet').catch(() => null),
                api('/credits/balance').catch(() => null),
                api('/tokens').catch(() => null),
                api('/trustlines').catch(() => null),
                api('/subscriptions').catch(() => null),
                api('/bids').catch(() => null),
                api('/transactions').catch(() => null),
                api('/subscriptions/my-subscribers').catch(() => [])
            ])

            setXrState(prev => ({
                ...prev,
                wallet: walletRes || null,
                credits: creditsRes?.balance || 0,
                tokens: Array.isArray(tokensRes) ? tokensRes : [],
                trustLines: Array.isArray(trustLinesRes) ? trustLinesRes : [],
                subscriptions: Array.isArray(subsRes) ? subsRes : [],
                subscribers: Array.isArray(subscribersRes) ? subscribersRes : [],
                bids: Array.isArray(bidsRes) ? bidsRes : [],
                transactions: Array.isArray(transactionsRes) ? transactionsRes : [],
                isLoading: false,
                error: null
            }))
        } catch (err) {
            console.error('Failed to load XRPayID data:', err)
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
    const createToken = async (tokenData) => {
        try {
            const result = await api('/tokens/create', 'POST', tokenData)
            if (result === null) {
                throw new Error('Authentication required to create token')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to create token:', err)
            throw err
        }
    }

    const buyTokens = async (tokenId, amount) => {
        try {
            const result = await api(`/tokens/${tokenId}/buy`, 'POST', { amount })
            if (result === null) {
                throw new Error('Authentication required to buy tokens')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to buy tokens:', err)
            throw err
        }
    }


    // Trust line functions
    const createTrustLine = async (tokenId, limit) => {
        const result = await api('/trustlines', 'POST', { tokenId, limit })
        await loadData()
        return result
    }

    // Subscription functions
    const subscribe = async (creatorId, tokenId, amountPerPeriod) => {
        try {
            const result = await api('/subscriptions/subscribe', 'POST', {
                creatorId,
                tokenId,
                amountPerPeriod
            })
            if (result === null) {
                throw new Error('Authentication required to subscribe')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to subscribe:', err)
            throw err
        }
    }

    const cancelSubscription = async (subscriptionId) => {
        try {
            const result = await api('/subscriptions/cancel', 'POST', { subscriptionId })
            if (result === null) {
                throw new Error('Authentication required to cancel subscription')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to cancel subscription:', err)
            throw err
        }
    }

    // Bid functions
    const placeBid = async (zineId, amount, message) => {
        try {
            const result = await api('/bids/create', 'POST', { zineId, amount, message })
            if (result === null) {
                throw new Error('Authentication required to place bid')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to place bid:', err)
            throw err
        }
    }

    const acceptBid = async (bidId) => {
        try {
            const result = await api(`/bids/${bidId}/accept`, 'POST', {})
            if (result === null) {
                throw new Error('Authentication required to accept bid')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to accept bid:', err)
            throw err
        }
    }

    const rejectBid = async (bidId) => {
        try {
            const result = await api(`/bids/${bidId}/reject`, 'POST', {})
            if (result === null) {
                throw new Error('Authentication required to reject bid')
            }
            await loadData()
            return result
        } catch (err) {
            console.error('Failed to reject bid:', err)
            throw err
        }
    }

    // Reputation functions
    const getReputation = async (userId) => {
        try {
            const result = await api(`/reputation/${userId}`)
            return result
        } catch (err) {
            console.error('Failed to get reputation:', err)
            return null
        }
    }

    // Zine tokenization
    const setTokenGate = async (zineId, tokenPrice, isTokenGated) => {
        try {
            const result = await api(`/zines/${zineId}/token-gate`, 'POST', {
                tokenPrice,
                isTokenGated
            })
            if (result === null) {
                throw new Error('Authentication required to set token gate')
            }
            return result
        } catch (err) {
            console.error('Failed to set token gate:', err)
            throw err
        }
    }

    const checkAccess = async (zineId) => {
        try {
            const result = await api(`/zines/${zineId}/access`)
            return result
        } catch (err) {
            console.error('Failed to check access:', err)
            return { hasAccess: false }
        }
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
