import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import AssetModal from './AssetModal.jsx'
import ExportModal from './ExportModal.jsx'

function Modal() {
    const { vpState, closeModal, login, register, createProject, showView } = useVP()
    const [authMode, setAuthMode] = useState('login')
    const [authData, setAuthData] = useState({ email: '', password: '', username: '' })
    const [publishData, setPublishData] = useState({ title: '', author: '', description: '', genre: 'classic', tags: '' })

    const handleAuthSubmit = async (e) => {
        e.preventDefault()
        if (authMode === 'login') {
            await login(authData.email, authData.password)
        } else {
            await register(authData.email, authData.password, authData.username)
        }
    }

    const handlePublishSubmit = async (e) => {
        e.preventDefault()
        // TODO: Implement publish logic
        console.log('Publishing:', publishData)
        closeModal('publishModal')
    }

    const renderAuthModal = () => (
        <div className="modal-overlay active" id="authModal">
            <div className="modal-box" style={{ maxWidth: '400px' }}>
                <button className="modal-close" onClick={() => closeModal('authModal')}>✕</button>
                <h2 style={{ textAlign: 'center' }}>{authMode === 'login' ? 'Login' : 'Register'}</h2>
                <form onSubmit={handleAuthSubmit}>
                    {authMode === 'register' && (
                        <div className="form-row" id="authUserGroup">
                            <label>Username</label>
                            <input
                                type="text"
                                id="authUser"
                                placeholder="Username"
                                value={authData.username}
                                onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                                required
                            />
                        </div>
                    )}
                    <div className="form-row">
                        <label>Email</label>
                        <input
                            type="email"
                            id="authEmail"
                            placeholder="user@example.com"
                            value={authData.email}
                            onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-row">
                        <label>Password</label>
                        <input
                            type="password"
                            id="authPass"
                            placeholder="••••••••"
                            value={authData.password}
                            onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                        <button className="btn-primary topnav-btn" type="submit" style={{ width: '100%' }}>
                            {authMode === 'login' ? 'Login' : 'Register'}
                        </button>
                        <button
                            className="btn-secondary topnav-btn secondary"
                            type="button"
                            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                            style={{ width: '100%' }}
                        >
                            {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )

    const renderPublishModal = () => (
        <div className="modal-overlay active" id="publishModal">
            <div className="modal-box">
                <button className="modal-close" onClick={() => closeModal('publishModal')}>✕</button>
                <h2>Publish Your Zine</h2>
                <form onSubmit={handlePublishSubmit}>
                    <div className="form-row">
                        <label>Title</label>
                        <input
                            type="text"
                            id="pubTitle"
                            placeholder="Enter zine title..."
                            value={publishData.title}
                            onChange={(e) => setPublishData({ ...publishData, title: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Author</label>
                        <input
                            type="text"
                            id="pubAuthor"
                            placeholder="Your name..."
                            value={publishData.author}
                            onChange={(e) => setPublishData({ ...publishData, author: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Description</label>
                        <textarea
                            id="pubDesc"
                            placeholder="Describe your zine..."
                            value={publishData.description}
                            onChange={(e) => setPublishData({ ...publishData, description: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Genre / Theme</label>
                        <select
                            id="pubGenre"
                            value={publishData.genre}
                            onChange={(e) => setPublishData({ ...publishData, genre: e.target.value })}
                        >
                            <option value="classic">Classic Literature</option>
                            <option value="fantasy">Medieval Fantasy</option>
                            <option value="cyberpunk">Cyberpunk</option>
                            <option value="conspiracy">Dark Conspiracies</option>
                            <option value="worldbuilding">World Building</option>
                            <option value="comics">Comics</option>
                            <option value="arcane">Arcane Lore</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Tags (comma separated)</label>
                        <input
                            type="text"
                            id="pubTags"
                            placeholder="art, zine, underground..."
                            value={publishData.tags}
                            onChange={(e) => setPublishData({ ...publishData, tags: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Visibility</label>
                        <select id="pubVisibility">
                            <option value="public">Public</option>
                            <option value="unlisted">Unlisted</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label>
                            <input type="checkbox" id="pubGuidelines" required /> I acknowledge the community guidelines
                        </label>
                    </div>
                    <button className="topnav-btn" type="submit" style={{ marginTop: '12px', width: '100%' }}>
                        🚀 Publish to Void Press
                    </button>
                </form>
            </div>
        </div>
    )

    const renderThemePickerModal = () => (
        <div className="modal-overlay active" id="themePickerModal">
            <div className="modal-box" style={{ maxWidth: '700px' }}>
                <button className="modal-close" onClick={() => closeModal('themePicker')}>✕</button>
                <h2>Choose Your Theme</h2>
                <p style={{ color: 'var(--vp-text-dim)', marginBottom: '12px' }}>
                    Select an aesthetic for your new zine.
                </p>
                <div className="theme-grid">
                    {[
                        { key: 'classic', name: 'Classic Literature', desc: 'Elegant prose & serif beauty', colors: ['#5c0a0a', '#d4af37', '#fdfaf1', '#4b2c5e'] },
                        { key: 'fantasy', name: 'Medieval Fantasy', desc: 'Swords, sorcery & scrolls', colors: ['#8b0000', '#ffd700', '#f5f5dc', '#4b0082'] },
                        { key: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon grids & digital void', colors: ['#ff003c', '#00f3ff', '#fcee0a', '#bc00ff'] },
                        { key: 'conspiracy', name: 'Dark Conspiracies', desc: 'Redacted truths & shadows', colors: ['#4a0000', '#00ff00', '#c5b358', '#e8e4d9'] },
                        { key: 'worldbuilding', name: 'World Building', desc: 'Maps, lore & kingdoms', colors: ['#e74c3c', '#27ae60', '#f1c40f', '#8e44ad'] },
                        { key: 'comics', name: 'Comics', desc: 'POW! BAM! WHAM!', colors: ['#ff0000', '#ffd700', '#663399', '#32cd32'] },
                        { key: 'arcane', name: 'Arcane Lore', desc: 'Sigils, runes & the unknowable', colors: ['#6a040f', '#ff9e00', '#3c096c', '#70e000'] }
                    ].map(theme => (
                        <div
                            key={theme.key}
                            className={`theme-card ${vpState.selectedTheme === theme.key ? 'selected' : ''}`}
                            onClick={() => {
                                createProject(theme.key)
                                closeModal('themePicker')
                            }}
                        >
                            <h4>{theme.name}</h4>
                            <p>{theme.desc}</p>
                            <div className="color-row">
                                {theme.colors.map((color, i) => (
                                    <div key={i} className="color-dot" style={{ background: color }} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    // Render active modals
    return (
        <>
            {vpState.modals.authModal?.active && renderAuthModal()}
            {vpState.modals.publishModal?.active && renderPublishModal()}
            {vpState.modals.themePicker?.active && renderThemePickerModal()}
            {vpState.modals.assetModal?.active && (
                <AssetModal
                    type={vpState.modals.assetModal.subtype}
                    onClose={() => closeModal('assetModal')}
                />
            )}
            {vpState.modals.exportModal?.active && (
                <ExportModal onClose={() => closeModal('exportModal')} />
            )}
        </>
    )
}

export default Modal
