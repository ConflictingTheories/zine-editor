import React from 'react'
import TopNav from './components/TopNav.jsx'
import Modal from './components/Modal.jsx'
import Dashboard from './components/Dashboard.jsx'
import Editor from './components/Editor.jsx'
import Discover from './components/Discover.jsx'
import Reader from './components/Reader.jsx'
import VfxSystem from './components/VfxSystem.jsx'
import Toast from './components/Toast.jsx'
import MonetizationDashboard from './components/MonetizationDashboard.jsx'
import { useVP } from './context/VPContext.jsx'
import { useStripeConfirm } from './hooks/useStripeConfirm.js'

function App() {
    const { vpState, activeVfx } = useVP()
    useStripeConfirm() // Check for payment return

    // Auth guard: redirect to dashboard if user not logged in
    const isLoggedIn = !!vpState.user && !!vpState.token
    const isPublicView = vpState.currentView === 'discover' || vpState.currentView === 'reader'

    // If not logged in and trying to access protected view, redirect to dashboard
    let viewToRender = vpState.currentView
    if (!isLoggedIn && !isPublicView) {
        viewToRender = 'dashboard'
    }

    const renderView = () => {
        switch (viewToRender) {
            case 'dashboard':
                return isLoggedIn ? <Dashboard /> : <Dashboard />
            case 'editor':
                return isLoggedIn ? <Editor /> : <Dashboard />
            case 'discover':
                return <Discover />
            case 'reader':
                return <Reader />
            case 'monetization':
                return isLoggedIn ? <MonetizationDashboard /> : <Dashboard />
            default:
                return <Dashboard />
        }
    }

    return (
        <div className={`app-container ${activeVfx === 'shake' ? 'shake-anim' : ''} ${activeVfx === 'pulse' ? 'pulse-anim' : ''}`}>
            <TopNav />
            <main className="main-content">
                {renderView()}
            </main>
            <Modal />
            <VfxSystem />
            <Toast />
        </div>
    )
}

export default App
