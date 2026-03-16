import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { exportToHTML, exportToPDF, exportToInteractive } from '../utils/exportSystem'

// No inline styles - using CSS classes

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
                    <button className={`export-tab ${exportTab === 'pdf' ? 'active' : ''}`} onClick={() => setExportTab('pdf')}>PDF (Print)</button>
                    <button className={`export-tab ${exportTab === 'html' ? 'active' : ''}`} onClick={() => setExportTab('html')}>HTML (Web)</button>
                    <button className={`export-tab ${exportTab === 'interactive' ? 'active' : ''}`} onClick={() => setExportTab('interactive')}>Interactive</button>
                </div>

                <div className="export-options">
                    <label className="checkbox-row">
                        <input type="checkbox" checked={embedAssets} onChange={e => setEmbedAssets(e.target.checked)} />
                        <span>
                            <b>Compile all files (Offline Mode)</b>
                            <small>Embeds libraries and assets. No internet required to view.</small>
                        </span>
                    </label>
                </div>

                {exportTab === 'pdf' && (
                    <div className="export-content active">
                        <div className="export-option">
                            <p>Print-ready PDF for physical zines</p>
                            <button className="btn-primary" onClick={handleExportPDF}>Generate PDF</button>
                        </div>
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
