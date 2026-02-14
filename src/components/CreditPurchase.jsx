import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useXRPayID } from '../context/XRPayIDContext'
import { useVP } from '../context/VPContext'

const CreditPurchase = () => {
    const { xrState } = useXRPayID()
    const [amount, setAmount] = useState(10) // amount in USD
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [stripePromise, setStripePromise] = useState(null)
    const [stripeEnabled, setStripeEnabled] = useState(false)

    const [isConfigLoading, setIsConfigLoading] = useState(true)

    useEffect(() => {
        // Load publishable key from server
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
            const token = localStorage.getItem('vp_token')
            if (!token) throw new Error('Not authenticated')

            // Create Stripe session on backend (amount in USD)
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

            // If Stripe is enabled, redirect to Stripe Checkout
            if (stripePromise && !sessionData.simulated) {
                const stripe = await stripePromise
                const { error } = await stripe.redirectToCheckout({ sessionId: sessionData.sessionId })
                if (error) setMessage({ type: 'error', text: error.message })
                // Stripe will redirect back to /dashboard with session_id
                return
            }

            // Fallback (mock): immediately confirm payment with backend
            await fetch('/api/stripe/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ sessionId: sessionData.sessionId })
            })

            // Refresh XR data
            window.location.reload()
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const presetAmounts = [5, 10, 25, 50, 100]

    return (
        <div className="credit-purchase">
            <h3>💰 Purchase Credits</h3>

            <div className="balance-display">
                <span className="label">Current Balance:</span>
                <span className="value">{xrState.credits.toLocaleString()} VPC</span>
            </div>

            <div className="preset-amounts">
                {presetAmounts.map(preset => (
                    <button
                        key={preset}
                        className={`preset-btn ${amount === preset ? 'active' : ''}`}
                        onClick={() => setAmount(preset)}
                    >
                        ${preset}
                    </button>
                ))}
            </div>

            <div className="custom-amount">
                <label>Custom USD Amount:</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="1"
                />
            </div>

            <div className="price-display">
                <strong>Price: ${amount}.00 USD</strong>
                <small>$1 = 100 VPC (Void Press Credits)</small>
                <div style={{ marginTop: 6 }}><em>You'll receive {amount * 100} VPC after payment</em></div>
            </div>

            <button
                className="purchase-btn"
                onClick={handlePurchase}
                disabled={isLoading || amount <= 0 || isConfigLoading || !stripeEnabled}
            >
                {isConfigLoading ? 'Loading payment system...' :
                    isLoading ? 'Redirecting to Stripe...' :
                        !stripeEnabled ? 'Payment System Unavailable' :
                            `Pay $${amount}.00 with Stripe`}
            </button>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <style>{`
                .credit-purchase {
                    padding: 20px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 8px;
                    max-width: 500px;
                }
                .credit-purchase h3 {
                    margin-top: 0;
                    color: var(--ed-black, #1a1a1a);
                    margin-bottom: 20px;
                }
                .balance-display {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    border-radius: 6px;
                    margin-bottom: 20px;
                }
                .preset-amounts {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-bottom: 16px;
                }
                .preset-btn {
                    padding: 8px 16px;
                    border: 2px solid var(--ed-crimson, #5c0a0a);
                    background: transparent;
                    color: var(--ed-crimson, #5c0a0a);
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .preset-btn.active, .preset-btn:hover {
                    background: var(--ed-crimson, #5c0a0a);
                    color: white;
                }
                .custom-amount {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .custom-amount input {
                    padding: 8px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                    width: 100px;
                    font-size: 16px;
                }
                .price-display {
                    padding: 12px;
                    background: rgba(212, 175, 55, 0.15);
                    border-radius: 4px;
                    margin-bottom: 16px;
                    text-align: center;
                }
                .price-display strong {
                    display: block;
                    font-size: 1.2em;
                    color: var(--ed-gold, #d4af37);
                    margin-bottom: 4px;
                }
                .price-display small {
                    color: var(--ed-gray, #34495e);
                }
                .purchase-btn {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, var(--ed-gold, #d4af37), var(--ed-crimson, #5c0a0a));
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                }
                .purchase-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .message {
                    margin-top: 12px;
                    padding: 10px;
                    border-radius: 4px;
                    text-align: center;
                }
                .message.success {
                    background: #d4edda;
                    color: #155724;
                }
                .message.error {
                    background: #f8d7da;
                    color: #721c24;
                }
            `}</style>
        </div>
    )
}

export default CreditPurchase


