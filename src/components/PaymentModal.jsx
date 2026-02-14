import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'

const PaymentModal = ({ credits, onSuccess, onCancel }) => {
    const { vpState } = useVP()
    const token = vpState.token
    const [cardNumber, setCardNumber] = useState('4242424242424242')
    const [cardExpiry, setCardExpiry] = useState('12/25')
    const [cardCvc, setCardCvc] = useState('123')
    const [email, setEmail] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState(null)

    const handlePayment = async (e) => {
        e.preventDefault()
        setError(null)
        setIsProcessing(true)

        try {
            if (!token) throw new Error('Not authenticated')

            const initiateRes = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    credits,
                    cardLast4: cardNumber.slice(-4),
                    billingEmail: email
                })
            })

            const initiateData = await initiateRes.json()
            if (!initiateRes.ok) throw new Error(initiateData.error)

            await new Promise(r => setTimeout(r, 1500))

            const confirmRes = await fetch('/api/stripe/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: initiateData.sessionId
                })
            })

            const confirmData = await confirmRes.json()
            if (!confirmRes.ok) throw new Error(confirmData.error)

            onSuccess(confirmData.newBalance)
        } catch (err) {
            setError(err.message)
        }

        setIsProcessing(false)
    }

    return (
        <div className="premium-modal-overlay active">
            <div className="premium-modal-box" style={{ maxWidth: '450px' }}>
                <button className="premium-modal-close" onClick={onCancel}>✕</button>

                <h2 className="premium-modal-h2">💳 Payment Details</h2>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--vp-border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--vp-text-dim)' }}>Credits:</span>
                        <span style={{ fontWeight: 700, color: 'var(--vp-accent)' }}>{credits} VPC</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--vp-text-dim)' }}>Price:</span>
                        <span style={{ fontWeight: 700, color: 'var(--vp-accent)' }}>${credits}.00 USD</span>
                    </div>
                </div>

                <form onSubmit={handlePayment}>
                    <div className="form-row">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <label>Card Number</label>
                        <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                            placeholder="4242 4242 4242 4242"
                            maxLength="16"
                            required
                        />
                        <small style={{ display: 'block', marginTop: '4px', fontSize: '0.7rem', color: 'var(--vp-text-dim)' }}>Test: 4242 4242 4242 4242</small>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-row">
                            <label>Expiry Date</label>
                            <input
                                type="text"
                                value={cardExpiry}
                                onChange={(e) => setCardExpiry(e.target.value)}
                                placeholder="MM/YY"
                                maxLength="5"
                                required
                            />
                        </div>
                        <div className="form-row">
                            <label>CVC</label>
                            <input
                                type="text"
                                value={cardCvc}
                                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                placeholder="123"
                                maxLength="3"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem', marginTop: '2rem' }}>
                        <button type="button" onClick={onCancel} className="filter-tag" style={{ background: 'transparent', border: '1px solid var(--vp-border)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isProcessing} className="btn-premium">
                            {isProcessing ? 'Processing...' : `Pay $${credits}.00`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default PaymentModal
