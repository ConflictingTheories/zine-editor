
import React, { useState } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'

const SubscriptionManager = () => {
    const { xrState, subscribe, cancelSubscription } = useXRPayID()
    const [subscribeTo, setSubscribeTo] = useState('')
    const [amount, setAmount] = useState(10)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)

    const handleSubscribe = async () => {
        if (!subscribeTo || !amount) return

        setIsLoading(true)
        setMessage(null)

        try {
            // Parse creator ID from input (format: "id:username" or just id)
            const [creatorId] = subscribeTo.split(':')
            const tokenId = xrState.tokens[0]?.id // Use first available token

            if (!tokenId) {
                setMessage({ type: 'error', text: 'No tokens available for subscription' })
                setIsLoading(false)
                return
            }

            await subscribe(parseInt(creatorId), tokenId, amount)
            setMessage({ type: 'success', text: 'Subscription successful!' })
            setSubscribeTo('')
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const handleCancel = async (subscriptionId) => {
        setIsLoading(true)

        try {
            await cancelSubscription(subscriptionId)
            setMessage({ type: 'success', text: 'Subscription cancelled' })
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    return (
        <div className="subscription-manager">
            <h3>📜 Subscriptions</h3>

            {/* My Subscriptions */}
            <div className="section">
                <h4>My Subscriptions</h4>
                {xrState.subscriptions.length === 0 ? (
                    <p className="empty">No active subscriptions</p>
                ) : (
                    <div className="subscription-list">
                        {xrState.subscriptions.map(sub => (
                            <div key={sub.id} className="subscription-item">
                                <div className="sub-info">
                                    <span className="creator-name">@{sub.creator_name}</span>
                                    <span className="sub-amount">{sub.amount_per_period} credits/{sub.period_days} days</span>
                                </div>
                                <button
                                    className="cancel-btn"
                                    onClick={() => handleCancel(sub.id)}
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* My Subscribers */}
            <div className="section">
                <h4>My Subscribers</h4>
                {xrState.subscribers.length === 0 ? (
                    <p className="empty">No subscribers yet</p>
                ) : (
                    <div className="subscriber-list">
                        {xrState.subscribers.map(sub => (
                            <div key={sub.id} className="subscriber-item">
                                <span className="subscriber-name">@{sub.subscriber_name}</span>
                                <span className="sub-amount">{sub.amount_per_period} credits</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Subscribe to Creator */}
            <div className="section subscribe-form">
                <h4>Subscribe to a Creator</h4>
                <p className="hint">Enter creator's user ID to subscribe</p>

                <div className="form-row">
                    <input
                        type="number"
                        placeholder="Creator User ID"
                        value={subscribeTo}
                        onChange={(e) => setSubscribeTo(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Amount"
                        value={amount}
                        onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                        min="1"
                    />
                </div>

                <button
                    className="subscribe-btn"
                    onClick={handleSubscribe}
                    disabled={isLoading || !subscribeTo}
                >
                    {isLoading ? 'Processing...' : 'Subscribe'}
                </button>

                {message && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}
            </div>

            <style>{`
                .subscription-manager {
                    padding: 20px;
                }
                .subscription-manager h3 {
                    margin-top: 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .section {
                    margin-bottom: 24px;
                }
                .section h4 {
                    margin: 0 0 12px 0;
                    color: var(--ed-purple, #4b2c5e);
                }
                .empty {
                    color: var(--ed-gray, #34495e);
                    font-style: italic;
                }
                .subscription-list, .subscriber-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .subscription-item, .subscriber-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: white;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 6px;
                }
                .sub-info, .subscriber-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .creator-name, .subscriber-name {
                    font-weight: bold;
                    color: var(--ed-black, #1a1a1a);
                }
                .sub-amount {
                    font-size: 13px;
                    color: var(--ed-crimson, #5c0a0a);
                }
                .cancel-btn {
                    padding: 6px 12px;
                    background: var(--ed-crimson, #5c0a0a);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .subscribe-form {
                    padding: 16px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 8px;
                }
                .hint {
                    font-size: 13px;
                    color: #666;
                    margin: 0 0 12px 0;
                }
                .form-row {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .form-row input {
                    flex: 1;
                    padding: 10px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                }
                .subscribe-btn {
                    width: 100%;
                    padding: 12px;
                    background: var(--ed-gold, #d4af37);
                    color: var(--ed-black, #1a1a1a);
                    border: none;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                }
                .subscribe-btn:disabled {
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

export default SubscriptionManager

