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

const styles = {
    authBox: { maxWidth: '400px' },
    centerText: { textAlign: 'center' },
    authBtnGroup: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' },
    fullWidth: { width: '100%' },
    publishBtn: { marginTop: '12px', width: '100%' },
    themeBox: { maxWidth: '700px' },
    themeDesc: { color: 'var(--vp-text-dim)', marginBottom: '12px' },
    createBtn: { width: '100%', marginTop: '20px' },
    helpBox: { maxWidth: '800px' },
    premiumBox: { maxWidth: '700px' },
    premiumDesc: { color: 'var(--vp-text-dim)', marginBottom: '20px' },
    priceSuffix: { fontSize: '0.4em', color: 'var(--vp-text-dim)' },
    upgradeBtn: { width: '100%', marginTop: '16px' }
}

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
        <div className="modal-overlay active" id="authModal">
            <div className="modal-box" style={styles.authBox}>
                <button className="modal-close" onClick={() => closeModal('authModal')}>✕</button>
                <h2 style={styles.centerText}>{authMode === 'login' ? 'Login' : 'Register'}</h2>
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
                    <div style={styles.authBtnGroup}>
                        <button className="btn-primary topnav-btn" type="submit" style={styles.fullWidth}>
                            {authMode === 'login' ? 'Login' : 'Register'}
                        </button>
                        <button
                            className="btn-secondary topnav-btn secondary"
                            type="button"
                            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                            style={styles.fullWidth}
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
                    <button className="topnav-btn" type="submit" style={styles.publishBtn}>
                        🚀 Publish to Void Press
                    </button>
                </form>
            </div>
        </div>
    )

    const renderThemePickerModal = () => (
        <div className="modal-overlay active" id="themePickerModal">
            <div className="modal-box" style={styles.themeBox}>
                <button className="modal-close" onClick={() => closeModal('themePicker')}>✕</button>
                <h2>Choose Your Theme</h2>
                <p style={styles.themeDesc}>
                    Select an aesthetic for your new zine, then click Create Zine.
                </p>
                <div className="theme-grid">
                    {THEME_OPTIONS.map(theme => (
                        <div
                            key={theme.key}
                            className={`theme-card ${vpState.selectedTheme === theme.key ? 'selected' : ''}`}
                            onClick={() => updateVpState({ selectedTheme: theme.key })}
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
                <button className="topnav-btn" onClick={() => createProject(vpState.selectedTheme)} style={styles.createBtn}>
                    Create Zine
                </button>
            </div>
        </div>
    )

    const renderHelpModal = () => (
        <div className="modal-overlay active" id="helpModal">
            <div className="modal-box" style={styles.helpBox}>
                <button className="modal-close" onClick={() => closeModal('helpModal')}>✕</button>
                <h2>Voyagers&apos; Reference Guide</h2>
                <div className="help-layout">
                    <div className="help-sidebar">
                        <button className={`help-nav-btn ${helpTab === 'shortcuts' ? 'active' : ''}`} onClick={() => setHelpTab('shortcuts')}>⌨ Shortcuts</button>
                        <button className={`help-nav-btn ${helpTab === 'actions' ? 'active' : ''}`} onClick={() => setHelpTab('actions')}>🧠 Logic Actions</button>
                        <button className={`help-nav-btn ${helpTab === 'vfx' ? 'active' : ''}`} onClick={() => setHelpTab('vfx')}>🪄 Screen Effects</button>
                        <button className={`help-nav-btn ${helpTab === 'shaders' ? 'active' : ''}`} onClick={() => setHelpTab('shaders')}>🎨 Shaders</button>
                    </div>
                    <div className="help-content-area">
                        {helpTab === 'shortcuts' && (
                            <div className="help-pane active">
                                <h3>Editor Shortcuts</h3>
                                <div className="shortcut-grid">
                                    <div className="shortcut-row"><span>Undo</span><kbd>Ctrl+Z</kbd></div>
                                    <div className="shortcut-row"><span>Redo</span><kbd>Ctrl+Shift+Z</kbd></div>
                                    <div className="shortcut-row"><span>Copy</span><kbd>Ctrl+C</kbd></div>
                                    <div className="shortcut-row"><span>Paste</span><kbd>Ctrl+V</kbd></div>
                                    <div className="shortcut-row"><span>Delete</span><kbd>Del / Backspace</kbd></div>
                                    <div className="shortcut-row"><span>Quick Save</span><kbd>Ctrl+S</kbd></div>
                                </div>
                            </div>
                        )}
                        {helpTab === 'actions' && (
                            <div className="help-pane active">
                                <h3>Narrative Logic Actions</h3>
                                <p>Assign these to elements in the <b>Logic</b> tab to create branching stories.</p>
                                <div className="ref-list">
                                    <div className="ref-item"><b>Go to Page</b><span>Jumps the reader to a specific page number.</span></div>
                                    <div className="ref-item"><b>Unlock Page</b><span>Reveals a locked page in the normal flow.</span></div>
                                    <div className="ref-item"><b>Password Prompt</b><span>Triggers a password check for secret pages.</span></div>
                                    <div className="ref-item"><b>Toggle Element</b><span>Shows or hides another element (requires a Label).</span></div>
                                </div>
                            </div>
                        )}
                        {helpTab === 'vfx' && (
                            <div className="help-pane active">
                                <h3>Screen Effects (VFX)</h3>
                                <p>Dramatic visual triggers: Flash, Lightning, Shake, Pulse.</p>
                                <div className="ref-list">
                                    <div className="ref-item"><b>Flash</b><span>Sudden burst of white light.</span></div>
                                    <div className="ref-item"><b>Lightning</b><span>Double-strobe flickering effect.</span></div>
                                    <div className="ref-item"><b>Shake</b><span>Vibrates the screen.</span></div>
                                    <div className="ref-item"><b>Pulse</b><span>Rhythmic zoom effect.</span></div>
                                </div>
                            </div>
                        )}
                        {helpTab === 'shaders' && (
                            <div className="help-pane active">
                                <h3>Shader Blocks</h3>
                                <p>Add a Shader element from the toolbar for dynamic backgrounds (Plasma, Noise, Geometric).</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )

    const renderPremiumModal = () => (
        <div className="modal-overlay active" id="premiumModal">
            <div className="modal-box" style={styles.premiumBox}>
                <button className="modal-close" onClick={() => closeModal('premiumModal')}>✕</button>
                <h2>Upgrade to Premium</h2>
                <p style={styles.premiumDesc}>Unlock the full power of Void Press.</p>
                <div className="premium-features">
                    <div className="premium-col">
                        <h3>Free</h3>
                        <div className="price">$0</div>
                        <ul>
                            <li>3 published zines (rotating)</li>
                            <li>Basic themes</li>
                            <li>PDF &amp; HTML export</li>
                            <li>Community discovery</li>
                        </ul>
                    </div>
                    <div className="premium-col highlight">
                        <h3>Premium</h3>
                        <div className="price">$5<span style={styles.priceSuffix}>/mo</span></div>
                        <ul>
                            <li>Unlimited publishing</li>
                            <li>Priority in discovery</li>
                            <li>Custom branding</li>
                            <li>Analytics dashboard</li>
                            <li>Premium badge</li>
                            <li>All export formats</li>
                        </ul>
                        <button className="topnav-btn" onClick={() => { updateVpState({ user: { ...vpState.user, is_premium: true } }); closeModal('premiumModal'); }} style={styles.upgradeBtn}>Upgrade Now</button>
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
