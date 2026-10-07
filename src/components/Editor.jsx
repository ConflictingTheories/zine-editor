/*
 * Component: Editor
 * Editor container for the canvas, toolbar, properties, and active element workflow.
 */

import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { PHOTO_ACCEPT } from '../lib/rawPhoto.js'
import Canvas from './Canvas.jsx'
import PropertyPanel from './PropertyPanel.jsx'
import StorageManager from './StorageManager.jsx'
import ElementContent from './ElementContent.jsx'
import { BUILT_IN_TEMPLATES } from '../data/pageTemplates.js'
import PortfolioWorkspace from './portfolio/PortfolioWorkspace.jsx'
import { PAGE_W, PAGE_H } from '../constants.js'

/**
 * Component: Editor
 * Top-level editor view that composes the left page list, canvas, and
 * right-hand property panel. Provides keyboard shortcuts and toolbar
 * action handlers which call into `useVP()` helper functions.
 */

/* ── Inline SVG icons for the toolbar ───────────────────────────────────── */
const IcoText = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M1.5 2.5h10M6.5 2.5v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M4 10.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
const IcoPanel = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" /><line x1="6.5" y1="1.5" x2="6.5" y2="11.5" stroke="currentColor" strokeWidth="1.3" /></svg>
const IcoShape = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="2" y="2" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" /></svg>
const IcoBalloon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1.5a5 5 0 1 1 0 8h-3l1-2a5 5 0 0 1-3-3.75" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
const IcoSfx = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2 9 L4 4 L6.5 10 L8.5 6.5 L10 8.5 L12 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoEffect = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1 L7.5 4.5 L11 5.5 L7.5 6.5 L6.5 10 L5.5 6.5 L2 5.5 L5.5 4.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>
const Ico3D = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1.5L11 4v5l-4.5 2.5L2 9V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M2 4l4.5 2.5L11 4" stroke="currentColor" strokeWidth="1.3" /><line x1="6.5" y1="6.5" x2="6.5" y2="11.5" stroke="currentColor" strokeWidth="1.3" /></svg>
const IcoGrid = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M1 4.5h11M1 8.5h11M4.5 1v11M8.5 1v11" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.7" /></svg>
const IcoSnap = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" /><rect x="7.5" y="7.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" /><path d="M5.5 3.5h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
const IcoUndo = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2 5.5 A5 5 0 1 1 7 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><polyline points="2,2.5 2,5.5 5,5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoRedo = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M11 5.5 A5 5 0 1 0 6 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><polyline points="11,2.5 11,5.5 8,5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoSave = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2 2h7l2 2v7H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><rect x="4" y="7.5" width="5" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" /><rect x="4" y="2" width="4" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.1" /></svg>
const IcoPreview = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 4.5l5 2-5 2z" fill="currentColor" /></svg>
const IcoExport = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1.5v7M4 6l2.5 3 2.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 9.5v2h9v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
const IcoPublish = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><circle cx="6.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" /><path d="M1.5 11.5c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
const IcoImport = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M6.5 4.5v4M4.5 7l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoLib = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" /><rect x="7.5" y="1.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" /><rect x="1.5" y="7.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" /><rect x="7.5" y="7.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" /></svg>
const IcoAudio = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M3.5 4.5L7 2.5v8L3.5 8.5H1.5v-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M9 4.5a3 3 0 0 1 0 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M10.5 3a5.5 5.5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
const IcoLightTable = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" /><circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.2" /></svg>
const IcoSymbol = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2 10L6.5 2 11 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><line x1="3.5" y1="7.5" x2="9.5" y2="7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>

