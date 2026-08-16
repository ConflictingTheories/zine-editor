/*
 * Component: ExportModal
 * Allows users to export zines to PDF, HTML, or other shareable formats.
 */

import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { exportToHTML, exportToPDF, exportToFoldablePDF, exportToSvrn, importFromSvrn } from '../utils/exportSystem'
import { getPrintReadiness } from '../utils/publication.js'

const styles = {
    desc: { marginBottom: 12, fontSize: '0.9em', color: 'var(--vp-text-dim)' },
    btn: { marginTop: 12 }
}

/**
 * Component: ExportModal
 * Offers multiple export formats (PDF, foldable PDF, HTML, interactive)
 * and toggles such as embedding assets for offline use. Delegates the
 * heavy lifting to `utils/exportSystem` helpers.
 *
 * Props:
 * - onClose: function invoked when the modal should close
 */
function ExportModal({ onClose }) {
    const { vpState, updateVpState, toast } = useVP()
    const { currentProject } = vpState
    const [exportTab, setExportTab] = useState('pdf')
    const [embedAssets, setEmbedAssets] = useState(true)
    const printReadiness = getPrintReadiness(currentProject)
    const hasLandscapePages = currentProject?.pages?.some(page => page.orientation === 'landscape')

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

    const handleExportSvrn = async () => {
        if (!currentProject) return
        try {
            await exportToSvrn(currentProject)
            toast('Portable .svrn package created', 'success')
            onClose()
        } catch (error) {
            const details = error.failures?.map(item => item.source).join(', ')
            toast(`Could not embed package assets${details ? `: ${details}` : ''}`, 'error')
        }
    }

    const handleImportSvrn = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            const project = await importFromSvrn(file)
            const imported = { ...project, id: `svrn_${Date.now()}`, _dirty: true }
            updateVpState({
                projects: [imported, ...(vpState.projects || [])], currentProject: imported,
                currentView: 'editor', selection: { type: 'page', id: imported.pages[0]?.id, pageIdx: 0 }
            })
            toast('Verified .svrn imported into editor', 'success')
            onClose()
        } catch (error) { toast(error.message || 'Could not import .svrn', 'error') }
    }

    return (
        <div className="modal-overlay active">
            <div className="modal-box">
                <button className="modal-close" onClick={onClose}>✕</button>
                <h2>Export Zine</h2>
                <div className="export-tabs">
                    <button className={`export-tab ${exportTab === 'pdf' ? 'active' : ''}`} onClick={() => setExportTab('pdf')}>PDF (Standard)</button>
                    <button className={`export-tab ${exportTab === 'foldable' ? 'active' : ''}`} onClick={() => setExportTab('foldable')}>PDF (One-Sheet Zine)</button>
                    <button className={`export-tab ${exportTab === 'html' ? 'active' : ''}`} onClick={() => setExportTab('html')}>HTML (Web)</button>
                    <button className={`export-tab ${exportTab === 'svrn' ? 'active' : ''}`} onClick={() => setExportTab('svrn')}>SVRN Package</button>
                </div>

                <div style={{ margin: '15px 0', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={embedAssets} onChange={e => setEmbedAssets(e.target.checked)} />
                        <span><b>Compile all files (Offline Mode)</b><br /><small style={{ color: '#aaa' }}>Embeds libraries and assets. No internet required to view.</small></span>
                    </label>
                </div>

                {exportTab === 'pdf' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Export as a static, print-first PDF. Digital-only elements are omitted and fallbacks are substituted.</p>
                        {(printReadiness.review || printReadiness.hidden || printReadiness.fallbacks) > 0 && <p className="prop-hint">Print audit: {printReadiness.review} element{printReadiness.review === 1 ? '' : 's'} need a chosen treatment; {printReadiness.fallbacks} fallback{printReadiness.fallbacks === 1 ? '' : 's'}; {printReadiness.hidden} omitted.</p>}
                        <button className="topnav-btn" onClick={handleExportPDF} style={styles.btn}>Generate PDF</button>
                    </div>
                )}
                {exportTab === 'foldable' && (
                    <div className="export-content active">
                        <p style={styles.desc}>
                            Export as a classic single-sheet cut-and-fold zine: one landscape sheet produces an 8-page folded mini-zine.
                            {currentProject?.pages?.length
                                ? ` This project will produce ${Math.max(1, Math.ceil(currentProject.pages.length / 8))} one-sheet zine${Math.ceil((currentProject.pages.length || 1) / 8) === 1 ? '' : 's'} (${currentProject.pages.length} pages).`
                                : ''}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--vp-text-dim)', marginBottom: '8px' }}>
                            Print single-sided. Fold on the blue guides, cut the red centre slit, then push the cut open into an 8-page booklet. Incomplete final sheets are padded with blank pages.
                        </p>
                        {hasLandscapePages && <p className="prop-hint">Foldable signatures use portrait digest cells. Export landscape pages as Standard PDF for their intended layout.</p>}
                        <button className="topnav-btn" onClick={handleExportFoldable} style={styles.btn}>Generate Foldable PDF</button>
                    </div>
                )}
                {exportTab === 'html' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Export as standalone HTML with navigation.</p>
                        <button className="topnav-btn" onClick={handleExportHTML} style={styles.btn}>Generate HTML</button>
                    </div>
                )}
                {exportTab === 'svrn' && (
                    <div className="export-content active">
                        <p style={styles.desc}>Create a compressed, self-contained <code>.svrn</code> issue. Its assets are verified with SHA-256 hashes when opened by a reader or node.</p>
                        <button className="topnav-btn" onClick={handleExportSvrn} style={styles.btn}>Download .svrn</button>
                        <label className="topnav-btn" style={{ ...styles.btn, display: 'inline-block', marginLeft: 8, cursor: 'pointer' }}>
                            Import .svrn<input type="file" accept=".svrn,application/vnd.svrn+zip,application/zip" onChange={handleImportSvrn} hidden />
                        </label>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ExportModal
