/*
 * Component: AssetModal
 * Modal content for browsing, selecting, and inserting digital assets into the editor workspace.
 */

import React, { useState, useMemo } from 'react'
import { useVP } from '../context/VPContext.jsx'

/**
 * Component: AssetModal
 * Browse and insert assets (panels, shapes, balloons, sfx, symbols, shaders, objects)
 * from the shared asset library. Filters by type and search query.
 *
 * Props:
 * - type: initial asset category to open (e.g. 'panels')
 * - onClose: function() called when the modal is dismissed
 */
function AssetModal({ type: initialType, onClose }) {
    const { vpState, getAssets, addAsset, importMedia, setBackgroundAudio, setPageAudio, updateElement } = useVP()
    const audioIntent = initialType?.startsWith('audio-page') ? 'page' : initialType?.startsWith('audio-background') ? 'background' : null
    const audioLoop = !initialType?.endsWith('-once')
    const [currentType, setCurrentType] = useState(audioIntent ? 'audio' : (initialType || 'panels'))
    const [searchQuery, setSearchQuery] = useState('')

    const assetTypes = [
        { id: 'panels', label: 'Panels', icon: '▣' },
        { id: 'shapes', label: 'Shapes', icon: '◆' },
        { id: 'balloons', label: 'Balloons', icon: '💬' },
        { id: 'sfx', label: 'Sound FX', icon: '💥' },
        { id: 'symbols', label: 'Symbols', icon: '✦' },
        { id: 'shaders', label: 'Shaders', icon: '🎨' },
        { id: 'objects', label: '3D Objects', icon: '💎' }
        , { id: 'imported', label: 'Imported Images', icon: '▤' },
        { id: 'audio', label: 'Audio Library', icon: '♫' }
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
        if (currentType === 'audio' && audioIntent) {
            if (audioIntent === 'page') setPageAudio(vpState.selection?.pageIdx ?? 0, asset.src, asset.name, audioLoop, asset.id)
            else setBackgroundAudio(asset.src, asset.name, audioLoop, asset.id)
        } else if (currentType === 'imported' && vpState.selection?.type === 'element') {
            const selected = vpState.currentProject?.pages?.[vpState.selection.pageIdx]?.elements?.find(element => element.id === vpState.selection.id)
            // Link by assetId so the src is re-resolved on project open
            // instead of persisting a dead blob: URL.
            if (selected?.type === 'photo-frame') updateElement(vpState.selection.pageIdx, selected.id, { src: asset.src, assetId: asset.id, assetName: asset.name || asset.id })
            else addAsset(currentType, asset.id)
        } else {
            addAsset(currentType, asset.id)
        }
        onClose()
    }

    const importAudio = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'audio/*'
        input.multiple = true
        // Single pipeline: bytes go to IndexedDB via importMedia, never as
        // base64 in the library record. The old FileReader path wrote data:
        // URLs that persistLibrary stripped, orphaning the record.
        input.onchange = event => importMedia(event.target.files, 'audio')
        input.click()
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
                        {currentType === 'audio' && <button type="button" className="asset-sidebar-import" onClick={importAudio}>+ Import audio files</button>}
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

                        <div className="asset-scroll">
                            <div className="asset-grid">
                                {filteredAssets.length > 0 ? (
                                    filteredAssets.map((asset, i) => {
                                        // Render a category divider for symbol categories to keep the vault organized & breathable
                                        const prev = filteredAssets[i - 1]
                                        const showCat = currentType === 'symbols' && asset.category && (!prev || prev.category !== asset.category)
                                        return (
                                            <React.Fragment key={asset.id}>
                                                {showCat && (
                                                    <div className="asset-category">{asset.category}</div>
                                                )}
                                                <div
                                                    className={`asset-item ${asset.kind === 'image' ? 'asset-item-image' : ''}`}
                                                    onClick={() => handleSelect(asset)}
                                                    title={asset.name}
                                                >
                                                    <div className="asset-preview" dangerouslySetInnerHTML={{ __html: asset.preview }} />
                                                    {asset.name && <div className="asset-name">{asset.name}</div>}
                                                </div>
                                            </React.Fragment>
                                        )
                                    })
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
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}

export default AssetModal
