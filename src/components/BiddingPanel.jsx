
import React, { useState } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'

const BiddingPanel = ({ zineId, zineTitle, onClose }) => {
    const { xrState, placeBid, acceptBid, rejectBid } = useXRPayID()
    const [amount, setAmount] = useState(50)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [resultMessage, setResultMessage] = useState(null)

    // Get bids for this zine
    const zineBids = xrState.bids.filter(b => b.zine_id === zineId)

    const handlePlaceBid = async () => {
        if (!amount || amount <= 0) return

        setIsLoading(true)
        setResultMessage(null)

        try {
            await placeBid(zineId, amount, message)
            setResultMessage({ type: 'success', text: 'Bid placed successfully!' })
            setMessage('')
        } catch (err) {
            setResultMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const handleAccept = async (bidId) => {
        setIsLoading(true)

        try {
            await acceptBid(bidId)
            setResultMessage({ type: 'success', text: 'Bid accepted!' })
        } catch (err) {
            setResultMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const handleReject = async (bidId) => {
        setIsLoading(true)

        try {
            await rejectBid(bidId)
            setResultMessage({ type: 'success', text: 'Bid rejected' })
        } catch (err) {
            setResultMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const isOwner = (bid) => {
        // Check if current user owns the zine
        return false // Will be determined by parent component
    }

    return (
        <div className="bidding-panel">
            <div className="panel-header">
                <h3>💰 Bid on Content</h3>
                {onClose && <button className="close-btn" onClick={onClose}>×</button>}
            </div>

            <div className="zine-info">
                <span className="label">Zine:</span>
                <span className="title">{zineTitle || `Zine #${zineId}`}</span>
            </div>

            {/* Place Bid Form */}
            <div className="place-bid-section">
                <h4>Place Your Bid</h4>

                <div className="bid-input">
                    <label>Amount (credits):</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                        min="1"
                    />
                </div>

                <div className="bid-message">
                    <label>Message (optional):</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Add a message to your bid..."
                        rows={2}
                    />
                </div>

                <button
                    className="place-bid-btn"
                    onClick={handlePlaceBid}
                    disabled={isLoading || amount <= 0}
                >
                    {isLoading ? 'Placing...' : `Place Bid (${amount} credits)`}
                </button>

                {resultMessage && (
                    <div className={`result-message ${resultMessage.type}`}>
                        {resultMessage.text}
                    </div>
                )}
            </div>

            {/* Existing Bids */}
            <div className="existing-bids">
                <h4>Current Bids</h4>

                {zineBids.length === 0 ? (
                    <p className="empty">No bids yet</p>
                ) : (
                    <div className="bids-list">
                        {zineBids.map(bid => (
                            <div key={bid.id} className={`bid-item ${bid.status}`}>
                                <div className="bid-info">
                                    <span className="bidder">@{bid.bidder_name}</span>
                                    <span className="amount">{bid.amount} credits</span>
                                    <span className={`status ${bid.status}`}>{bid.status}</span>
                                </div>
                                {bid.message && (
                                    <p className="bid-message">{bid.message}</p>
                                )}
                                {bid.status === 'pending' && (
                                    <div className="bid-actions">
                                        <button
                                            className="accept-btn"
                                            onClick={() => handleAccept(bid.id)}
                                            disabled={isLoading}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="reject-btn"
                                            onClick={() => handleReject(bid.id)}
                                            disabled={isLoading}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .bidding-panel {
                    padding: 20px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 8px;
                }
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .panel-header h3 {
                    margin: 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--ed-gray, #34495e);
                }
                .zine-info {
                    padding: 12px;
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    border-radius: 6px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 8px;
                }
                .zine-info .label {
                    font-weight: bold;
                }
                .place-bid-section {
                    margin-bottom: 24px;
                }
                .place-bid-section h4 {
                    margin: 0 0 12px 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .bid-input, .bid-message {
                    margin-bottom: 12px;
                }
                .bid-input label, .bid-message label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .bid-input input, .bid-message textarea {
                    width: 100%;
                    padding: 10px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .place-bid-btn {
                    width: 100%;
                    padding: 12px;
                    background: var(--ed-gold, #d4af37);
                    color: var(--ed-black, #1a1a1a);
                    border: none;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                }
                .place-bid-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .existing-bids h4 {
                    margin: 0 0 12px 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .empty {
                    color: var(--ed-gray, #34495e);
                    font-style: italic;
                }
                .bids-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .bid-item {
                    padding: 12px;
                    background: white;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 6px;
                }
                .bid-item.accepted {
                    border-color: #28a745;
                }
                .bid-item.rejected {
                    border-color: #dc3545;
                    opacity: 0.6;
                }
                .bid-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .bidder {
                    font-weight: bold;
                    color: var(--ed-black, #1a1a1a);
                }
                .amount {
                    color: var(--ed-crimson, #5c0a0a);
                    font-weight: bold;
                }
                .status {
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 4px;
                }
                .status.pending {
                    background: #ffc107;
                    color: #000;
                }
                .status.accepted {
                    background: #28a745;
                    color: white;
                }
                .status.rejected {
                    background: #dc3545;
                    color: white;
                }
                .bid-message {
                    margin: 8px 0 0 0;
                    font-size: 13px;
                    color: #666;
                }
                .bid-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .accept-btn, .reject-btn {
                    flex: 1;
                    padding: 8px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .accept-btn {
                    background: #28a745;
                    color: white;
                }
                .reject-btn {
                    background: #dc3545;
                    color: white;
                }
                .result-message {
                    margin-top: 12px;
                    padding: 10px;
                    border-radius: 4px;
                    text-align: center;
                }
                .result-message.success {
                    background: #d4edda;
                    color: #155724;
                }
                .result-message.error {
                    background: #f8d7da;
                    color: #721c24;
                }
            `}</style>
        </div>
    )
}

export default BiddingPanel

