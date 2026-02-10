import React from 'react'
import { useVP } from '../context/VPContext.jsx'

function TopNav() {
    const { vpState, updateVpState, showView, showModal } = useVP()

    const handleViewChange = (view) => {
        showView(view)
    }

    const handleAuth = () => {
        showModal('authModal')
    }

    const handleHelp = () => {
        showModal('helpModal')
    }

    const handlePremium = () => {
        showModal('premiumModal')
    }

    return (
        <nav className="topnav">
            <div className="topnav-logo" onClick={() => handleViewChange('dashboard')}>
                VOID PRESS <span>Publishing</span>
            </div>
            <div className="topnav-tabs">
                <button
                    className={`topnav-tab ${vpState.currentView === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleViewChange('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    className={`topnav-tab ${vpState.currentView === 'editor' ? 'active' : ''}`}
                    onClick={() => handleViewChange('editor')}
                >
                    Editor
                </button>
                <button
                    className={`topnav-tab ${vpState.currentView === 'discover' ? 'active' : ''}`}
                    onClick={() => handleViewChange('discover')}
                >
                    Discover
                </button>
            </div>
            <div className="topnav-right">
                <div className="cloud-status" title={vpState.isOnline ? 'Online' : 'Offline'}>
                    {vpState.isOnline ? '☁️' : '☁️⃠'}
                </div>
                <span className={`user-tier ${vpState.user?.is_premium ? 'premium' : ''}`}>
                    {vpState.user?.is_premium ? 'PREMIUM' : 'FREE'}
                </span>
                <button className="topnav-btn secondary" onClick={handleHelp}>Help</button>
                <button className="topnav-btn secondary" onClick={handlePremium}>Upgrade</button>
                <div className="user-profile">
                    {vpState.user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="topnav-avatar">{vpState.user.username[0]}</div>
                            <button onClick={() => updateVpState({ user: null, token: null })}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleAuth} className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                            Login
                        </button>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default TopNav
