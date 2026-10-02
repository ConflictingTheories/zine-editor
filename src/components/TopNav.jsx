/*
 * Component: TopNav
 * The app's navigation spine.
 *
 * Design note — why there is no mode switcher here any more.
 *
 * The three modes are not mutually exclusive. The Light Table is opened from a
 * photograph inside a Publisher zine and from a frame inside a Portfolio book,
 * and in both cases the user has to be handed back to where they came from. A
 * row of three "mode" tabs asserted an exclusivity the state model does not
 * have, so clicking one did something different depending on invisible state
 * (whether a project was open, and of what kind) and there was no way back.
 * That is the confusion this bar replaces.
 *
 * What navigation is actually for here is: get to the library, and get back
 * from wherever you were taken. So the bar carries a real back affordance, a
 * breadcrumb that names the place you are in, and an unambiguous home target.
 * The Light Table — the one genuinely global tool, since it reads from the
 * shared library and belongs to no project — stays one click away from anywhere
 * as a launcher rather than as a peer "mode".
 */

import React from 'react'
import { useVP } from '../context/VPContext.jsx'

/* ── Brand mark ──────────────────────────────────────────────────────────────
   A single open sheet with a fold. A wordmark three letters tall cannot carry
   a drawn logotype, and a glyph that reads as "page" is more honest about the
   product than another abstract mark. It inherits `currentColor`, so the accent
   treatment and the muted state both come for free. */
const BrandMark = ({ size = 21 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="topnav-mark-svg"
    >
        <path
            d="M5.5 3.5h5.4a2 2 0 0 1 1.5.7l1.4 1.8a2 2 0 0 0 1.5.7h3.2a1.5 1.5 0 0 1 1.5 1.5v12.3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5V5a1.5 1.5 0 0 1 1.5-1.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path
            d="M8.2 9.4h7.6M8.2 12.4h7.6M8.2 15.4h4.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".5"
        />
    </svg>
)

const IconBack = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path d="M9.4 3.4 4.9 7.5l4.5 4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.3 7.5h6.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
)

const IconAperture = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="7" cy="7" r="1.7" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 1.8v1.9M7 10.3v1.9M1.8 7h1.9M10.3 7h1.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
        <path
            d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M3.05 3.05l1.07 1.07M9.88 9.88l1.07 1.07M10.95 3.05 9.88 4.12M4.12 9.88l-1.07 1.07"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
        />
    </svg>
)

/**
 * Where the user is, in words. A view key is meaningless to a reader, and
 * "which mode am I in" is exactly the question the old tab row failed to
 * answer — so the bar states it outright.
 */
function useLocation() {
    const { vpState } = useVP()
    const view = vpState.currentView
    const project = vpState.currentProject

    if (view === 'reader') return { place: 'Reader', detail: project?.title || 'Preview' }
    if (view === 'lighttable') return { place: 'Light Table', detail: vpState.lightTableAsset?.name || 'Develop' }
    if (view === 'portfolio') {
        return { place: 'Portfolio', detail: project?.title || (project ? 'Book' : 'Books') }
    }
    if (view === 'editor') {
        const isBook = project?.editorMode === 'photo-portfolio'
        return { place: isBook ? 'Portfolio' : 'Publisher', detail: project?.title || 'Untitled' }
    }
    return { place: 'Library', detail: 'All projects' }
}

function TopNav() {
    const {
        vpState, showView, goBack, goHome,
        showModal, logout, toggleUiTheme
    } = useVP()

    const isLight = vpState.uiTheme === 'light'
    const loc = useLocation()
    const atHub = vpState.currentView === 'dashboard'
    const inLightTable = vpState.currentView === 'lighttable'

    // Back is history-aware. With no history — a deep link, or the library
    // itself — it goes home, so the control is never a dead button.
    const handleBack = () => { if (!goBack()) goHome() }

    const launchLightTable = () => showView('lighttable')

    React.useEffect(() => {
        const onKey = (e) => {
            if (!(e.metaKey || e.ctrlKey)) return
            const tag = e.target?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
            if (e.key === 'Backspace' || e.key === '[') { e.preventDefault(); handleBack() }
            else if (e.key === '0') { e.preventDefault(); goHome() }
            else if (e.key === '2') { e.preventDefault(); launchLightTable() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [vpState.currentView])

    return (
        <nav className="topnav" role="navigation" aria-label="Main navigation">
            {/* ── Left: back, brand, where you are ──────────────────────── */}
            <div className="topnav-lead">
                <button
                    type="button"
                    className="topnav-back"
                    onClick={handleBack}
                    disabled={atHub}
                    aria-label="Go back"
                    title={atHub ? 'You are at the library' : 'Go back (⌘[)'}
                >
                    <IconBack />
                </button>

                <button
                    type="button"
                    className="topnav-brand"
                    onClick={goHome}
                    aria-label="SVRN — go to Library"
                    title="SVRN — Library (⌘0)"
                >
                    <BrandMark />
                    <span className="topnav-brand-text">
                        <span className="topnav-brand-name">SVRN</span>
                        <span className="topnav-brand-sub">Publishing</span>
                    </span>
                </button>

                <div className="topnav-crumbs">
                    <span className="topnav-crumb-place">{loc.place}</span>
                    <span className="topnav-crumb-sep" aria-hidden="true">/</span>
                    <span className="topnav-crumb-detail" title={loc.detail}>{loc.detail}</span>
                </div>
            </div>

            {/* ── Right: tools and account ───────────────────────────────── */}
            <div className="topnav-right">
                <button
                    type="button"
                    className="topnav-launch"
                    onClick={launchLightTable}
                    disabled={inLightTable}
                    title="Develop photographs — shared library (⌘2)"
                >
                    <IconAperture />
                    <span>Light&nbsp;Table</span>
                </button>

                <span className="topnav-rule" aria-hidden="true" />

                <button
                    type="button"
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
                        <button onClick={logout} className="topnav-text-btn" aria-label="Log out">
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </nav>
    )
}

export default TopNav
