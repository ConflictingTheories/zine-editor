import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { exportToHTML, exportToPDF } from '../utils/exportSystem'

const styles = {
    desc: { marginBottom: 12, fontSize: '0.9em', color: 'var(--vp-text-dim)' },
    btn: { marginTop: 12 }
}

function ExportModal({ onClose }) {
    const { vpState } = useVP()
    const { currentProject } = vpState
    const [exportTab, setExportTab] = useState('pdf')

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

    const handleExportInteractive = () => {
        if (currentProject) {
            exportToHTML(currentProject)
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
                {exportTab === 'pdf' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Export as print-ready PDF.</p>
                        <button className="topnav-btn" onClick={handleExportPDF} style={styles.btn}>Generate PDF</button>
                    </div>
                )}
                {exportTab === 'html' && (
                    <div className="export-content">
                        <p style={styles.desc}>Export as standalone HTML with navigation.</p>
                        <button className="topnav-btn" onClick={handleExportHTML} style={styles.btn}>Generate HTML</button>
                    </div>
                )}
                {exportTab === 'interactive' && (
                    <div className="export-content">
                        <p style={styles.desc}>Interactive flipbook with page-turn and interactions.</p>
                        <button className="topnav-btn" onClick={handleExportInteractive} style={styles.btn}>Generate Interactive</button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ExportModal
