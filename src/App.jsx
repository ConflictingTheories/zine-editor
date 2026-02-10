import React from 'react'
import TopNav from './components/TopNav.jsx'
import Modal from './components/Modal.jsx'
import Dashboard from './components/Dashboard.jsx'
import Editor from './components/Editor.jsx'
import Discover from './components/Discover.jsx'
import Reader from './components/Reader.jsx'
import VfxSystem from './components/VfxSystem.jsx'
import Toast from './components/Toast.jsx'
import { useVP } from './context/VPContext.jsx'

function App() {
    const { vpState, activeVfx } = useVP()

    const renderView = () => {
        switch (vpState.currentView) {
            case 'dashboard': return <Dashboard />
            case 'editor': return <Editor />
            case 'discover': return <Discover />
            case 'reader': return <Reader />
            default: return <Dashboard />
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
