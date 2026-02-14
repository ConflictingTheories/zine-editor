
import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useXRPayID } from '../context/XRPayIDContext'

const stripePromise = loadStripe('pk_test_51234567890987654321234567890') // Test key

const CreditPurchase = () => {
    const { xrState } = useXRPayID()
    const [amount, setAmount] = useState(100)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)

    const handlePurchase = async () => {
        if (amount <= 0) return
        setIsLoading(true)
        setMessage(null)

        try {
            const token = localStorage.getItem('vp_token')
            if (!token) throw new Error('Not authenticated')

            // Get checkout session from backend
            const sessionRes = await fetch('/api/stripe/checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ credits: amount })
            })

            const sessionData = await sessionRes.json()
            if (!sessionRes.ok) throw new Error(sessionData.error)

            // Redirect to Stripe checkout
            const stripe = await stripePromise
            const { error } = await stripe.redirectToCheckout({
                sessionId: sessionData.sessionId
            })

            if (error) {
                setMessage({ type: 'error', text: error.message })
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const presetAmounts = [10, 50, 100, 500, 1000]

    return (
        <div className="credit-purchase">
            <h3>💰 Purchase Credits</h3>

            <div className="balance-display">
                <span className="label">Current Balance:</span>
                <span className="value">{xrState.credits.toFixed(2)} credits</span>
            </div>

            <div className="preset-amounts">
                {presetAmounts.map(preset => (
                    <button
                        key={preset}
                        className={`preset-btn ${amount === preset ? 'active' : ''}`}
                        onClick={() => setAmount(preset)}
                    >
                        {preset}
                    </button>
                ))}
            </div>

            <div className="custom-amount">
                <label>Custom Amount:</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="1"
                />
            </div>

            <div className="price-display">
                <strong>Price: ${amount}.00 USD</strong>
                <small>$1 = 1 credit</small>
            </div>

            <button
                className="purchase-btn"
                onClick={handlePurchase}
                disabled={isLoading || amount <= 0}
            >
                {isLoading ? 'Redirecting to Stripe...' : `Pay $${amount}.00 with Stripe`}
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


