import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { exportToHTML, exportToPDF, exportToInteractive, exportToFoldablePDF } from '../utils/exportSystem'

const styles = {
    desc: { marginBottom: 12, fontSize: '0.9em', color: 'var(--vp-text-dim)' },
    btn: { marginTop: 12 }
}

function ExportModal({ onClose }) {
    const { vpState } = useVP()
    const { currentProject } = vpState
    const [exportTab, setExportTab] = useState('pdf')
    const [embedAssets, setEmbedAssets] = useState(true)

    const handleExportHTML = () => {
        if (currentProject) {
            exportToHTML(currentProject, embedAssets)
            onClose()
        }
    }

    const handleExportPDF = () => {
        if (currentProject) {
            exportToPDF(currentProject, embedAssets)
            onClose()
        }
    }

    const handleExportFoldable = () => {
        if (currentProject) {
            exportToFoldablePDF(currentProject, embedAssets)
            onClose()
        }
    }

    const handleExportInteractive = () => {
        if (currentProject) {
            exportToInteractive(currentProject, embedAssets)
            onClose()
        }
    }

    return (
        <div className="modal-overlay active">
            <div className="modal-box">
                <button className="modal-close" onClick={onClose}>✕</button>
                <h2>Export Zine</h2>
                <div className="export-tabs">
                    <button className={`export-tab ${exportTab === 'pdf' ? 'active' : ''}`} onClick={() => setExportTab('pdf')}>PDF (Standard)</button>
                    <button className={`export-tab ${exportTab === 'foldable' ? 'active' : ''}`} onClick={() => setExportTab('foldable')}>PDF (Foldable 8-Page)</button>
                    <button className={`export-tab ${exportTab === 'html' ? 'active' : ''}`} onClick={() => setExportTab('html')}>HTML (Web)</button>
                    <button className={`export-tab ${exportTab === 'interactive' ? 'active' : ''}`} onClick={() => setExportTab('interactive')}>Interactive</button>
                </div>

                <div style={{ margin: '15px 0', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={embedAssets} onChange={e => setEmbedAssets(e.target.checked)} />
                        <span><b>Compile all files (Offline Mode)</b><br /><small style={{ color: '#aaa' }}>Embeds libraries and assets. No internet required to view.</small></span>
                    </label>
                </div>

                {exportTab === 'pdf' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Export as standard 1-page-per-sheet PDF.</p>
                        <button className="topnav-btn" onClick={handleExportPDF} style={styles.btn}>Generate PDF</button>
                    </div>
                )}
                {exportTab === 'foldable' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Export an 8-page zine onto a single foldable sheet (Letter/A4).</p>
                        <p style={{ fontSize: '11px', color: '#ffb347', marginBottom: '8px' }}>Note: Only the first 8 pages of your project will be included.</p>
                        <button className="topnav-btn" onClick={handleExportFoldable} style={styles.btn}>Generate Foldable PDF</button>
                    </div>
                )}
                {exportTab === 'html' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Export as standalone HTML with navigation.</p>
                        <button className="topnav-btn" onClick={handleExportHTML} style={styles.btn}>Generate HTML</button>
                    </div>
                )}
                {exportTab === 'interactive' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Interactive flipbook with page-turn and interactions.</p>
                        <button className="topnav-btn" onClick={handleExportInteractive} style={styles.btn}>Generate Interactive</button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ExportModal
