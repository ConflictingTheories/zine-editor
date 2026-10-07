/*
 * Component: App
 * Top-level application shell for routing, auth flow, and global overlay state.
 */

import React, { useEffect, useState } from 'react'
import TopNav from './components/TopNav.jsx'
import Modal from './components/Modal.jsx'
import TemplateModal from './components/TemplateModal.jsx'
import Dashboard from './components/Dashboard.jsx'
import Editor from './components/Editor.jsx'
import Reader from './components/Reader.jsx'
import LightTable from './components/lighttable/LightTable.jsx'
import VfxSystem from './components/VfxSystem.jsx'
import Toast from './components/Toast.jsx'
import { useVP } from './context/VPContext.jsx'

/**
 * A render that throws unmounts the whole tree in React 18, which presents to
 * the user as a blank window with nothing in the console — the single most
 * expensive failure mode this app has. This boundary keeps the frame, the
 * navigation and the toast layer alive, names the failing view in the UI, and
 * leaves a breadcrumb the user can copy into a bug report.
 *
 * A real fix still belongs in the component; this exists so the next one is
 * diagnosable in ten seconds instead of twenty minutes.
 */
class ViewErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { error: null, view: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidUpdate(prevProps) {
        // Switching modes or opening another project is a fresh start: a view
        // that threw must not poison the whole session.
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null, view: null })
        }
    }

    componentDidCatch(error, info) {
        this.setState({ view: this.props.label })
        console.error('[SVRN] view crashed:', error, info?.componentStack)
    }

    render() {
        if (this.state.error) {
            return (
                <div className="view-crash" role="alert">
                    <div className="view-crash-card">
                        <h2>{this.state.view || 'This view'} stopped responding</h2>
                        <p>
                            Your work is saved — nothing has been lost. Go back with
                            <kbd>⌘[</kbd>, or return to the Library with <kbd>⌘0</kbd>.
                        </p>
                        <pre className="view-crash-detail">{String(this.state.error?.message || this.state.error)}</pre>
                        <button type="button" onClick={() => this.setState({ error: null, view: null })}>
                            Try again
                        </button>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

/** Human names for the crash card, keyed by view id. */
const VIEW_LABELS = {
    dashboard: 'The Library',
    editor: 'The editor',
    portfolio: 'Portfolio',
    lighttable: 'Light Table',
    reader: 'Reader'
}

/**
 * Component: EmptyMode
 * What a mode shows when it has nothing open. Previously every mode fell back
 * to the editor's "No project selected" line and the user was left with a dead
 * end — the exact friction this app keeps trying to remove. Each mode now
 * explains itself and offers the one action that gets you moving.
 */
function EmptyMode({ mode }) {
    const { goHome } = useVP()

    const COPY = {
        portfolio: {
            title: 'No book open',
            body: 'Portfolio books are where developed photographs get arranged into spreads — mats, layouts, captions and print sizes.',
            cta: 'Choose a book from the Library'
        },
        editor: {
            title: 'Nothing open',
            body: 'Pick up a pixozine or a book from the Library, or start something new.',
            cta: 'Open the Library'
        }
    }[mode] || {}

    return (
        <div className="empty-mode">
            <div className="empty-mode-card">
                <h2>{COPY.title}</h2>
                <p>{COPY.body}</p>
                <button type="button" onClick={goHome}>{COPY.cta}</button>
            </div>
        </div>
    )
}

/**
 * Component: App
 * Top-level application shell routing between the 3 primary platform modes
 * (Publisher / Light Table / Portfolio) plus the Reader experience. The TopNav
 * is always visible across all modes — no mode hides it.
 */
function App() {
    const { vpState, activeVfx } = useVP()
    // Bumping this on navigation gives the boundary a fresh start, so a view
    // that threw can be retried by simply going somewhere else.
    const resetKey = `${vpState.currentView}:${vpState.currentProject?.id || ''}`

    const renderView = () => {
        const view = vpState.currentView

        /**
         * Portfolio has its own view key. When the open project is a pixozine and
         * the user clicks Portfolio, showing them the pixozine editor means the mode
         * switch silently does nothing — the button lights up and the same
         * screen is still there. Route to the hub instead so they can pick or
         * make a book.
         */
        if (view === 'portfolio' && vpState.currentProject?.editorMode !== 'photo-portfolio') {
            return <Dashboard />
        }

        if ((view === 'editor' || view === 'portfolio')
            && (!vpState.currentProject || !vpState.currentProject.pages?.length)) {
            return <EmptyMode mode={view === 'portfolio' ? 'portfolio' : 'editor'} />
        }

        switch (view) {
            case 'dashboard':
                return <Dashboard />
            case 'editor':
                return <Editor />
            case 'reader':
                return <Reader />
            case 'lighttable':
                return <LightTable />
            // Editor dispatches to PortfolioWorkspace when the open project is
            // a photo book, so both view keys land in the right workspace.
            case 'portfolio':
                return <Editor />
            default:
                return <Dashboard />
        }
    }

    return (
        <div className={`app-container ${activeVfx === 'shake' ? 'shake-anim' : ''} ${activeVfx === 'pulse' ? 'pulse-anim' : ''}`}>
            <TopNav />
            <main className="main-content">
                <ViewErrorBoundary resetKey={resetKey} label={VIEW_LABELS[vpState.currentView]}>
                    {renderView()}
                </ViewErrorBoundary>
            </main>
            <Modal />
            <TemplateModal />
            <VfxSystem />
            <Toast />
        </div>
    )
}

export default App
