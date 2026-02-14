import React, { useState, useMemo } from 'react'
import { useVP } from '../context/VPContext.jsx'

function AssetModal({ type: initialType, onClose }) {
    const { getAssets, addAsset } = useVP()
    const [currentType, setCurrentType] = useState(initialType || 'panels')
    const [searchQuery, setSearchQuery] = useState('')

    const assetTypes = [
        { id: 'panels', label: 'Panels', icon: '▣' },
        { id: 'shapes', label: 'Shapes', icon: '◆' },
        { id: 'balloons', label: 'Balloons', icon: '💬' },
        { id: 'sfx', label: 'Sound FX', icon: '💥' },
        { id: 'symbols', label: 'Symbols', icon: '✦' },
        { id: 'shaders', label: 'Shaders', icon: '🎨' }
    ]

    const allAssets = useMemo(() => getAssets(currentType), [currentType, getAssets])

    const filteredAssets = useMemo(() => {
        if (!searchQuery) return allAssets
        return allAssets.filter(a =>
            (a.name && a.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (a.id && a.id.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    }, [allAssets, searchQuery])

    const handleSelect = (asset) => {
        addAsset(currentType, asset.id)
        onClose()
    }

    return (
        <div className="modal-overlay active" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Asset Library</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="asset-modal-content">
                    <aside className="asset-sidebar">
                        {assetTypes.map(t => (
                            <button
                                key={t.id}
                                className={`asset-sidebar-btn ${currentType === t.id ? 'active' : ''}`}
                                onClick={() => {
                                    setCurrentType(t.id)
                                    setSearchQuery('')
                                }}
                            >
                                <span style={{ marginRight: '10px' }}>{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </aside>

                    <main className="asset-main">
                        <div className="asset-search">
                            <input
                                type="text"
                                placeholder={`Search ${currentType}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="asset-grid">
                            {filteredAssets.length > 0 ? (
                                filteredAssets.map(asset => (
                                    <div
                                        key={asset.id}
                                        className="asset-item"
                                        onClick={() => handleSelect(asset)}
                                        title={asset.name}
                                    >
                                        <div className="asset-preview" dangerouslySetInnerHTML={{ __html: asset.preview }} />
                                        {asset.name && <div className="asset-name">{asset.name}</div>}
                                    </div>
                                ))
                            ) : (
                                <div style={{
                                    gridColumn: '1/-1',
                                    padding: '40px',
                                    textAlign: 'center',
                                    color: 'var(--vp-text-dim)',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '12px'
                                }}>
                                    No assets found matching "{searchQuery}"
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}

export default AssetModal
