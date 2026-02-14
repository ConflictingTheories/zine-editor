import React, { useState, useEffect } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'
import { useVP } from '../context/VPContext'

const TokenIssuance = () => {
    const { xrState, createToken } = useXRPayID()
    const { vpState } = useVP()
    const token = vpState.token
    const isLoggedIn = !!token
    const [formData, setFormData] = useState({
        tokenCode: '',
        tokenName: '',
        description: '',
        initialSupply: 1000000,
        pricePerToken: 0.01
    })
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [myTokens, setMyTokens] = useState([])

    // Load tokens created by current user
    useEffect(() => {
        const loadMyTokens = async () => {
            try {
                if (!token) return
                const res = await fetch('/api/tokens?mine=1', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const allTokens = await res.json()
                    // Filter from xrState tokens that match current user's creations
                    setMyTokens(allTokens.filter(t => xrState.tokens.some(xt => xt.id === t.id)))
                }
            } catch (err) {
                // Fallback: show all tokens from state
                setMyTokens(xrState.tokens)
            }
        }
        loadMyTokens()
    }, [xrState.tokens])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.tokenCode || !formData.tokenName) {
            setMessage({ type: 'error', text: 'Token code and name are required' })
            return
        }

        if (formData.tokenCode.length > 10) {
            setMessage({ type: 'error', text: 'Token code must be 10 characters or less' })
            return
        }

        setIsLoading(true)
        setMessage(null)

        try {
            const result = await createToken(
                formData.tokenCode,
                formData.tokenName,
                formData.description,
                formData.initialSupply,
                formData.pricePerToken
            )
            setMessage({ type: 'success', text: `Token ${formData.tokenName} created successfully!` })
            setFormData({
                tokenCode: '',
                tokenName: '',
                description: '',
                initialSupply: 1000000,
                pricePerToken: 0.01
            })
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    return (
        <div className="token-issuance">
            <h3>🪙 Issue Your Own Token</h3>

            <form onSubmit={handleSubmit} className="token-form">
                <div className="form-group">
                    <label>Token Code (Ticker Symbol)</label>
                    <input
                        type="text"
                        value={formData.tokenCode}
                        onChange={(e) => setFormData({
                            ...formData,
                            tokenCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
                        })}
                        placeholder="e.g., MYZINE"
                        maxLength={10}
                        required
                    />
                    <span className="hint">Max 10 characters, letters and numbers only</span>
                </div>

                <div className="form-group">
                    <label>Token Name</label>
                    <input
                        type="text"
                        value={formData.tokenName}
                        onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
                        placeholder="e.g., My Zine Coin"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe your token and what it represents..."
                        rows={3}
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Initial Supply</label>
                        <input
                            type="number"
                            value={formData.initialSupply}
                            onChange={(e) => setFormData({
                                ...formData,
                                initialSupply: parseInt(e.target.value) || 0
                            })}
                            min="1000"
                        />
                    </div>

                    <div className="form-group">
                        <label>Price per Token (credits)</label>
                        <input
                            type="number"
                            value={formData.pricePerToken}
                            onChange={(e) => setFormData({
                                ...formData,
                                pricePerToken: parseFloat(e.target.value) || 0
                            })}
                            min="0.0001"
                            step="0.0001"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="submit-btn"
                    disabled={isLoading || !isLoggedIn}
                >
                    {isLoading ? 'Creating...' : (isLoggedIn ? 'Issue Token' : 'Login to Issue')}
                </button>

                {!isLoggedIn && (
                    <div className="message error" style={{ marginTop: 8 }}>
                        You must be logged in to issue tokens. Open the auth modal to continue.
                    </div>
                )}

                {message && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}
            </form>

            {myTokens.length > 0 && (
                <div className="my-tokens">
                    <h4>Your Issued Tokens</h4>
                    <div className="tokens-list">
                        {myTokens.map(token => (
                            <div key={token.id} className="token-item">
                                <span className="token-name">{token.token_name}</span>
                                <span className="token-code">{token.token_code}</span>
                                <span className="token-supply">
                                    {(token.current_supply || 0).toLocaleString()} / {(token.initial_supply || 0).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                .token-issuance {
                    padding: 20px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 8px;
                }
                .token-issuance h3 {
                    margin-top: 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .token-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .form-group label {
                    font-weight: bold;
                    color: var(--ed-black, #1a1a1a);
                    font-size: 14px;
                }
                .form-group input,
                .form-group textarea {
                    padding: 10px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                    font-size: 14px;
                }
                .form-group input:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--ed-purple, #4b2c5e);
                }
                .hint {
                    font-size: 12px;
                    color: #666;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .submit-btn {
                    padding: 14px;
                    background: linear-gradient(135deg, var(--ed-purple, #4b2c5e), var(--ed-crimson, #5c0a0a));
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 8px;
                }
                .submit-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .message {
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
                .my-tokens {
                    margin-top: 24px;
                    padding-top: 24px;
                    border-top: 2px solid var(--ed-gray, #34495e);
                }
                .my-tokens h4 {
                    margin-top: 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .tokens-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .token-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: white;
                    border-radius: 4px;
                    border: 1px solid var(--ed-gray, #34495e);
                }
                .token-item .token-name {
                    font-weight: bold;
                    color: var(--ed-black, #1a1a1a);
                }
                .token-item .token-code {
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                .token-item .token-supply {
                    color: var(--ed-gray, #34495e);
                    font-size: 14px;
                }
            `}</style>
        </div>
    )
}

export default TokenIssuance

