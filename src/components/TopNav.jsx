import React from 'react'
import { useVP } from '../context/VPContext.jsx'

// TopNav uses styles defined in index.css


function TopNav() {
    const { vpState, updateVpState, showView, showModal, logout, toggleTheme } = useVP()

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
                {vpState.user && (
                    <>
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
                    </>
                )}
                <button
                    className={`topnav-tab ${vpState.currentView === 'discover' ? 'active' : ''}`}
                    onClick={() => handleViewChange('discover')}
                >
                    Discover
                </button>
                {vpState.user && (
                    <>
                        <button
                            className={`topnav-tab ${vpState.currentView === 'monetization' ? 'active' : ''}`}
                            onClick={() => handleViewChange('monetization')}
                        >
                            Monetization
                        </button>
                        <button
                            className={`topnav-tab ${vpState.currentView === 'profile' ? 'active' : ''}`}
                            onClick={() => handleViewChange('profile')}
                        >
                            Profile
                        </button>
                    </>
                )}
            </div>
            <div className="topnav-right">
                <button className="btn-ghost" title="Toggle Light/Dark Theme" onClick={toggleTheme}>
                    {vpState.theme === 'dark' ? '🌙' : '☀️'}
                </button>
                <div className="cloud-status" title={vpState.isOnline ? 'Online' : 'Offline'}>
                    {vpState.isOnline ? '☁️' : '☁️⃠'}
                </div>
                <span className={`user-tier ${vpState.user?.is_premium ? 'premium' : ''}`}>
                    {vpState.user?.is_premium ? 'PREMIUM' : 'FREE'}
                </span>
                <button className="btn-ghost" onClick={handleHelp}>Help</button>
                <div className="user-profile">
                    {vpState.user ? (
                        <div className="profile-group">
                            <div className="topnav-avatar" onClick={() => handleViewChange('profile')} title="Your Profile">{vpState.user.username[0]}</div>
                            <button onClick={logout} className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleAuth} className="btn-premium">
                            Login
                        </button>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default TopNav