function PageThumbnail({ page, index, active, onSelect }) {
    const landscape = page.orientation === 'landscape'
    const pageWidth = landscape ? PAGE_H : PAGE_W
    const pageHeight = landscape ? PAGE_W : PAGE_H

    return (
        <button
            type="button"
            className={`page-thumb ${active ? 'active' : ''}`}
            style={{ background: page.background || '#fff' }}
            onClick={onSelect}
            aria-label={`Go to page ${index + 1}`}
        >
            <span
                className="page-thumb-preview"
                style={{
                    width: pageWidth,
                    height: pageHeight,
                    transform: 'translate(-50%, -50%) scale(0.11)'
                }}
            >
                {(page.elements || [])
                    .filter(element => !element.hidden)
                    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                    .map(element => (
                        <span
                            key={element.id}
                            className={`el ${element.locked ? 'locked' : ''}`}
                            style={{
                                left: element.x || 0,
                                top: element.y || 0,
                                width: element.width || 100,
                                height: element.height || 100,
                                transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                                zIndex: element.zIndex || 1,
                                opacity: element.opacity ?? 1,
                                pointerEvents: 'none'
                            }}
                        >
                            <ElementContent el={element} pageIdx={index} updateElement={() => { }} />
                        </span>
                    ))}
            </span>
            <span className="page-thumb-num">{index + 1}</span>
        </button>
    )
}

/**
 * Memoised page thumbnail.
 *
 * These render real element content for every page at 0.11 scale. Because the
 * project is now updated structurally, only the page being edited gets a new
 * object — so this bails out for every other thumbnail instead of re-rendering
 * the entire book's worth of DOM sixty times a second during a drag.
 */
const MemoPageThumbnail = React.memo(
    PageThumbnail,
    (prev, next) => prev.page === next.page && prev.active === next.active && prev.index === next.index
)

