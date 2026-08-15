/*
 * Component: TopNav
 * Persistent top navigation bar for app sections, search, and account actions.
 */

import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const styles = {
    userProfile: { display: 'flex', alignItems: 'center', gap: '8px' },
    loginBtn: { padding: '4px 12px', fontSize: '12px' }
}

/**
 * Component: TopNav
 * Application top navigation bar exposing view switches, theme toggle,
 * help/premium modals and the user account actions.
 */
function TopNav() {
    const { vpState, showView, showModal, logout, toggleUiTheme } = useVP()

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

    const isLight = vpState.uiTheme === 'light'

    return (
        <nav className="topnav">
            <div className="topnav-logo" onClick={() => handleViewChange('dashboard')}>
                SVRN <span>Sovereign Publishing</span>
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
            </div>
            <div className="topnav-right">
                <button
                    className="topnav-btn secondary"
                    onClick={toggleUiTheme}
                    title={isLight ? 'Switch to dark UI' : 'Switch to light UI'}
                    aria-label={isLight ? 'Switch to dark UI' : 'Switch to light UI'}
                >
                    {isLight ? 'Dark' : 'Light'}
                </button>
                <div className="cloud-status" title={vpState.isOnline ? 'Online' : 'Offline'}>
                    {vpState.isOnline ? '☁️' : '☁️⃠'}
                </div>
                <button className="topnav-btn secondary" onClick={handleHelp}>Help</button>
                <div className="user-profile">
                    {vpState.user ? (
                        <div style={styles.userProfile}>
                            <div className="topnav-avatar">{vpState.user.username[0]}</div>
                            <button onClick={logout} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleAuth} className="btn-premium" style={styles.loginBtn}>
                            Login
                        </button>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default TopNav
