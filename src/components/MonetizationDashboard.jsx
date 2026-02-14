
import React, { useState } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'
import CreditPurchase from './CreditPurchase'
import TokenMarketplace from './TokenMarketplace'
import TokenIssuance from './TokenIssuance'
import SubscriptionManager from './SubscriptionManager'
import CreatorMonetization from './CreatorMonetization'
import WalletModal from './WalletModal'

const MonetizationDashboard = () => {
    const { xrState } = useXRPayID()
    const [activeView, setActiveView] = useState('overview')
    const [showWalletModal, setShowWalletModal] = useState(false)

    const renderContent = () => {
        switch (activeView) {
            case 'credits':
                return <CreditPurchase />
            case 'marketplace':
                return <TokenMarketplace />
            case 'issuance':
                return <TokenIssuance />
            case 'subscriptions':
                return <SubscriptionManager />
            case 'creator':
                return <CreatorMonetization />
            default:
                return (
                    <div className="overview-dashboard">
                        <div className="wallet-bar">
                            <div className="wallet-info">
                                <span className="label">Credits:</span>
                                <span className="value">{xrState.credits.toFixed(2)}</span>
                            </div>
                            <button className="wallet-btn" onClick={() => setShowWalletModal(true)}>
                                {xrState.wallet?.xrp_address ? '🔗 Wallet Connected' : '🔗 Connect Wallet'}
                            </button>
                        </div>

                        <div className="quick-actions">
                            <button className="action-card" onClick={() => setActiveView('credits')}>
                                <span className="action-icon">💰</span>
                                <span className="action-title">Buy Credits</span>
                                <span className="action-desc">Add funds to your account</span>
                            </button>
                            <button className="action-card" onClick={() => setActiveView('marketplace')}>
                                <span className="action-icon">🪙</span>
                                <span className="action-title">Token Market</span>
                                <span className="action-desc">Browse & trade tokens</span>
                            </button>
                            <button className="action-card" onClick={() => setActiveView('issuance')}>
                                <span className="action-icon">🎨</span>
                                <span className="action-title">Issue Token</span>
                                <span className="action-desc">Create your own currency</span>
                            </button>
                            <button className="action-card" onClick={() => setActiveView('subscriptions')}>
                                <span className="action-icon">📜</span>
                                <span className="action-title">Subscriptions</span>
                                <span className="action-desc">Manage your subs</span>
                            </button>
                            <button className="action-card" onClick={() => setActiveView('creator')}>
                                <span className="action-icon">💎</span>
                                <span className="action-title">Creator Tools</span>
                                <span className="action-desc">Monetize your content</span>
                            </button>
                        </div>

                        <div className="recent-activity">
                            <h4>Recent Activity</h4>
                            {xrState.transactions.length === 0 ? (
                                <p className="empty">No recent transactions</p>
                            ) : (
                                <div className="activity-list">
                                    {xrState.transactions.slice(0, 5).map(tx => (
                                        <div key={tx.id} className="activity-item">
                                            <span className="activity-type">{tx.type.replace(/_/g, ' ')}</span>
                                            <span className="activity-desc">{tx.description}</span>
                                            <span className="activity-amount">{tx.amount}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
                    </div>
                )
        }
    }

    return (
        <div className="monetization-dashboard">
            <div className="dashboard-header">
                <h2>💎 Monetization</h2>
            </div>

            <div className="dashboard-nav">
                <button
                    className={`nav-btn ${activeView === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveView('overview')}
                >
                    Overview
                </button>
                <button
                    className={`nav-btn ${activeView === 'credits' ? 'active' : ''}`}
                    onClick={() => setActiveView('credits')}
                >
                    Credits
                </button>
                <button
                    className={`nav-btn ${activeView === 'marketplace' ? 'active' : ''}`}
                    onClick={() => setActiveView('marketplace')}
                >
                    Marketplace
                </button>
                <button
                    className={`nav-btn ${activeView === 'issuance' ? 'active' : ''}`}
                    onClick={() => setActiveView('issuance')}
                >
                    Issue Token
                </button>
                <button
                    className={`nav-btn ${activeView === 'subscriptions' ? 'active' : ''}`}
                    onClick={() => setActiveView('subscriptions')}
                >
                    Subscriptions
                </button>
                <button
                    className={`nav-btn ${activeView === 'creator' ? 'active' : ''}`}
                    onClick={() => setActiveView('creator')}
                >
                    Creator Tools
                </button>
            </div>

            <div className="dashboard-content">
                {xrState.isLoading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    renderContent()
                )}
            </div>

            <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />

            <style>{`
                .monetization-dashboard {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .dashboard-header {
                    padding: 20px;
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                }
                .dashboard-header h2 {
                    margin: 0;
                }
                .dashboard-nav {
                    display: flex;
                    gap: 4px;
                    padding: 12px 20px;
                    background: var(--ed-black, #1a1a1a);
                    overflow-x: auto;
                }
                .nav-btn {
                    padding: 10px 16px;
                    background: transparent;
                    border: none;
                    color: #aaa;
                    cursor: pointer;
                    font-weight: bold;
                    white-space: nowrap;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .nav-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }
                .nav-btn.active {
                    background: var(--ed-gold, #d4af37);
                    color: var(--ed-black, #1a1a1a);
                }
                .dashboard-content {
                    flex: 1;
                    overflow-y: auto;
                    background: var(--ed-white, #fdfaf1);
                }
                .loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 200px;
                    color: var(--ed-gray, #34495e);
                }
                .overview-dashboard {
                    padding: 20px;
                }
                .wallet-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: white;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 2px solid var(--ed-gray, #34495e);
                }
                .wallet-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .wallet-info .label {
                    color: #666;
                }
                .wallet-info .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--ed-gold, #d4af37);
                }
                .wallet-btn {
                    padding: 10px 16px;
                    background: var(--ed-purple, #4b2c5e);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .quick-actions {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 12px;
                    margin-bottom: 24px;
                }
                .action-card {
                    padding: 20px;
                    background: white;
                    border: 2px solid var(--ed-gray, #34495e);
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .action-card:hover {
                    border-color: var(--ed-purple, #4b2c5e);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .action-icon {
                    font-size: 28px;
                }
                .action-title {
                    font-weight: bold;
                    color: var(--ed-black, #1a1a1a);
                }
                .action-desc {
                    font-size: 12px;
                    color: #666;
                }
                .recent-activity {
                    background: white;
                    padding: 16px;
                    border-radius: 8px;
                    border: 2px solid var(--ed-gray, #34495e);
                }
                .recent-activity h4 {
                    margin: 0 0 12px 0;
                    color: var(--ed-black, #1a1a1a);
                }
                .empty {
                    color: #666;
                    font-style: italic;
                }
                .activity-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .activity-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px;
                    background: var(--ed-white, #fdfaf1);
                    border-radius: 4px;
                }
                .activity-type {
                    font-weight: bold;
                    text-transform: capitalize;
                    color: var(--ed-purple, #4b2c5e);
                    font-size: 12px;
                }
                .activity-desc {
                    flex: 1;
                    color: #666;
                    font-size: 13px;
                }
                .activity-amount {
                    font-weight: bold;
                    color: var(--ed-crimson, #5c0a0a);
                }
            `}</style>
        </div>
    )
}

export default MonetizationDashboard