function Editor() {
    const { vpState, updateVpState, updateProjectSettings, addElement, addElements, addPage, addPageFromTemplate, importMedia, deletePage, duplicatePage, undo, redo, saveProject, showModal, closeModal, previewProject, applyTheme, insertTemplate, deleteElement, copyElement, pasteElement, duplicateElement, moveLayer, updateElement, updatePage, setBackgroundAudio, setPageAudio, themes, showView } = useVP()
    const [storageOpen, setStorageOpen] = useState(false)
    const pageIdx = vpState.selection?.pageIdx ?? 0
    const setCurrentPageIdx = (idx) => {
        const pages = vpState.currentProject?.pages || []
        if (!pages.length) return
        const safeIdx = Math.min(Math.max(idx, 0), pages.length - 1)
        updateVpState({ selection: { type: 'page', id: pages[safeIdx]?.id, pageIdx: safeIdx } })
    }
    const [zoom, setZoom] = useState(100)
    const [gridOn, setGridOn] = useState(false)
    const [snapOn, setSnapOn] = useState(true)
    const [propTab, setPropTab] = useState('props')
    const [leftTab, setLeftTab] = useState('pages')
    const [workspaceMode, setWorkspaceMode] = useState('compose')
    const [audioLoop, setAudioLoop] = useState(true)

    const project = vpState.currentProject
    const pages = project?.pages || []
    const safePageIdx = pages.length ? Math.min(Math.max(pageIdx, 0), pages.length - 1) : 0
    const currentPage = pages[safePageIdx] || { id: 'empty-page', elements: [], background: '#fff', orientation: 'portrait' }
    const themeStatus = themes[project?.theme || 'classic']?.status || 'STABLE'
    const isPortfolio = project?.editorMode === 'photo-portfolio'
    const templateOptions = isPortfolio
        ? [...BUILT_IN_TEMPLATES.filter(template => template.category === 'Photo & Portfolio'), ...(vpState.templates || [])]
        : [...BUILT_IN_TEMPLATES, ...(vpState.templates || [])]

    useEffect(() => {
        const onKey = (e) => {
            if (!project || !pages.length) return
            const tag = e.target?.tagName
            const editing = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

            if (e.shiftKey && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const selection = vpState.selection
                const page = pages[safePageIdx]
                const element = selection?.type === 'element' && page?.elements?.find(el => el.id === selection.id)
                if (element) {
                    e.preventDefault()
                    const delta = 10
                    const updates = {}
                    if (e.key === 'ArrowDown') updates.y = (element.y || 0) + delta
                    if (e.key === 'ArrowUp') updates.y = (element.y || 0) - delta
                    if (e.key === 'ArrowLeft') updates.x = (element.x || 0) - delta
                    if (e.key === 'ArrowRight') updates.x = (element.x || 0) + delta
                    if (Object.keys(updates).length) updateElement(pageIdx, element.id, updates)
                    return
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') copyElement()
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteElement() }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject() }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!editing) deleteElement()
            }
            if (e.key === 'Escape') updateVpState({ selection: { type: 'page', id: currentPage?.id, pageIdx } })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [project, pages, safePageIdx, currentPage?.id, undo, redo, copyElement, pasteElement, saveProject, deleteElement])

    useEffect(() => {
        if (pages.length && pageIdx !== safePageIdx) {
            updateVpState({ selection: { type: 'page', id: pages[safePageIdx]?.id, pageIdx: safePageIdx } })
        }
    }, [pages.length, pageIdx, safePageIdx])

    if (!project || !pages.length) {
        return <div className="editor-empty">No project selected. Create or open a book from the Dashboard.</div>
    }

    // Portfolio projects get a photography-native workspace. Sharing the zine
    // editor's chrome and toolbar was the core mismatch: the flows are
    // genuinely different, not the same tool with fewer buttons.
    if (isPortfolio) {
        return <PortfolioWorkspace project={project} pageIdx={pageIdx} />
    }

    const handleAddText = () => {
        addElement(pageIdx, {
            type: 'text',
            content: 'Enter text here...',
            x: 80,
            y: 80,
            width: 220,
            height: 50,
            fontSize: 18,
            fontFamily: 'Crimson Text',
            color: '#0a0a0a',
            align: 'left',
            bold: false,
            italic: false
        })
    }

    const handleAddImage = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (e) => {
            const file = e.target.files[0]
            if (!file) return
            // Single pipeline: bytes to IndexedDB, metadata to the library.
            // The element links by assetId; its src is re-resolved from the
            // blob store on every project open, so it can never be persisted
            // as a dead blob: URL or a quota-eating base64 blob.
            const [asset] = await importMedia(e.target.files, 'image')
            if (!asset) return
            addElement(pageIdx, {
                type: 'image',
                src: asset.src,
                assetId: asset.id,
                assetName: asset.name || asset.id,
                x: 80,
                y: 80,
                width: 200,
                height: 200
            })
        }
        input.click()
    }

    /**
     * Image import, through the single shared media pipeline
     * (importMediaFiles → commitAssets → IndexedDB). Also serves canvas
     * drag-drop via the `importFiles` prop.
     */
    const importFiles = async (files) => {
        await importMedia(files, 'image')
    }

    const handleZoomFit = () => {
        const wrap = document.getElementById('canvasWrap')
        if (wrap && currentPage) {
            const canvas = wrap.querySelector('.ed-canvas')
            if (canvas) {
                const isLandscape = currentPage?.orientation === 'landscape'
                const w = isLandscape ? PAGE_H : PAGE_W
                const h = isLandscape ? PAGE_W : PAGE_H
                const scale = Math.min((wrap.clientWidth - 80) / w, (wrap.clientHeight - 80) / h, 1)
                setZoom(Math.round(scale * 100))
            }
        }
    }

    const updatePageOrientation = (orientation) => updatePage(pageIdx, { orientation })

    const openAudioPicker = (scope) => {
        const target = scope === 'page' ? 'audio-page' : 'audio-background'
        showModal('assetModal', `${target}-${audioLoop ? 'loop' : 'once'}`)
    }

    return (
        <div className="editor" id="editorContainer">
            <div className="ed-toolbar-top">
                {/* Mode tabs — Compose / Library / Settings */}
                <div className="ed-workspace-modes" role="tablist" aria-label="Editor workspace">
                    {[['compose', isPortfolio ? 'Build' : 'Compose'], ['media', 'Library'], ['settings', 'Settings']].map(([mode, label]) => (
                        <button key={mode} type="button" role="tab" aria-selected={workspaceMode === mode}
                            className={`ed-workspace-tab ${workspaceMode === mode ? 'active' : ''}`}
                            onClick={() => setWorkspaceMode(mode)}>{label}</button>
                    ))}
                </div>

                {/* Context tools — vary by workspace mode */}
                <div className="ed-toolbar-context">
                    {workspaceMode === 'compose' && (
                        <>
                            {/* History */}
                            <div className="ed-tool-group">
                                <button className="ed-tool icon-tool" title="Undo (⌘Z)" onClick={undo}><IcoUndo /><span>Undo</span></button>
                                <button className="ed-tool icon-tool" title="Redo (⌘⇧Z)" onClick={redo}><IcoRedo /><span>Redo</span></button>
                            </div>
                            <span className="ed-toolbar-divider" aria-hidden="true" />
                            {/* Insert elements */}
                            <div className="ed-tool-group">
                                <span className="ed-tool-group-label">Insert</span>
                                <button className="ed-tool icon-tool" title="Add text block" onClick={handleAddText}><IcoText /><span>Text</span></button>
                                <button className="ed-tool icon-tool" title={isPortfolio ? 'Add photo frame' : 'Add panel'} onClick={() => showModal('assetModal', 'panels')}><IcoPanel /><span>{isPortfolio ? 'Frame' : 'Panel'}</span></button>
                                {!isPortfolio && <button className="ed-tool icon-tool" title="Add shape" onClick={() => showModal('assetModal', 'shapes')}><IcoShape /><span>Shape</span></button>}
                                {!isPortfolio && <button className="ed-tool icon-tool" title="Add speech balloon" onClick={() => showModal('assetModal', 'balloons')}><IcoBalloon /><span>Balloon</span></button>}
                                {!isPortfolio && <button className="ed-tool icon-tool" title="Add sound effect text" onClick={() => showModal('assetModal', 'sfx')}><IcoSfx /><span>SFX</span></button>}
                                {!isPortfolio && <button className="ed-tool icon-tool" title="Add symbol" onClick={() => showModal('assetModal', 'symbols')}><IcoSymbol /><span>Symbol</span></button>}
                                <button className="ed-tool icon-tool" title="Add ethereal effect / shader" onClick={() => showModal('assetModal', 'shaders')}><IcoEffect /><span>Effect</span></button>
                                {!isPortfolio && <button className="ed-tool icon-tool" title="Add 3D object" onClick={() => showModal('assetModal', 'objects')}><Ico3D /><span>3D</span></button>}
                            </div>
                            <span className="ed-toolbar-divider" aria-hidden="true" />
                            {/* View options */}
                            <div className="ed-tool-group">
                                <span className="ed-tool-group-label">View</span>
                                <button className={`ed-tool icon-tool ${gridOn ? 'active' : ''}`} title="Toggle grid" onClick={() => setGridOn(!gridOn)}><IcoGrid /><span>Grid</span></button>
                                <button className={`ed-tool icon-tool ${snapOn ? 'active' : ''}`} title="Snap to grid" onClick={() => setSnapOn(!snapOn)}><IcoSnap /><span>Snap</span></button>
                            </div>
                        </>
                    )}

                    {workspaceMode === 'media' && (
                        <>
                            <div className="ed-tool-group">
                                <span className="ed-tool-group-label">Import</span>
                                <button className="ed-tool icon-tool" title="Import a single image" onClick={handleAddImage}><IcoImport /><span>Image</span></button>
                                <button className="ed-tool icon-tool" title="Bulk import images to library" onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = PHOTO_ACCEPT; i.multiple = true; i.onchange = e => importFiles(e.target.files); i.click() }}><IcoImport /><span>Bulk</span></button>
                                <button className="ed-tool icon-tool" title="Import audio files" onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*'; i.multiple = true; i.onchange = e => importMedia(e.target.files, 'audio'); i.click() }}><IcoAudio /><span>Audio</span></button>
                            </div>
                            <span className="ed-toolbar-divider" aria-hidden="true" />
                            <div className="ed-tool-group">
                                <span className="ed-tool-group-label">Library</span>
                                <button className="ed-tool icon-tool" title="Browse image library" onClick={() => showModal('assetModal', 'imported')}><IcoLib /><span>Images</span></button>
                                <button className="ed-tool icon-tool" title="Open Light Table for developing photos" onClick={() => showView('lighttable')}><IcoLightTable /><span>Light Table</span></button>
                                <button className="ed-tool icon-tool" title="Browse audio library" onClick={() => showModal('assetModal', 'audio')}><IcoAudio /><span>Audio</span></button>
                                <button className="ed-tool icon-tool" title="Set project background audio" onClick={() => openAudioPicker('project')}><IcoAudio /><span>Set BGM</span></button>
                            </div>
                        </>
                    )}

                    {workspaceMode === 'settings' && (
                        <span className="ed-toolbar-hint">Configure project-wide defaults in the left panel.</span>
                    )}
                </div>

                {/* Right cluster — always visible */}
                <div className="ed-toolbar-actions">
                    <button className="ed-action-btn" title="Save (⌘S)" onClick={saveProject}><IcoSave /><span>Save</span></button>
                    <button className="ed-action-btn" title="Preview project" onClick={() => previewProject()}><IcoPreview /><span>Preview</span></button>
                    <button className="ed-action-btn" title="Export to file" onClick={() => showModal('exportModal')}><IcoExport /><span>Export</span></button>
                    <button className="ed-action-btn primary" title="Publish this project" onClick={() => showModal('publishModal')}><IcoPublish /><span>Publish</span></button>
                </div>
            </div>

            {/* Left panel */}
            <div className="ed-left">
                {workspaceMode === 'settings' && <div className="ed-panel-section ed-left-pane zine-settings-pane">
                    <h4>{isPortfolio ? 'Portfolio book settings' : 'Pixozine settings'}</h4>
                    <div className="form-row">
                        <label>Title</label>
                        <input type="text" value={project.title || ''} onChange={event => updateProjectSettings({ title: event.target.value })} />
                    </div>
                    {!isPortfolio && <div className="form-row">
                        <label>Design theme</label>
                        <select value={project.theme || 'classic'} onChange={event => applyTheme(event.target.value)}>
                            {Object.keys(themes).map(theme => <option key={theme} value={theme}>{theme.replace(/(^|[-_])\w/g, value => value.toUpperCase())}</option>)}
                        </select>
                    </div>}
                    {isPortfolio && <p className="prop-hint">The portfolio workspace stays neutral by design. Control typography, spacing, image treatment, and paper/background on each spread.</p>}
                    <div className="settings-divider">Publishing defaults</div>
                    <div className="form-row">
                        <label>Author</label>
                        <input type="text" value={project.publishSettings?.author || ''} onChange={event => updateProjectSettings({ publishSettings: { ...project.publishSettings, author: event.target.value } })} placeholder="Your name or pseudonym" />
                    </div>
                    <div className="form-row">
                        <label>Description</label>
                        <textarea rows="4" value={project.publishSettings?.description || ''} onChange={event => updateProjectSettings({ publishSettings: { ...project.publishSettings, description: event.target.value } })} placeholder="What is this pixozine about?" />
                    </div>
                    <div className="form-row">
                        <label>Monetization</label>
                        <select value={project.publishSettings?.monetizationType || 'free'} onChange={event => updateProjectSettings({ publishSettings: { ...project.publishSettings, monetizationType: event.target.value } })}>
                            <option value="free">Free</option>
                            <option value="crowdfund">Crowdfund</option>
                            <option value="one_time">One-time payment</option>
                            <option value="subscription">Subscription</option>
                            <option value="token">Token gated</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Tags</label>
                        <input type="text" value={project.publishSettings?.tags || ''} onChange={event => updateProjectSettings({ publishSettings: { ...project.publishSettings, tags: event.target.value } })} placeholder="art, fiction, field-notes" />
                    </div>
                    <p className="prop-hint">These values prefill the publishing form and are saved with this pixozine.</p>
                </div>}
                {workspaceMode === 'media' && <div className="ed-panel-section ed-left-pane media-pane">
                    <h4>Media library</h4>
                    <p className="ed-pane-hint">Images and audio stay reusable across this workspace.</p>
                    <button className="ed-panel-btn" onClick={() => showModal('assetModal', 'imported')}>Browse image library</button>
                    <button className="ed-panel-btn" onClick={() => showView('lighttable')}>✦ Grade images in Light Table</button>
                    <button className="ed-panel-btn" onClick={() => showModal('assetModal', 'audio')}>Browse audio library</button>
                    <div className="media-library-summary"><strong>{vpState.library?.imported?.length || 0}</strong><span>images saved</span><strong>{vpState.library?.audio?.length || 0}</strong><span>audio files saved</span></div>
                    <button className="ed-panel-btn" onClick={() => setStorageOpen(true)}>Manage storage</button>
                    {storageOpen && <StorageManager onClose={() => setStorageOpen(false)} />}
                    <div className="settings-divider">Page audio</div>
                    <button className="ed-panel-btn" onClick={() => openAudioPicker('page')}>♫ Choose page audio</button>
                    {(project.backgroundAudio || currentPage.backgroundAudio) && <button className="ed-panel-btn" onClick={() => { if (currentPage.backgroundAudio) setPageAudio(pageIdx, null); else setBackgroundAudio(null) }}>■ Remove Audio</button>}
                    <select value={audioLoop ? 'loop' : 'once'} onChange={event => setAudioLoop(event.target.value === 'loop')} className="media-loop-select"><option value="loop">Loop playback</option><option value="once">Play once</option></select>
                </div>}
                {workspaceMode === 'compose' && <>
                    <div className="ed-left-tabs" role="tablist" aria-label="Editor sidebar">
                        {['pages', 'templates', 'layers'].map(tab => (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={leftTab === tab}
                                className={`ed-left-tab ${leftTab === tab ? 'active' : ''}`}
                                onClick={() => setLeftTab(tab)}
                            >
                                {isPortfolio && tab === 'pages' ? 'Spreads' : isPortfolio && tab === 'templates' ? 'Layouts' : tab[0].toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    {leftTab === 'pages' && <div className="ed-panel-section ed-left-pane">
                        <h4>{isPortfolio ? 'Spreads' : 'Pages'} <span>{pages.length}</span></h4>
                        <div className="ed-panel-actions">
                            <button className="ed-panel-btn" onClick={addPage}>+ {isPortfolio ? 'Blank Spread' : 'Blank Page'}</button>
                            <button className="ed-panel-btn" onClick={() => insertTemplate(isPortfolio ? 'cover-photo' : 'cover')}>📕 {isPortfolio ? 'Portfolio Cover' : 'Cover Page'}</button>
                            <button className="ed-panel-btn" onClick={() => insertTemplate(isPortfolio ? 'photo-grid' : 'content')}>📄 {isPortfolio ? 'Photo Grid' : 'Theme Page'}</button>
                            {!isPortfolio && <button className="ed-panel-btn" onClick={() => insertTemplate('back')}>📗 Back Cover</button>}
                            <button className="ed-panel-btn template-launch" onClick={() => isPortfolio ? setLeftTab('templates') : showModal('templateModal', 'browse')}>✦ {isPortfolio ? 'Browse layouts' : 'Browse Templates'}</button>
                            <button className="ed-panel-btn" onClick={duplicatePage}>⧉ Duplicate</button>
                            <button className="ed-panel-btn" onClick={deletePage}>✕ Delete Page</button>
                        </div>
                        <div className="page-thumbs" id="pageThumbs">
                            {pages.map((p, i) => <MemoPageThumbnail key={p.id} page={p} index={i} active={i === pageIdx} onSelect={() => setCurrentPageIdx(i)} />)}
                        </div>
                    </div>}
                    {leftTab === 'templates' && <div className="ed-panel-section ed-left-pane">
                        <h4>{isPortfolio ? 'Portfolio layouts' : 'Template Library'} <span>{templateOptions.length}</span></h4>
                        <p className="ed-pane-hint">{isPortfolio ? 'Start a spread with a photography-first layout.' : 'Add a prepared page to your project.'}</p>
                        <div className="template-side-list">
                            {templateOptions.map(template => (
                                <button
                                    key={template.id}
                                    type="button"
                                    className="template-side-item"
                                    onClick={() => addPageFromTemplate(template)}
                                >
                                    <span className="template-side-item-heading">
                                        <strong>{template.name}</strong>
                                        <span>{template.category || 'My Templates'}</span>
                                    </span>
                                    <span>{template.description || 'Custom page template'}</span>
                                </button>
                            ))}
                        </div>
                    </div>}
                    {leftTab === 'layers' && <div className="ed-panel-section ed-left-pane layers-pane">
                        <h4>Layers <span>{currentPage.elements?.length || 0}</span></h4>
                        <div id="layerList" className="layer-list">
                            {[...(currentPage.elements || [])].reverse().map(el => (
                                <div
                                    key={el.id}
                                    className={`layer-item ${vpState.selection?.id === el.id ? 'active' : ''}`}
                                    onClick={() => updateVpState({ selection: { type: 'element', id: el.id, pageIdx } })}
                                >
                                    <span className="layer-name">{el.locked ? '🔒 ' : ''}{el.type === 'text' || el.type === 'balloon' ? (typeof el.content === 'string' ? el.content : '').substring(0, 18) || el.type : el.type}{el.label ? ` (${el.label})` : ''}</span>
                                    <button className="layer-btn" onClick={(e) => {
                                        e.stopPropagation()
                                        updateElement(pageIdx, el.id, { hidden: !el.hidden })
                                    }} title="Toggle visibility">👁</button>
                                </div>
                            ))}
                        </div>
                    </div>}
                </>}
            </div>

            {/* Canvas Area */}
            <div className="ed-canvas-area">
                <div className="ed-canvas-bar">
                    <div className="zoom-group">
                        <button onClick={() => setZoom(z => Math.max(25, z - 10))}>−</button>
                        <span id="zoomLevel">{zoom}%</span>
                        <button onClick={() => setZoom(z => Math.min(200, z + 10))}>+</button>
                        <button onClick={handleZoomFit}>Fit</button>
                    </div>
                    <div className="zoom-group">
                        <select
                            aria-label="Page orientation"
                            className="zoom-select"
                            value={currentPage?.orientation || 'portrait'}
                            onChange={(e) => updatePageOrientation(e.target.value)}
                        >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    </div>
                </div>
                <div className="ed-canvas-wrap" id="canvasWrap">
                    <div
                        className="ed-canvas-zoom"
                        style={{
                            width: `${(currentPage.orientation === 'landscape' ? PAGE_H : PAGE_W) * zoom / 100}px`,
                            height: `${(currentPage.orientation === 'landscape' ? PAGE_W : PAGE_H) * zoom / 100}px`,
                            '--canvas-scale': zoom / 100
                        }}
                    >
                        <Canvas page={currentPage} pageIdx={safePageIdx} snapOn={snapOn} gridOn={gridOn} zoom={zoom} importFiles={importFiles} />
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="ed-right">
                <div className="prop-tabs" id="propTabs">
                    <button className={`prop-tab ${propTab === 'props' ? 'active' : ''}`} onClick={() => setPropTab('props')}>Design</button>
                    <button className={`prop-tab ${propTab === 'effects' ? 'active' : ''}`} onClick={() => setPropTab('effects')}>Effects</button>
                    {!isPortfolio && <button className={`prop-tab ${propTab === 'logic' ? 'active' : ''}`} onClick={() => setPropTab('logic')}>Interactions</button>}
                </div>
                <div className="prop-pane active">
                    <PropertyPanel activeTab={propTab} />
                </div>
            </div>

            {/* Footer */}
            <div className="ed-footer">
                <span>{isPortfolio ? 'Spread' : 'Page'} <b id="pageNum">{safePageIdx + 1}</b> of <b id="pageTotal">{pages.length}</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.max(0, safePageIdx - 1))}>◀ Prev</button>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.min(pages.length - 1, safePageIdx + 1))}>Next ▶</button>
                </div>
                <span className="status-text" id="statusText">REALITY: {themeStatus}</span>
            </div>
        </div>
    )
}

export default Editor
