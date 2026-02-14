import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useXRPayID } from '../context/XRPayIDContext'
import { useVP } from '../context/VPContext'

const CreditPurchase = () => {
    const { xrState } = useXRPayID()
    const { vpState } = useVP()
    const token = vpState.token
    const [amount, setAmount] = useState(10)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [stripePromise, setStripePromise] = useState(null)
    const [stripeEnabled, setStripeEnabled] = useState(false)
    const [isConfigLoading, setIsConfigLoading] = useState(true)

    useEffect(() => {
        setIsConfigLoading(true)
        fetch('/api/stripe/config')
            .then(r => r.json())
            .then(cfg => {
                if (cfg && cfg.publishableKey) {
                    setStripePromise(loadStripe(cfg.publishableKey))
                }
                setStripeEnabled(!!cfg?.enabled)
            })
            .catch((err) => {
                console.error('Failed to load Stripe config:', err)
                setStripeEnabled(false)
                setMessage({ type: 'error', text: 'Failed to load payment configuration' })
            })
            .finally(() => setIsConfigLoading(false))
    }, [])

    const handlePurchase = async () => {
        if (amount <= 0) return
        setIsLoading(true)
        setMessage(null)

        try {
            if (!token) throw new Error('Not authenticated')

            const sessionRes = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amountUSD: amount })
            })

            const sessionData = await sessionRes.json()
            if (!sessionRes.ok) throw new Error(sessionData.error)

            if (stripePromise && !sessionData.simulated) {
                const stripe = await stripePromise
                const { error } = await stripe.redirectToCheckout({ sessionId: sessionData.sessionId })
                if (error) setMessage({ type: 'error', text: error.message })
                return
            }

            await fetch('/api/stripe/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ sessionId: sessionData.sessionId })
            })

            window.location.reload()
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const presetAmounts = [5, 10, 25, 50, 100]

    return (
        <div style={{ background: 'var(--vp-surface)', border: '1px solid var(--vp-border)', borderRadius: '16px', padding: '2rem', maxWidth: '500px' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.4rem' }}>💰 Purchase Credits</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'var(--vp-primary)', color: 'white', borderRadius: '10px', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <span style={{ fontWeight: 600 }}>Current Balance</span>
                <span style={{ fontWeight: 800, color: 'var(--vp-accent)' }}>{xrState.credits.toLocaleString()} VPC</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {presetAmounts.map(preset => (
                    <button
                        key={preset}
                        className={`filter-tag ${amount === preset ? 'active' : ''}`}
                        onClick={() => setAmount(preset)}
                        style={{ padding: '8px 16px', fontWeight: 700 }}
                    >
                        ${preset}
                    </button>
                ))}
            </div>

            <div className="form-row">
                <label>Custom USD Amount</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="1"
                />
            </div>

            <div style={{ padding: '1.25rem', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid var(--vp-accent-glow)', borderRadius: '10px', marginBottom: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--vp-accent)', marginBottom: '0.25rem' }}>Price: ${amount}.00 USD</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--vp-text-dim)' }}>$1 = 100 VPC (Void Press Credits)</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>You'll receive {amount * 100} VPC</div>
            </div>

            <button
                className="btn-premium"
                onClick={handlePurchase}
                disabled={isLoading || amount <= 0 || isConfigLoading || !stripeEnabled}
                style={{ width: '100%' }}
            >
                {isConfigLoading ? 'Loading payment system...' :
                    isLoading ? 'Redirecting to Stripe...' :
                        !stripeEnabled ? 'Payment System Unavailable' :
                            `Pay $${amount}.00 with Stripe`}
            </button>

            {message && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', textAlign: 'center', background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(40, 167, 69, 0.1)', color: message.type === 'error' ? '#ef4444' : '#28a745', border: `1px solid ${message.type === 'error' ? '#ef4444' : '#28a745'}` }}>
                    {message.text}
                </div>
            )}
        </div>
    )
}

export default CreditPurchase


