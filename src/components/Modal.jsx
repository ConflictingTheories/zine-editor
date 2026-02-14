import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import AssetModal from './AssetModal.jsx'
import ExportModal from './ExportModal.jsx'

const THEME_OPTIONS = [
    { key: 'classic', name: 'Classic Literature', desc: 'Elegant prose & serif beauty', colors: ['#5c0a0a', '#d4af37', '#fdfaf1', '#4b2c5e'] },
    { key: 'fantasy', name: 'Medieval Fantasy', desc: 'Swords, sorcery & scrolls', colors: ['#8b0000', '#ffd700', '#f5f5dc', '#4b0082'] },
    { key: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon grids & digital void', colors: ['#ff003c', '#00f3ff', '#fcee0a', '#bc00ff'] },
    { key: 'conspiracy', name: 'Dark Conspiracies', desc: 'Redacted truths & shadows', colors: ['#4a0000', '#00ff00', '#c5b358', '#e8e4d9'] },
    { key: 'worldbuilding', name: 'World Building', desc: 'Maps, lore & kingdoms', colors: ['#e74c3c', '#27ae60', '#f1c40f', '#8e44ad'] },
    { key: 'comics', name: 'Comics', desc: 'POW! BAM! WHAM!', colors: ['#ff0000', '#ffd700', '#663399', '#32cd32'] },
    { key: 'arcane', name: 'Arcane Lore', desc: 'Sigils, runes & the unknowable', colors: ['#6a040f', '#ff9e00', '#3c096c', '#70e000'] }
]

function Modal() {
    const { vpState, updateVpState, closeModal, login, register, createProject, publishZine } = useVP()
    const [authMode, setAuthMode] = useState('login')
    const [authData, setAuthData] = useState({ email: '', password: '', username: '' })
    const [publishData, setPublishData] = useState({ title: '', author: '', description: '', genre: 'classic', tags: '' })
    const [helpTab, setHelpTab] = useState('shortcuts')

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
        if (!document.getElementById('pubGuidelines')?.checked) {
            return
        }
        await publishZine({
            title: publishData.title || vpState.currentProject?.title,
            author: publishData.author,
            description: publishData.description,
            genre: publishData.genre,
            tags: publishData.tags
        })
        setPublishData({ title: '', author: '', description: '', genre: 'classic', tags: '' })
    }

    const renderAuthModal = () => (
        <div className="premium-modal-overlay active" id="authModal">
            <div className="premium-modal-box" style={{ maxWidth: '400px' }}>
                <button className="premium-modal-close" onClick={() => closeModal('authModal')}>✕</button>
                <h2 className="premium-modal-h2" style={{ textAlign: 'center' }}>
                    {authMode === 'login' ? 'Welcome Back' : 'Join Void Press'}
                </h2>
                <form onSubmit={handleAuthSubmit}>
                    {authMode === 'register' && (
                        <div className="form-row">
                            <label>Username</label>
                            <input
                                type="text"
                                placeholder="Choose your alias..."
                                value={authData.username}
                                onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                                required
                            />
                        </div>
                    )}
                    <div className="form-row">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="user@example.com"
                            value={authData.email}
                            onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-row">
                        <label>Secure Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={authData.password}
                            onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                        <button className="btn-premium" type="submit" style={{ width: '100%' }}>
                            {authMode === 'login' ? 'Initialize Session' : 'Create Account'}
                        </button>
                        <button
                            className="filter-tag"
                            type="button"
                            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                            style={{ background: 'transparent', border: '1px solid var(--vp-border)', color: 'var(--vp-text-dim)' }}
                        >
                            {authMode === 'login' ? 'Need an identity? Register' : 'Already have an identity? Login'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )

    const renderPublishModal = () => (
        <div className="premium-modal-overlay active" id="publishModal">
            <div className="premium-modal-box">
                <button className="premium-modal-close" onClick={() => closeModal('publishModal')}>✕</button>
                <h2 className="premium-modal-h2">Publish Your Zine</h2>
                <form onSubmit={handlePublishSubmit}>
                    <div className="form-row">
                        <label>Title</label>
                        <input
                            type="text"
                            placeholder="Enter zine title..."
                            value={publishData.title}
                            onChange={(e) => setPublishData({ ...publishData, title: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Author</label>
                        <input
                            type="text"
                            placeholder="Your name or pseudonym..."
                            value={publishData.author}
                            onChange={(e) => setPublishData({ ...publishData, author: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Description</label>
                        <textarea
                            placeholder="What is this void about?"
                            rows="3"
                            value={publishData.description}
                            onChange={(e) => setPublishData({ ...publishData, description: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <label>Genre / Theme</label>
                        <select
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
                        <label>Tags</label>
                        <input
                            type="text"
                            placeholder="art, zine, underground... (comma separated)"
                            value={publishData.tags}
                            onChange={(e) => setPublishData({ ...publishData, tags: e.target.value })}
                        />
                    </div>
                    <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" id="pubGuidelines" required style={{ width: 'auto' }} />
                        <label htmlFor="pubGuidelines" style={{ marginBottom: 0 }}>Accept Voyagers' Guidelines</label>
                    </div>
                    <button className="btn-premium" type="submit" style={{ width: '100%', marginTop: '1rem' }}>
                        🚀 Launch to Void Press
                    </button>
                </form>
            </div>
        </div>
    )

    const renderThemePickerModal = () => (
        <div className="premium-modal-overlay active" id="themePickerModal">
            <div className="premium-modal-box" style={{ maxWidth: '800px' }}>
                <button className="premium-modal-close" onClick={() => closeModal('themePicker')}>✕</button>
                <h2 className="premium-modal-h2">Choose Aesthetic</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {THEME_OPTIONS.map(theme => (
                        <div
                            key={theme.key}
                            className={`theme-card ${vpState.selectedTheme === theme.key ? 'selected' : ''}`}
                            onClick={() => updateVpState({ selectedTheme: theme.key })}
                            style={{
                                background: 'var(--vp-surface)',
                                border: vpState.selectedTheme === theme.key ? '2px solid var(--vp-accent)' : '1px solid var(--vp-border)',
                                padding: '1.25rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                opacity: vpState.selectedTheme === theme.key ? 1 : 0.7
                            }}
                        >
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>{theme.name}</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--vp-text-dim)', margin: '0 0 1rem 0' }}>{theme.desc}</p>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {theme.colors.map((color, i) => (
                                    <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <button className="btn-premium" onClick={() => createProject(vpState.selectedTheme)} style={{ width: '100%' }}>
                    Create Zine
                </button>
            </div>
        </div>
    )

    const renderHelpModal = () => (
        <div className="premium-modal-overlay active" id="helpModal">
            <div className="premium-modal-box" style={{ maxWidth: '900px' }}>
                <button className="premium-modal-close" onClick={() => closeModal('helpModal')}>✕</button>
                <h2 className="premium-modal-h2">Voyagers&apos; Reference Guide</h2>
                <div className="help-layout" style={{ display: 'flex', gap: '2rem' }}>
                    <div className="help-sidebar" style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button className={`filter-tag ${helpTab === 'shortcuts' ? 'active' : ''}`} onClick={() => setHelpTab('shortcuts')} style={{ width: '100%', textAlign: 'left' }}>⌨ Shortcuts</button>
                        <button className={`filter-tag ${helpTab === 'actions' ? 'active' : ''}`} onClick={() => setHelpTab('actions')} style={{ width: '100%', textAlign: 'left' }}>🧠 Logic Actions</button>
                        <button className={`filter-tag ${helpTab === 'vfx' ? 'active' : ''}`} onClick={() => setHelpTab('vfx')} style={{ width: '100%', textAlign: 'left' }}>🪄 Screen Effects</button>
                        <button className={`filter-tag ${helpTab === 'shaders' ? 'active' : ''}`} onClick={() => setHelpTab('shaders')} style={{ width: '100%', textAlign: 'left' }}>🎨 Shaders</button>
                    </div>
                    <div className="help-content-area" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px' }}>
                        {helpTab === 'shortcuts' && (
                            <div className="help-pane active">
                                <h3 style={{ marginTop: 0 }}>Editor Shortcuts</h3>
                                <div className="shortcut-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    {[
                                        ['Undo', 'Ctrl+Z'], ['Redo', 'Ctrl+Shift+Z'],
                                        ['Copy', 'Ctrl+C'], ['Paste', 'Ctrl+V'],
                                        ['Delete', 'Del / Backspace'], ['Quick Save', 'Ctrl+S']
                                    ].map(([label, key]) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--vp-border)', paddingBottom: '0.5rem' }}>
                                            <span>{label}</span>
                                            <kbd style={{ background: 'var(--vp-surface)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{key}</kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* More tabs... (keeping it concise) */}
                        {helpTab !== 'shortcuts' && <p style={{ color: 'var(--vp-text-dim)' }}>Reference section for {helpTab}...</p>}
                    </div>
                </div>
            </div>
        </div>
    )

    const renderPremiumModal = () => (
        <div className="premium-modal-overlay active" id="premiumModal">
            <div className="premium-modal-box" style={{ maxWidth: '750px' }}>
                <button className="premium-modal-close" onClick={() => closeModal('premiumModal')}>✕</button>
                <h2 className="premium-modal-h2" style={{ textAlign: 'center' }}>Elevate Your Creaton</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--vp-border)' }}>
                        <h3 style={{ margin: 0, opacity: 0.6 }}>Standard Voyager</h3>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '1rem 0' }}>$0</div>
                        <ul style={{ listStyle: 'none', padding: 0, color: 'var(--vp-text-dim)', lineHeight: 2 }}>
                            <li>✓ 3 Active published zines</li>
                            <li>✓ Core design themes</li>
                            <li>✓ HTML/PDF export</li>
                        </ul>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(0,0,0,0))', padding: '2rem', borderRadius: '16px', border: '1px solid var(--vp-accent)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'var(--vp-accent)', color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: '20px' }}>MOST POPULAR</div>
                        <h3 style={{ margin: 0 }}>Void Sovereign</h3>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '1rem 0' }}>$5<span style={{ fontSize: '1rem', color: 'var(--vp-text-dim)' }}>/mo</span></div>
                        <ul style={{ listStyle: 'none', padding: 0, lineHeight: 2 }}>
                            <li>✓ Unlimited zine publishing</li>
                            <li>✓ Sovereign discovery priority</li>
                            <li>✓ Custom branding & assets</li>
                            <li>✓ Advanced analytics</li>
                        </ul>
                        <button className="btn-premium" onClick={() => { updateVpState({ user: { ...vpState.user, is_premium: true } }); closeModal('premiumModal'); }} style={{ width: '100%', marginTop: '1.5rem' }}>
                            Ascend Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <>
            {vpState.modals?.authModal?.active && renderAuthModal()}
            {vpState.modals?.publishModal?.active && renderPublishModal()}
            {vpState.modals?.themePicker?.active && renderThemePickerModal()}
            {vpState.modals?.themePickerModal?.active && renderThemePickerModal()}
            {vpState.modals?.helpModal?.active && renderHelpModal()}
            {vpState.modals?.premiumModal?.active && renderPremiumModal()}
            {vpState.modals?.assetModal?.active && (
                <AssetModal
                    type={vpState.modals.assetModal.subtype}
                    onClose={() => closeModal('assetModal')}
                />
            )}
            {vpState.modals?.exportModal?.active && (
                <ExportModal onClose={() => closeModal('exportModal')} />
            )}
        </>
    )
}

export default Modal
