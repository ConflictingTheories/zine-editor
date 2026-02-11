import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const styles = {
    modalBox: { maxWidth: '600px' }
}

function AssetModal({ type, onClose }) {
    const { getAssets, addAsset } = useVP()
    const assets = getAssets(type)

    const titles = {
        panels: 'Comic Panels',
        shapes: 'Shapes & Borders',
        balloons: 'Speech Balloons',
        sfx: 'Sound Effects',
        symbols: 'Symbols & Icons',
        shaders: 'Shader Blocks'
    }

    return (
        <div className="modal-overlay active">
            <div className="modal-box" style={styles.modalBox}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h2>{titles[type] || 'Assets'}</h2>
                <div className="asset-grid">
                    {assets.map(asset => (
                        <div
                            key={asset.id}
                            className="asset-item"
                            onClick={() => {
                                addAsset(type, asset.id)
                                onClose()
                            }}
                        >
                            <div className="asset-preview" dangerouslySetInnerHTML={{ __html: asset.preview }} />
                            {asset.name && <div className="asset-name">{asset.name}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default AssetModal
