
import React, { useState, useEffect } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'

const TokenMarketplace = () => {
    const { xrState, buyTokens, createTrustLine } = useXRPayID()
    const [tokens, setTokens] = useState([])
    const [sortBy, setSortBy] = useState('popular')
    const [buyAmount, setBuyAmount] = useState({})
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        loadTokens()
    }, [sortBy])

    const loadTokens = async () => {
        try {
            const res = await fetch(`/api/market?sort=${sortBy}`)
            const data = await res.json()
            setTokens(data)
        } catch (err) {
            console.error('Failed to load tokens:', err)
        }
    }

    const handleBuy = async (tokenId) => {
        const amount = buyAmount[tokenId]
        if (!amount || amount <= 0) return

        setIsLoading(true)
        setMessage(null)

        try {
            const result = await buyTokens(tokenId, amount)
            setMessage({ type: 'success', text: `Successfully bought ${amount} tokens for ${result.totalCost} credits!` })
            setBuyAmount({ ...buyAmount, [tokenId]: 0 })
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const handleTrustLine = async (tokenId) => {
        try {
            await createTrustLine(tokenId)
            setMessage({ type: 'success', text: 'Trust line created!' })
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }
    }

    const hasTrustLine = (tokenId) => {
        return xrState.trustLines.some(tl => tl.token_id === tokenId)
    }

    return (
        <div className="token-marketplace">
            <h3>🪙 Token Marketplace</h3>

            <div className="sort-controls">
                <label>Sort by:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="popular">Most Popular</option>
                    <option value="newest">Newest</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                </select>
            </div>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="token-grid">
                {tokens.map(token => (
                    <div key={token.id} className="token-card">
                        <div className="token-header">
                            <span className="token-name">{token.token_name}</span>
                            <span className="token-code">{token.token_code}</span>
                        </div>

                        <div className="token-creator">
                            by @{token.creator_name}
                        </div>

                        <div className="token-description">
                            {token.description || 'No description'}
                        </div>

                        <div className="token-stats">
                            <div className="stat">
                                <span className="label">Price</span>
                                <span className="value">{token.price_per_token} credits</span>
                            </div>
                            <div className="stat">
                                <span className="label">Available</span>
                                <span className="value">{token.current_supply?.toLocaleString()}</span>
                            </div>
                            <div className="stat">
                                <span className="label">Sold</span>
                                <span className="value">{((token.initial_supply || 0) - (token.current_supply || 0)).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="token-actions">
                            {!hasTrustLine(token.id) && (
                                <button
                                    className="trust-btn"
                                    onClick={() => handleTrustLine(token.id)}
                                >
                                    🔗 Create Trust Line
                                </button>
                            )}

                            <div className="buy-section">
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={buyAmount[token.id] || ''}
                                    onChange={(e) => setBuyAmount({
                                        ...buyAmount,
                                        [token.id]: parseInt(e.target.value) || 0
                                    })}
                                    min="1"
                                />
                                <button
                                    className="buy-btn"
                                    onClick={() => handleBuy(token.id)}
                                    disabled={isLoading || !buyAmount[token.id]}
                                >
                                    Buy
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {tokens.length === 0 && (
                <div className="empty-state">
                    No tokens available yet. Be the first to create one!
                </div>
            )}

            <style>{`
                .token-marketplace {
                    padding: 20px;
                }
                .token-marketplace h3 {
                    margin-top: 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .sort-controls {
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .sort-controls select {
                    padding: 8px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                    font-size: 14px;
                }
                .token-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }
                .token-card {
                    background: white;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 8px;
                    padding: 16px;
                }
                .token-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .token-name {
                    font-weight: bold;
                    font-size: 18px;
                    color: var(--ed-black, #1a1a1a);
                }
                .token-code {
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: monospace;
                }
                .token-creator {
                    color: var(--ed-gray, #34495e);
                    font-size: 14px;
                    margin-bottom: 8px;
                }
                .token-description {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 12px;
                    min-height: 40px;
                }
                .token-stats {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                    padding: 12px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 4px;
                }
                .stat {
                    display: flex;
                    flex-direction: column;
                }
                .stat .label {
                    font-size: 11px;
                    color: #666;
                    text-transform: uppercase;
                }
                .stat .value {
                    font-weight: bold;
                    color: var(--ed-crimson, #5c0a0a);
                }
                .token-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .trust-btn {
                    padding: 8px;
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                }
                .buy-section {
                    display: flex;
                    gap: 8px;
                }
                .buy-section input {
                    flex: 1;
                    padding: 8px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                }
                .buy-btn {
                    padding: 8px 16px;
                    background: var(--ed-gold, #d4af37);
                    color: var(--ed-black, #1a1a1a);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .buy-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: var(--ed-gray, #34495e);
                }
                .message {
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 16px;
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

export default TokenMarketplace

