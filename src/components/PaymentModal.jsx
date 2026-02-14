import React, { useState } from 'react'

const PaymentModal = ({ credits, onSuccess, onCancel }) => {
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
            const token = localStorage.getItem('vp_token')
            if (!token) throw new Error('Not authenticated')

            // Initiate payment
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

            // Simulate card validation delay
            await new Promise(r => setTimeout(r, 1500))

            // Confirm payment
            const confirmRes = await fetch('/api/payment/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: initiateData.sessionId,
                    credits
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
        <div className="payment-modal-overlay">
            <div className="payment-modal">
                <button className="modal-close" onClick={onCancel}>✕</button>

                <h2>💳 Enter Payment Details</h2>

                <div className="payment-summary">
                    <div className="summary-row">
                        <span>Credits:</span>
                        <span className="amount">{credits}</span>
                    </div>
                    <div className="summary-row">
                        <span>Price:</span>
                        <span className="amount">${credits}.00 USD</span>
                    </div>
                    <div className="summary-row">
                        <span>Rate:</span>
                        <span>$1 = 1 credit</span>
                    </div>
                </div>

                <form onSubmit={handlePayment}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Card Number</label>
                        <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                            placeholder="4242 4242 4242 4242"
                            maxLength="16"
                            required
                        />
                        <small>Test: 4242 4242 4242 4242</small>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
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
                        <div className="form-group">
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

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-actions">
                        <button type="button" onClick={onCancel} className="btn-cancel">
                            Cancel
                        </button>
                        <button type="submit" disabled={isProcessing} className="btn-pay">
                            {isProcessing ? 'Processing...' : `Pay $${credits}.00`}
                        </button>
                    </div>
                </form>

                <style>{`
                    .payment-modal-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    .payment-modal {
                        background: var(--vp-surface);
                        border: 1px solid var(--vp-border);
                        border-radius: 12px;
                        padding: 32px;
                        max-width: 450px;
                        width: 90%;
                        position: relative;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    }
                    .modal-close {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: var(--vp-text-dim);
                    }
                    .payment-modal h2 {
                        color: var(--vp-accent);
                        margin-bottom: 24px;
                        font-size: 1.6em;
                    }
                    .payment-summary {
                        background: var(--vp-surface2);
                        border: 1px solid var(--vp-border);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 24px;
                    }
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        font-size: 0.95em;
                    }
                    .summary-row:last-child {
                        margin-bottom: 0;
                    }
                    .summary-row .amount {
                        font-weight: 700;
                        color: var(--vp-accent);
                    }
                    .form-group {
                        margin-bottom: 16px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 6px;
                        font-size: 0.9em;
                        font-weight: 600;
                        color: var(--vp-text);
                    }
                    .form-group input {
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid var(--vp-border);
                        border-radius: 6px;
                        background: var(--vp-surface2);
                        color: var(--vp-text);
                        font-size: 0.95em;
                    }
                    .form-group input:focus {
                        outline: none;
                        border-color: var(--vp-accent);
                        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
                    }
                    .form-group small {
                        display: block;
                        margin-top: 4px;
                        font-size: 0.8em;
                        color: var(--vp-text-dim);
                    }
                    .form-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                    }
                    .error-message {
                        background: rgba(239, 68, 68, 0.1);
                        border: 1px solid #ef4444;
                        color: #ef4444;
                        padding: 12px;
                        border-radius: 6px;
                        margin-bottom: 16px;
                        font-size: 0.9em;
                    }
                    .form-actions {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-top: 24px;
                    }
                    .btn-cancel, .btn-pay {
                        padding: 12px 16px;
                        border: none;
                        border-radius: 6px;
                        font-size: 0.95em;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-cancel {
                        background: var(--vp-surface2);
                        border: 1px solid var(--vp-border);
                        color: var(--vp-text);
                    }
                    .btn-cancel:hover {
                        border-color: var(--vp-accent);
                    }
                    .btn-pay {
                        background: linear-gradient(135deg, var(--vp-accent), var(--vp-accent2));
                        color: #000;
                    }
                    .btn-pay:hover:not(:disabled) {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
                    }
                    .btn-pay:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                `}</style>
            </div>
        </div>
    )
}

export default PaymentModal
