/*
 * Component: Editor
 * Editor container for the canvas, toolbar, properties, and active element workflow.
 */

import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'
import Canvas from './Canvas.jsx'
import PropertyPanel from './PropertyPanel.jsx'
import ElementContent from './ElementContent.jsx'
import { BUILT_IN_TEMPLATES } from '../data/pageTemplates.js'
import { PAGE_W, PAGE_H } from '../constants.js'

/**
 * Component: Editor
 * Top-level editor view that composes the left page list, canvas, and
 * right-hand property panel. Provides keyboard shortcuts and toolbar
 * action handlers which call into `useVP()` helper functions.
 */

const styles = {
    themeSelect: {
        padding: '5px 8px',
        background: 'var(--vp-surface2)',
        border: '1px solid var(--vp-border)',
        color: 'var(--vp-text)',
        borderRadius: '4px',
        fontSize: '0.78em'
    },
    publishBtn: {
        background: 'var(--vp-accent)',
        color: '#000'
    },
    orientationSelect: {
        padding: '4px 10px',
        background: 'var(--vp-surface2)',
        border: '1px solid var(--vp-border)',
        color: 'var(--vp-text)',
        fontSize: '0.78em',
        borderRadius: '3px'
    }
}

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

function Editor() {
    const { vpState, updateVpState, updateProjectSettings, addElement, addElements, addPage, addPageFromTemplate, addImportedAsset, addImportedAssets, deletePage, duplicatePage, undo, redo, saveProject, showModal, closeModal, previewProject, applyTheme, insertTemplate, deleteElement, copyElement, pasteElement, duplicateElement, moveLayer, updateElement, updatePage, setBackgroundAudio, setPageAudio, themes } = useVP()
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
    const templateOptions = [...BUILT_IN_TEMPLATES, ...(vpState.templates || [])]

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
        return <div className="editor-empty">No project selected. Create or open a zine from the Dashboard.</div>
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
        input.onchange = (e) => {
            const file = e.target.files[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const asset = { id: `imported-${Date.now()}`, name: file.name, src: event.target.result, addedAt: new Date().toISOString() }
                    addImportedAsset(asset)
                    addElement(pageIdx, {
                        type: 'image',
                        src: asset.src,
                        x: 80,
                        y: 80,
                        width: 200,
                        height: 200
                    })
                }
                reader.readAsDataURL(file)
            }
        }
        input.click()
    }

    const importFiles = (files) => {
        const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'))
        const reads = imageFiles.map(file => new Promise(resolve => {
            const reader = new FileReader()
            reader.onload = event => resolve({ file, src: event.target.result })
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(file)
        }))
        Promise.all(reads).then(results => {
            const imported = results.filter(Boolean).map(({ file, src }, index) => ({
                id: `imported-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                name: file.name,
                src,
                addedAt: new Date().toISOString()
            }))
            if (!imported.length) return
            addImportedAssets(imported)
            addElements(pageIdx, imported.map((asset, index) => ({
                type: 'image',
                src: asset.src,
                x: 80 + ((index % 3) * 28),
                y: 80 + ((index % 3) * 28),
                width: 240,
                height: 180,
                objectFit: 'contain'
            })))
        })
    }

    const importAudioFiles = (files) => {
        Array.from(files || []).forEach(file => {
            if (!file.type.startsWith('audio/')) return
            const reader = new FileReader()
            reader.onload = (event) => addImportedAsset({
                id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: file.name,
                src: event.target.result,
                kind: 'audio',
                addedAt: new Date().toISOString()
            })
            reader.readAsDataURL(file)
        })
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
                <div className="ed-workspace-modes" role="tablist" aria-label="Editor workspace">
                    {[['compose', 'Compose'], ['media', 'Media'], ['settings', 'Zine settings']].map(([mode, label]) => (
                        <button key={mode} type="button" role="tab" aria-selected={workspaceMode === mode} className={`ed-workspace-tab ${workspaceMode === mode ? 'active' : ''}`} onClick={() => setWorkspaceMode(mode)}>{label}</button>
                    ))}
                </div>
                <div className="ed-toolbar-context">
                    {workspaceMode === 'compose' && <>
                        <button className="ed-tool" title="Undo (Ctrl+Z)" onClick={undo}>↩</button>
                        <button className="ed-tool" title="Redo (Ctrl+Shift+Z)" onClick={redo}>↪</button>
                        <span className="ed-toolbar-label">Elements</span>
                        <button className="ed-tool" onClick={handleAddText}>Text</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'panels')}>Panel</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'shapes')}>Shape</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'balloons')}>Balloon</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'sfx')}>SFX</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'symbols')}>Symbol</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'shaders')}>Shader</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'objects')}>3D object</button>
                        <span className="ed-toolbar-label">View</span>
                        <button className={`ed-tool ${gridOn ? 'active' : ''}`} onClick={() => setGridOn(!gridOn)}>Grid</button>
                        <button className={`ed-tool ${snapOn ? 'active' : ''}`} onClick={() => setSnapOn(!snapOn)}>Snap</button>
                    </>}
                    {workspaceMode === 'media' && <>
                        <button className="ed-tool" onClick={handleAddImage}>Import image</button>
                        <button className="ed-tool" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = event => importFiles(event.target.files); input.click() }}>Bulk images</button>
                        <button className="ed-tool" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*'; input.multiple = true; input.onchange = event => importAudioFiles(event.target.files); input.click() }}>Import audio</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'imported')}>Image library</button>
                        <button className="ed-tool" onClick={() => showModal('assetModal', 'audio')}>Audio library</button>
                        <button className="ed-tool" onClick={() => openAudioPicker('project')}>Set background audio</button>
                    </>}
                    {workspaceMode === 'settings' && <span className="ed-toolbar-label">Project-wide configuration</span>}
                </div>
                <div className="ed-toolbar-actions">
                    <button className="ed-tool" onClick={saveProject}>Save</button>
                    <button className="ed-tool" onClick={() => previewProject()}>Preview</button>
                    <button className="ed-tool" onClick={() => showModal('exportModal')}>Export</button>
                    <button className="ed-tool primary" onClick={() => showModal('publishModal')}>Publish</button>
                </div>
            </div>

            {/* Left panel */}
            <div className="ed-left">
                {workspaceMode === 'settings' && <div className="ed-panel-section ed-left-pane zine-settings-pane">
                    <h4>Zine settings</h4>
                    <div className="form-row">
                        <label>Title</label>
                        <input type="text" value={project.title || ''} onChange={event => updateProjectSettings({ title: event.target.value })} />
                    </div>
                    <div className="form-row">
                        <label>Design theme</label>
                        <select value={project.theme || 'classic'} onChange={event => applyTheme(event.target.value)}>
                            {Object.keys(themes).map(theme => <option key={theme} value={theme}>{theme.replace(/(^|[-_])\w/g, value => value.toUpperCase())}</option>)}
                        </select>
                    </div>
                    <div className="settings-divider">Publishing defaults</div>
                    <div className="form-row">
                        <label>Author</label>
                        <input type="text" value={project.publishSettings?.author || ''} onChange={event => updateProjectSettings({ publishSettings: { ...project.publishSettings, author: event.target.value } })} placeholder="Your name or pseudonym" />
                    </div>
                    <div className="form-row">
                        <label>Description</label>
                        <textarea rows="4" value={project.publishSettings?.description || ''} onChange={event => updateProjectSettings({ publishSettings: { ...project.publishSettings, description: event.target.value } })} placeholder="What is this zine about?" />
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
                    <p className="prop-hint">These values prefill the publishing form and are saved with this zine.</p>
                </div>}
                {workspaceMode === 'media' && <div className="ed-panel-section ed-left-pane media-pane">
                    <h4>Media library</h4>
                    <p className="ed-pane-hint">Images and audio stay reusable across this workspace.</p>
                    <button className="ed-panel-btn" onClick={() => showModal('assetModal', 'imported')}>Browse image library</button>
                    <button className="ed-panel-btn" onClick={() => showModal('assetModal', 'audio')}>Browse audio library</button>
                    <div className="media-library-summary"><strong>{vpState.library?.imported?.length || 0}</strong><span>images saved</span><strong>{vpState.library?.audio?.length || 0}</strong><span>audio files saved</span></div>
                    <div className="settings-divider">Page audio</div>
                    <button className="ed-panel-btn" onClick={() => openAudioPicker('page')}>Choose page audio</button>
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
                                {tab[0].toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    {leftTab === 'pages' && <div className="ed-panel-section ed-left-pane">
                        <h4>Pages <span>{pages.length}</span></h4>
                        <div className="ed-panel-actions">
                            <button className="ed-panel-btn" onClick={addPage}>+ Blank Page</button>
                            <button className="ed-panel-btn template-launch" onClick={() => showModal('templateModal', 'browse')}>✦ Browse Templates</button>
                            <button className="ed-panel-btn" onClick={duplicatePage}>⧉ Duplicate</button>
                            <button className="ed-panel-btn" onClick={deletePage}>✕ Delete Page</button>
                            <button className="ed-panel-btn" onClick={() => openAudioPicker('page')}>♫ Choose Page Audio</button>
                            {(project.backgroundAudio || currentPage.backgroundAudio) && <button className="ed-panel-btn" onClick={() => { if (currentPage.backgroundAudio) setPageAudio(pageIdx, null); else setBackgroundAudio(null) }}>■ Remove Audio</button>}
                        </div>
                        <div className="page-thumbs" id="pageThumbs">
                            {pages.map((p, i) => <PageThumbnail key={p.id} page={p} index={i} active={i === pageIdx} onSelect={() => setCurrentPageIdx(i)} />)}
                        </div>
                    </div>}
                    {leftTab === 'templates' && <div className="ed-panel-section ed-left-pane">
                        <h4>Template Library <span>{templateOptions.length}</span></h4>
                        <p className="ed-pane-hint">Add a prepared page to your project.</p>
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
                                    <span className="layer-name">{el.locked ? '🔒 ' : ''}{el.type === 'text' ? String(el.content ?? '').substring(0, 15) : el.type}</span>
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
                            value={currentPage?.orientation || 'portrait'}
                            onChange={(e) => updatePageOrientation(e.target.value)}
                            style={styles.orientationSelect}
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
                    <button className={`prop-tab ${propTab === 'logic' ? 'active' : ''}`} onClick={() => setPropTab('logic')}>Interactions</button>
                </div>
                <div className="prop-pane active">
                    <PropertyPanel activeTab={propTab} />
                </div>
            </div>

            {/* Footer */}
            <div className="ed-footer">
                <span>Page <b id="pageNum">{safePageIdx + 1}</b> of <b id="pageTotal">{pages.length}</b></span>
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
