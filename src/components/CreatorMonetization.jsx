
import React, { useState, useEffect } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'

const CreatorMonetization = () => {
    const { xrState, getReputation, setTokenGate } = useXRPayID()
    const isLoggedIn = !!localStorage.getItem('vp_token')
    const [activeTab, setActiveTab] = useState('overview')
    const [reputation, setReputation] = useState(null)
    const [gateSettings, setGateSettings] = useState({
        zineId: '',
        tokenPrice: 0,
        isTokenGated: false
    })

    useEffect(() => {
        loadReputation()
    }, [])

    const loadReputation = async () => {
        try {
            // Get current user's reputation
            const token = localStorage.getItem('vp_token')
            if (token) {
                const decoded = JSON.parse(atob(token.split('.')[1]))
                const rep = await getReputation(decoded.id)
                setReputation(rep)
            }
        } catch (err) {
            console.error('Failed to load reputation:', err)
        }
    }

    const handleSetGate = async () => {
        if (!gateSettings.zineId) return

        try {
            await setTokenGate(
                parseInt(gateSettings.zineId),
                gateSettings.tokenPrice,
                gateSettings.isTokenGated
            )
            alert('Token gating updated!')
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const getLevelColor = (level) => {
        const colors = {
            newcomer: '#6c757d',
            supporter: '#17a2b8',
            contributor: '#28a745',
            established: '#ffc107',
            master: '#fd7e14',
            legendary: '#dc3545'
        }
        return colors[level] || '#6c757d'
    }

    return (
        <div className="creator-monetization">
            <h3>💎 Creator Monetization</h3>

            {/* Stats Overview */}
            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-icon">💰</span>
                    <span className="stat-value">{xrState.credits.toFixed(2)}</span>
                    <span className="stat-label">Credits</span>
                </div>
                <div className="stat-card">
                    <span className="stat-icon">👥</span>
                    <span className="stat-value">{xrState.subscribers.length}</span>
                    <span className="stat-label">Subscribers</span>
                </div>
                <div className="stat-card">
                    <span className="stat-icon">🪙</span>
                    <span className="stat-value">{xrState.tokens.length}</span>
                    <span className="stat-label">Tokens</span>
                </div>
                <div className="stat-card">
                    <span className="stat-icon">⭐</span>
                    <span className="stat-value">{reputation?.score || 0}</span>
                    <span className="stat-label">Reputation</span>
                </div>
            </div>

            {/* Reputation Level */}
            {reputation && (
                <div className="reputation-banner" style={{ borderColor: getLevelColor(reputation.level) }}>
                    <div className="rep-level" style={{ background: getLevelColor(reputation.level) }}>
                        {reputation.level?.toUpperCase()}
                    </div>
                    <div className="rep-details">
                        <span className="rep-score">{reputation.score} points</span>
                        <span className="rep-stats">
                            {reputation.total_subscribers} subscribers • {reputation.total_content_sold} content sold
                        </span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={activeTab === 'gating' ? 'active' : ''}
                    onClick={() => setActiveTab('gating')}
                >
                    Token Gating
                </button>
                <button
                    className={activeTab === 'transactions' ? 'active' : ''}
                    onClick={() => setActiveTab('transactions')}
                >
                    Transactions
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-tab">
                        <div className="overview-section">
                            <h4>Quick Stats</h4>
                            <div className="quick-stats">
                                <div className="quick-stat">
                                    <span className="qs-label">Trust Lines</span>
                                    <span className="qs-value">{xrState.trustLines.length}</span>
                                </div>
                                <div className="quick-stat">
                                    <span className="qs-label">Active Bids</span>
                                    <span className="qs-value">{xrState.bids.filter(b => b.status === 'pending').length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="overview-section">
                            <h4>My Subscribers</h4>
                            {xrState.subscribers.length === 0 ? (
                                <p className="empty">No subscribers yet. Share your work to attract fans!</p>
                            ) : (
                                <ul className="subscriber-list">
                                    {xrState.subscribers.slice(0, 5).map(sub => (
                                        <li key={sub.id}>
                                            <span>@{sub.subscriber_name}</span>
                                            <span className="sub-amount">{sub.amount_per_period} credits</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'gating' && (
                    <div className="gating-tab">
                        <h4>Set Token Gating</h4>
                        <p className="hint">
                            Gate your content so only subscribers or those who purchased access can view it.
                        </p>

                        <div className="gate-form">
                            <div className="form-group">
                                <label>Zine ID</label>
                                <input
                                    type="number"
                                    value={gateSettings.zineId}
                                    onChange={(e) => setGateSettings({ ...gateSettings, zineId: e.target.value })}
                                    placeholder="Enter Zine ID"
                                />
                            </div>

                            <div className="form-group">
                                <label>Token Price (credits)</label>
                                <input
                                    type="number"
                                    value={gateSettings.tokenPrice}
                                    onChange={(e) => setGateSettings({
                                        ...gateSettings,
                                        tokenPrice: parseInt(e.target.value) || 0
                                    })}
                                    min="0"
                                />
                            </div>

                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={gateSettings.isTokenGated}
                                        onChange={(e) => setGateSettings({
                                            ...gateSettings,
                                            isTokenGated: e.target.checked
                                        })}
                                    />
                                    Enable Token Gating
                                </label>
                            </div>

                            <button className="save-btn" onClick={handleSetGate} disabled={!isLoggedIn}>
                                {isLoggedIn ? 'Save Settings' : 'Login to Save'}
                            </button>

                            {!isLoggedIn && (
                                <div style={{ marginTop: 8 }} className="hint">You must be logged in to update monetization settings.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="transactions-tab">
                        <h4>Transaction History</h4>
                        {xrState.transactions.length === 0 ? (
                            <p className="empty">No transactions yet</p>
                        ) : (
                            <div className="transactions-list">
                                {xrState.transactions.map(tx => (
                                    <div key={tx.id} className="transaction-item">
                                        <div className="tx-info">
                                            <span className="tx-type">{tx.type.replace(/_/g, ' ')}</span>
                                            <span className="tx-desc">{tx.description}</span>
                                        </div>
                                        <div className="tx-amount">
                                            {tx.amount} {tx.token_name || 'credits'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .creator-monetization {
                    padding: 20px;
                }
                .creator-monetization h3 {
                    margin-top: 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .stat-card {
                    background: white;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 8px;
                    padding: 16px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .stat-icon {
                    font-size: 24px;
                }
                .stat-value {
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--ed-purple, #4b2c5e);
                }
                .stat-label {
                    font-size: 12px;
                    color: #666;
                    text-transform: uppercase;
                }
                .reputation-banner {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: white;
                    border: 3px solid;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .rep-level {
                    padding: 8px 16px;
                    color: white;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .rep-details {
                    display: flex;
                    flex-direction: column;
                }
                .rep-score {
                    font-weight: bold;
                    font-size: 18px;
                    color: var(--ed-black, #1a1a1a);
                }
                .rep-stats {
                    font-size: 13px;
                    color: #666;
                }
                .tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    border-bottom: 2px solid var(--ed-gray, #34495e);
                }
                .tabs button {
                    padding: 10px 20px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-weight: bold;
                    color: #666;
                    border-bottom: 3px solid transparent;
                    margin-bottom: -2px;
                }
                .tabs button.active {
                    color: var(--ed-purple, #4b2c5e);
                    border-bottom-color: var(--ed-purple, #4b2c5e);
                }
                .tab-content {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    border: 2px solid var(--ed-gray, #34495e);
                }
                .overview-section {
                    margin-bottom: 20px;
                }
                .overview-section h4 {
                    margin: 0 0 12px 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .quick-stats {
                    display: flex;
                    gap: 16px;
                }
                .quick-stat {
                    flex: 1;
                    padding: 12px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 6px;
                    display: flex;
                    justify-content: space-between;
                }
                .qs-label {
                    color: #666;
                }
                .qs-value {
                    font-weight: bold;
                    color: var(--ed-purple, #4b2c5e);
                }
                .empty {
                    color: #666;
                    font-style: italic;
                }
                .subscriber-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .subscriber-list li {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                .subscriber-list .sub-amount {
                    color: var(--ed-crimson, #5c0a0a);
                    font-weight: bold;
                }
                .gating-tab h4, .transactions-tab h4 {
                    margin: 0 0 12px 0;
                }
                .hint {
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 16px;
                }
                .gate-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .form-group label {
                    font-weight: bold;
                    font-size: 14px;
                }
                .form-group input {
                    padding: 10px;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 4px;
                }
                .form-group.checkbox label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }
                .save-btn {
                    padding: 12px;
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 8px;
                }
                .transactions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .transaction-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 4px;
                }
                .tx-type {
                    text-transform: capitalize;
                    font-weight: bold;
                    color: var(--ed-purple, #4b2c5e);
                }
                .tx-desc {
                    font-size: 13px;
                    color: #666;
                }
                .tx-amount {
                    font-weight: bold;
                    color: var(--ed-crimson, #5c0a0a);
                }
            `}</style>
        </div>
    )
}

export default CreatorMonetization

