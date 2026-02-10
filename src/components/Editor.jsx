import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'
import Canvas from './Canvas.jsx'
import PropertyPanel from './PropertyPanel.jsx'

function Editor() {
    const { vpState, updateVpState, addElement, addPage, deletePage, duplicatePage, undo, redo, saveProject, showModal, previewProject, applyTheme, insertTemplate, deleteElement, copyElement, pasteElement, duplicateElement, moveLayer, updateElement, themes } = useVP()
    const pageIdx = vpState.selection?.pageIdx ?? 0
    const setCurrentPageIdx = (idx) => updateVpState({ selection: { type: 'page', id: vpState.currentProject?.pages[idx]?.id, pageIdx: idx } })
    const [zoom, setZoom] = useState(100)
    const [gridOn, setGridOn] = useState(false)
    const [snapOn, setSnapOn] = useState(true)
    const [propTab, setPropTab] = useState('props')

    const project = vpState.currentProject
    if (!project) return <div className="editor-empty">No project selected. Create or open a zine from the Dashboard.</div>

    const currentPage = project.pages[pageIdx]
    const themeStatus = themes[project.theme || 'classic']?.status || 'STABLE'

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
                    <button className="ed-tool" title="Undo (Ctrl+Z)" onClick={undo}>↩ Undo</button>
                    <button className="ed-tool" title="Redo (Ctrl+Shift+Z)" onClick={redo}>↪ Redo</button>
                </div>
                <div className="ed-tool-group">
                    <button className="ed-tool" onClick={handleAddText}>T Text</button>
                    <button className="ed-tool" onClick={handleAddImage}>🖼 Image</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'panels')}>▣ Panel</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'shapes')}>◆ Shape</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'balloons')}>💬 Balloon</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'sfx')}>💥 SFX</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'symbols')}>✦ Symbol</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'shaders')}>🎨 Shader</button>
                </div>
                <div className="ed-tool-group">
                    <button className={`ed-tool ${gridOn ? 'active' : ''}`} onClick={() => setGridOn(!gridOn)}>⊞ Grid</button>
                    <button className={`ed-tool ${snapOn ? 'active' : ''}`} onClick={() => setSnapOn(!snapOn)}>⊡ Snap</button>
                </div>
                <div className="ed-tool-group">
                    <select
                        value={project.theme || 'classic'}
                        onChange={(e) => applyTheme(e.target.value)}
                        style={{ padding: '5px 8px', background: 'var(--vp-surface2)', border: '1px solid var(--vp-border)', color: 'var(--vp-text)', borderRadius: '4px', fontSize: '0.78em' }}
                    >
                        <option value="classic">Classic Literature</option>
                        <option value="fantasy">Medieval Fantasy</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="conspiracy">Dark Conspiracies</option>
                        <option value="worldbuilding">World Building</option>
                        <option value="comics">Comics</option>
                        <option value="arcane">Arcane Lore</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}></div>
                <div className="ed-tool-group">
                    <button className="ed-tool" onClick={() => showModal('helpModal')}>❓ Help</button>
                    <button className="ed-tool" onClick={saveProject}>💾 Save</button>
                    <button className="ed-tool" onClick={() => previewProject()}>👁 Preview</button>
                    <button className="ed-tool" onClick={() => showModal('exportModal')}>📤 Export</button>
                    <button className="ed-tool" onClick={() => showModal('publishModal')} style={{ background: 'var(--vp-accent)', color: '#000' }}>Publish</button>
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
                        {project.pages.map((p, i) => (
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
                        {[...(currentPage.elements || [])].reverse().map(el => (
                            <div
                                key={el.id}
                                className={`layer-item ${vpState.selection?.id === el.id ? 'active' : ''}`}
                                onClick={() => updateVpState({ selection: { type: 'element', id: el.id, pageIdx } })}
                            >
                                <span className="layer-name">{el.locked ? '🔒 ' : ''}{el.type === 'text' ? (el.content || '').substring(0, 15) : el.type}</span>
                                <button className="layer-btn" onClick={(e) => {
                                    e.stopPropagation()
                                    updateElement(pageIdx, el.id, { hidden: !el.hidden })
                                }} title="Toggle visibility">👁</button>
                            </div>
                        ))}
                    </div>
                </div>
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
                            onChange={(e) => {
                                const o = e.target.value
                                updateVpState({}) 
                                // Orientation could be stored on page: updateElement(pageIdx, ...) - for now leave as portrait
                            }}
                            style={{ padding: '4px 10px', background: 'var(--vp-surface2)', border: '1px solid var(--vp-border)', color: 'var(--vp-text)', fontSize: '0.78em', borderRadius: '3px' }}
                        >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    </div>
                </div>
                <div className="ed-canvas-wrap" id="canvasWrap">
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}>
                        <Canvas page={currentPage} pageIdx={pageIdx} snapOn={snapOn} gridOn={gridOn} />
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="ed-right">
                <div className="prop-tabs" id="propTabs">
                    <button className={`prop-tab ${propTab === 'props' ? 'active' : ''}`} onClick={() => setPropTab('props')}>Props</button>
                    <button className={`prop-tab ${propTab === 'effects' ? 'active' : ''}`} onClick={() => setPropTab('effects')}>Effects</button>
                    <button className={`prop-tab ${propTab === 'logic' ? 'active' : ''}`} onClick={() => setPropTab('logic')}>Logic</button>
                </div>
                <div className="prop-pane active">
                    <PropertyPanel activeTab={propTab} />
                </div>
            </div>

            {/* Footer */}
            <div className="ed-footer">
                <span>Page <b id="pageNum">{pageIdx + 1}</b> of <b id="pageTotal">{project.pages.length}</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.max(0, pageIdx - 1))}>◀ Prev</button>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.min(project.pages.length - 1, pageIdx + 1))}>Next ▶</button>
                </div>
                <span className="status-text" id="statusText">REALITY: {themeStatus}</span>
            </div>
        </div>
    )
}

export default Editor
