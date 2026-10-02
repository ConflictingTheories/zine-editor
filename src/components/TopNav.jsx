/*
 * Component: TopNav
 * Persistent top navigation bar — 3-mode switcher (Publisher · Light Table ·
 * Portfolio), right-rail utility actions, and theme toggle.
 */

import React from 'react'
import { useVP } from '../context/VPContext.jsx'

/**
 * SVG icon primitives — inline so there are zero network requests and the
 * shapes can adopt the current `color` without fill overrides.
 */
const IconPublisher = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="4.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="2" width="4.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2" y="9.5" width="11" height="3.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
    </svg>
)

const IconLightTable = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <circle cx="7.5" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
        <line x1="7.5" y1="1" x2="7.5" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="7.5" y1="12.5" x2="7.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="1" y1="7.5" x2="2.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="12.5" y1="7.5" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
)

const IconPortfolio = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="1.5" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1.5" y="8.5" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="8.5" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
    </svg>
)

const IconMoon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5 5 5 0 1 0 11.5 8.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
)

const IconSun = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <line x1="7" y1="1" x2="7" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="7" y1="11.5" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="1" y1="7" x2="2.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="11.5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="3.05" y1="3.05" x2="4.12" y2="4.12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="9.88" y1="9.88" x2="10.95" y2="10.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="10.95" y1="3.05" x2="9.88" y2="4.12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="4.12" y1="9.88" x2="3.05" y2="10.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
)

const MODES = [
    { id: 'publisher', view: 'dashboard', label: 'Publisher', Icon: IconPublisher, hint: 'Publisher — zines, magazines & interactive fiction (⌘1)' },
    { id: 'lighttable', view: 'lighttable', label: 'Light Table', Icon: IconLightTable, hint: 'Light Table — develop & process photographs (⌘2)' },
    { id: 'portfolio', view: 'portfolio', label: 'Portfolio', Icon: IconPortfolio, hint: 'Portfolio — arrange and publish photo books (⌘3)' }
]

function viewToMode(view) {
    if (view === 'editor') return 'publisher'
    if (view === 'dashboard') return 'publisher'
    if (view === 'lighttable') return 'lighttable'
    if (view === 'portfolio') return 'portfolio'
    return 'publisher'
}

/**
 * Component: TopNav
 * Always-visible navigation bar with the 3-mode switcher on the left,
 * SVRN wordmark in the centre, and utility actions on the right.
 */
function TopNav() {
    const { vpState, showView, showModal, logout, toggleUiTheme, updateVpState } = useVP()
    const activeMode = viewToMode(vpState.currentView)
    const isLight = vpState.uiTheme === 'light'

    // Keyboard shortcut: Cmd+1/2/3 for mode switching
    React.useEffect(() => {
        const onKey = (e) => {
            if (!(e.metaKey || e.ctrlKey)) return
            const tag = e.target?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
            if (e.key === '1') { e.preventDefault(); navigateTo('publisher') }
            if (e.key === '2') { e.preventDefault(); navigateTo('lighttable') }
            if (e.key === '3') { e.preventDefault(); navigateTo('portfolio') }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [vpState.currentView])

    const navigateTo = (modeId) => {
        const mode = MODES.find(m => m.id === modeId)
        if (!mode) return
        if (modeId === 'publisher') {
            // If there's an open project go to the editor; otherwise dashboard
            if (vpState.currentProject) {
                showView('editor')
            } else {
                showView('dashboard')
            }
        } else {
            showView(mode.view)
        }
    }

    return (
        <nav className="topnav" role="navigation" aria-label="Main navigation">
            {/* ── Mode switcher ─────────────────────────────────────────── */}
            <div className="topnav-modes" role="tablist" aria-label="Application mode">
                {MODES.map(({ id, label, Icon, hint }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={activeMode === id}
                        className={`topnav-mode ${activeMode === id ? 'active' : ''}`}
                        onClick={() => navigateTo(id)}
                        title={hint}
                    >
                        <Icon />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Wordmark ──────────────────────────────────────────────── */}
            <div
                className="topnav-logo"
                onClick={() => navigateTo('publisher')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigateTo('publisher')}
                aria-label="SVRN — go to Publisher hub"
            >
                SVRN
                <span className="topnav-logo-sub">Sovereign Publishing</span>
            </div>

            {/* ── Right rail ────────────────────────────────────────────── */}
            <div className="topnav-right">
                <button
                    className="topnav-icon-btn"
                    onClick={toggleUiTheme}
                    title={isLight ? 'Switch to dark UI' : 'Switch to light UI'}
                    aria-label={isLight ? 'Switch to dark UI' : 'Switch to light UI'}
                >
                    {isLight ? <IconMoon /> : <IconSun />}
                </button>

                <div
                    className={`topnav-online-dot ${vpState.isOnline ? 'online' : 'offline'}`}
                    title={vpState.isOnline ? 'Online' : 'Offline'}
                    aria-label={vpState.isOnline ? 'Online' : 'Offline'}
                />

                <button className="topnav-text-btn" onClick={() => showModal('helpModal')}>
                    Help
                </button>

                {vpState.user && (
                    <div className="topnav-user">
                        <div className="topnav-avatar" aria-hidden="true">
                            {vpState.user.username[0].toUpperCase()}
                        </div>
                        <button
                            onClick={logout}
                            className="topnav-text-btn"
                            aria-label="Log out"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </nav>
    )
}

export default TopNav
