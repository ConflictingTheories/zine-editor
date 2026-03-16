import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'
import Canvas from './Canvas.jsx'
import PropertyPanel from './PropertyPanel.jsx'

// Editor components use CSS classes defined in index.css and Editor.css


function Editor() {
    const { vpState, updateVpState, addElement, addPage, deletePage, duplicatePage, undo, redo, saveProject, showModal, previewProject, applyTheme, insertTemplate, deleteElement, copyElement, pasteElement, duplicateElement, moveLayer, updateElement, themes } = useVP()
    const pageIdx = vpState.selection?.pageIdx ?? 0
    const setCurrentPageIdx = (idx) => updateVpState({ selection: { type: 'page', id: vpState.currentProject?.pages[idx]?.id, pageIdx: idx } })
    const [zoom, setZoom] = useState(100)
    const [gridOn, setGridOn] = useState(false)
    const [snapOn, setSnapOn] = useState(true)
    const [propTab, setPropTab] = useState('props')

    const project = vpState.currentProject

    // SECURITY: Only allow user to edit their own projects
    if (!vpState.user) {
        return <div className="editor-empty">Please log in to edit zines.</div>
    }

    if (!project) {
        return <div className="editor-empty">No project selected. Create or open a zine from the Dashboard.</div>
    }

    // Verify user owns this project
    if (project.userId && project.userId !== vpState.user.id) {
        return <div className="editor-empty">You don't have permission to edit this zine.</div>
    }


    const currentPage = project.pages?.[pageIdx]
    const themeStatus = themes[project.theme || 'classic']?.status || 'STABLE'

    useEffect(() => {
        // Ensure pageIdx is valid
        if (project.pages && (pageIdx >= project.pages.length || pageIdx < 0)) {
            updateVpState({ selection: { ...vpState.selection, pageIdx: 0 } })
        }
    }, [project.pages, pageIdx])

    useEffect(() => {
        const onKey = (e) => {
            if (!project) return
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') copyElement()
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteElement() }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject() }
            if (e.key === 'Delete' || e.key === 'Backspace') { if (!e.target.isContentEditable) deleteElement() }
            if (e.key === 'Escape') updateVpState({ selection: { type: 'page', id: currentPage?.id, pageIdx } })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [project, pageIdx, currentPage?.id, undo, redo, copyElement, pasteElement, saveProject, deleteElement])

    const handleAddText = () => {
        if (pageIdx < 0) return
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
        if (pageIdx < 0) return
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (e) => {
            const file = e.target.files[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    addElement(pageIdx, {
                        type: 'image',
                        src: event.target.result,
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

    const handleZoomFit = () => {
        const wrap = document.getElementById('canvasWrap')
        if (wrap) {
            const canvas = wrap.querySelector('.ed-canvas')
            if (canvas) {
                const scale = Math.min((wrap.clientWidth - 80) / 528, (wrap.clientHeight - 80) / 816, 1)
                setZoom(Math.round(scale * 100))
            }
        }
    }


    return (
        <div className="editor" id="editorContainer">
            {/* Top toolbar */}
            <div className="ed-toolbar-top">
                <div className="ed-tool-group">
                    <button className="ed-tool" title="Undo (Ctrl+Z)" onClick={undo}>↶</button>
                    <button className="ed-tool" title="Redo (Ctrl+Shift+Z)" onClick={redo}>↷</button>
                </div>
                <div className="ed-tool-group">
                    <button className="ed-tool" title="Text" onClick={handleAddText}>T</button>
                    <button className="ed-tool" title="Image" onClick={handleAddImage}>🖼️</button>
                </div>
                <div className="ed-tool-group">
                    <button className="ed-tool" title="Assets" onClick={() => showModal('assetModal', 'panels')}>🎨</button>
                    <button className={`ed-tool ${gridOn ? 'active' : ''}`} title="Grid" onClick={() => setGridOn(!gridOn)}>⊞</button>
                    <button className={`ed-tool ${snapOn ? 'active' : ''}`} title="Snap" onClick={() => setSnapOn(!snapOn)}>⊡</button>
                </div>
                <div className="ed-tool-group">
                    <select className="form-input" value={project.theme || 'classic'} onChange={(e) => applyTheme(e.target.value)} style={{ minWidth: '120px' }}>
                        <option value="classic">Classic</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="conspiracy">Conspiracy</option>
                        <option value="worldbuilding">World</option>
                        <option value="comics">Comics</option>
                        <option value="arcane">Arcane</option>
                    </select>
                </div>
                <div className="ed-tool-group">
                    <select className="form-input" value={currentPage?.orientation || 'portrait'} onChange={(e) => {/* TODO: implement */ }} style={{ minWidth: '100px' }}>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}></div>
                <div className="ed-tool-group">
                    <button className="ed-tool" title="Preview" onClick={() => previewProject()}>👁</button>
                    <button className="ed-tool" title="Export" onClick={() => showModal('exportModal')}>💾</button>
                    <button className="btn-premium" onClick={() => showModal('publishModal')}>Publish</button>
                    <button className="btn-ghost" onClick={saveProject}>Save</button>
                </div>
            </div>

            {/* Left panel */}
            <div className="ed-left">
                <div className="ed-panel-section">
                    <h4>Pages</h4>
                    <button className="ed-panel-btn" onClick={addPage}>+ Add Page</button>
                    <button className="ed-panel-btn" onClick={duplicatePage}>⧉ Duplicate</button>
                    <button className="ed-panel-btn" onClick={deletePage}>✕ Delete Page</button>
                    <div className="page-thumbs" id="pageThumbs">
                        {(project.pages || []).map((p, i) => (
                            <div
                                key={p.id}
                                className={`page-thumb ${i === pageIdx ? 'active' : ''}`}
                                style={{ background: p.background || '#fff' }}
                                onClick={() => setCurrentPageIdx(i)}
                            >
                                <span className="page-thumb-num">{i + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="ed-panel-section">
                    <h4>Templates</h4>
                    <button className="ed-panel-btn" onClick={() => insertTemplate('cover')}>📕 Cover Page</button>
                    <button className="ed-panel-btn" onClick={() => insertTemplate('content')}>📄 Content Page</button>
                    <button className="ed-panel-btn" onClick={() => insertTemplate('back')}>📗 Back Cover</button>
                </div>
                <div className="ed-panel-section" style={{ flex: 1 }}>
                    <h4>Layers</h4>
                    <div id="layerList" className="layer-list">
                        {[...(currentPage?.elements || [])].reverse().map(el => (
                            <div
                                key={el.id}
                                className={`layer-item ${vpState.selection?.id === el.id ? 'active' : ''}`}
                                onClick={() => updateVpState({ selection: { type: 'element', id: el.id, pageIdx } })}
                            >
                                <span className="layer-name">{el.locked ? '🔒 ' : ''}{el.type === 'text' ? (el.content || el.text || '').substring(0, 15) : el.type}</span>
                                <div className="layer-actions">
                                    <button className="layer-btn" onClick={(e) => { e.stopPropagation(); moveLayer(pageIdx, el.id, 1) }} title="Bring Forward">▲</button>
                                    <button className="layer-btn" onClick={(e) => { e.stopPropagation(); moveLayer(pageIdx, el.id, -1) }} title="Send Backward">▼</button>
                                    <button className="layer-btn" onClick={(e) => {
                                        e.stopPropagation()
                                        updateElement(pageIdx, el.id, { hidden: !el.hidden })
                                    }} title="Toggle visibility">👁</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="ed-canvas-area">
                <div className="ed-canvas-bar">
                    <div className="zoom-group">
                        <button className="ed-tool" title="Zoom Out" onClick={() => setZoom(z => Math.max(25, z - 10))}>-</button>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em', minWidth: '48px', textAlign: 'center' }}>{zoom}%</span>
                        <button className="ed-tool" title="Zoom In" onClick={() => setZoom(z => Math.min(200, z + 10))}>+</button>
                        <button className="ed-tool" title="Fit Canvas" onClick={handleZoomFit}>↔</button>
                    </div>
                </div>
                <div className="ed-canvas-wrap" id="canvasWrap">
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}>
                        {currentPage && <Canvas page={currentPage} pageIdx={pageIdx} snapOn={snapOn} gridOn={gridOn} />}
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="ed-right">
                <div className="prop-tabs">
                    <button className={`prop-tab ${propTab === 'props' ? 'active' : ''}`} onClick={() => setPropTab('props')}>📐</button>
                    <button className={`prop-tab ${propTab === 'effects' ? 'active' : ''}`} onClick={() => setPropTab('effects')}>✨</button>
                    <button className={`prop-tab ${propTab === 'logic' ? 'active' : ''}`} onClick={() => setPropTab('logic')}>⚙</button>
                    <button className={`prop-tab ${propTab === 'settings' ? 'active' : ''}`} onClick={() => setPropTab('settings')}>🎛</button>
                </div>
                <div className="prop-pane">
                    <PropertyPanel activeTab={propTab} />
                </div>
            </div>

            {/* Footer */}
            <div className="ed-footer">
                <span>Page <b id="pageNum">{pageIdx + 1}</b> of <b id="pageTotal">{project.pages?.length || 0}</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.max(0, pageIdx - 1))}>◀ Prev</button>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.min((project.pages?.length || 1) - 1, pageIdx + 1))}>Next ▶</button>
                </div>
                <span className="status-text" id="statusText">REALITY: {themeStatus}</span>
            </div>
        </div>
    )
}

export default Editor
