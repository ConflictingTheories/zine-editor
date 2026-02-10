import React from 'react'
import { useVP } from '../context/VPContext.jsx'
import { exportToHTML, exportToPDF } from '../utils/exportSystem'

function ExportModal({ onClose }) {
    const { vpState } = useVP()
    const { currentProject } = vpState

    const handleExportHTML = () => {
        if (currentProject) {
            exportToHTML(currentProject)
            onClose()
        }
    }

    const handleExportPDF = () => {
        if (currentProject) {
            exportToPDF(currentProject)
            onClose()
        }
    }

    return (
        <div className="modal-overlay active">
            <div className="modal-box" style={{ maxWidth: '500px' }}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h2>Export Zine</h2>
                <p style={{ color: 'var(--vp-text-dim)', marginBottom: '20px' }}>
                    Choose a format to save your zine to your device.
                </p>
                <div className="export-options" style={{ display: 'grid', gap: '15px' }}>
                    <div className="export-card" onClick={handleExportHTML} style={{ cursor: 'pointer', padding: '15px', border: '1px solid var(--vp-border)', borderRadius: '8px' }}>
                        <h3>🌐 Web Reader (HTML)</h3>
                        <p style={{ fontSize: '0.9em', color: 'var(--vp-text-dim)' }}>A self-contained file with all interactions, music, and shaders. Best for sharing!</p>
                    </div>
                    <div className="export-card" onClick={handleExportPDF} style={{ cursor: 'pointer', padding: '15px', border: '1px solid var(--vp-border)', borderRadius: '8px' }}>
                        <h3>📄 Document (PDF)</h3>
                        <p style={{ fontSize: '0.9em', color: 'var(--vp-text-dim)' }}>Static snapshots of your pages. Good for printing.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ExportModal
