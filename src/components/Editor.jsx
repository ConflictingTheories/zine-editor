import React, { useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import Canvas from './Canvas.jsx'
import PropertyPanel from './PropertyPanel.jsx'

function Editor() {
    const { vpState, updateVpState, addElement, addPage, undo, redo, saveProject, showModal } = useVP()
    const [currentPageIdx, setCurrentPageIdx] = useState(0)
    const [zoom, setZoom] = useState(100)

    const project = vpState.currentProject
    if (!project) return <div className="editor-empty">No project selected</div>

    const currentPage = project.pages[currentPageIdx]

    const handleAddText = () => {
        addElement(currentPageIdx, {
            type: 'text',
            content: 'New Text',
            x: 50,
            y: 50,
            width: 200,
            height: 50,
            fontSize: 24,
            color: '#000000'
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
                    addElement(currentPageIdx, {
                        type: 'image',
                        src: event.target.result,
                        x: 50,
                        y: 50,
                        width: 300,
                        height: 300
                    })
                }
                reader.readAsDataURL(file)
            }
        }
        input.click()
    }

    const handleAddShader = () => {
        addElement(currentPageIdx, {
            type: 'shader',
            preset: 'plasma',
            x: 50,
            y: 50,
            width: 400,
            height: 400
        })
    }

    return (
        <div className="editor" id="editorContainer">
            {/* Top toolbar */}
            <div className="ed-toolbar-top">
                <div className="ed-tool-group">
                    <button className="ed-tool" title="Undo" onClick={undo}>↩ Undo</button>
                    <button className="ed-tool" title="Redo" onClick={redo}>↪ Redo</button>
                </div>
                <div className="ed-tool-group">
                    <button className="ed-tool" onClick={handleAddText}>T Text</button>
                    <button className="ed-tool" onClick={handleAddImage}>🖼 Image</button>
                    <button className="ed-tool" onClick={handleAddShader}>🎨 Shader</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'panels')}>▣ Panel</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'shapes')}>◆ Shape</button>
                    <button className="ed-tool" onClick={() => showModal('assetModal', 'balloons')}>💬 Balloon</button>
                </div>
                <div style={{ flex: 1 }}></div>
                <div className="ed-tool-group">
                    <button className="ed-tool" onClick={saveProject}>💾 Save</button>
                    <button className="ed-tool" onClick={() => showModal('exportModal')}>📤 Export</button>
                    <button className="ed-tool" onClick={() => showModal('publishModal')} style={{ background: 'var(--vp-accent)', color: '#000' }}>
                        Publish
                    </button>
                </div>
            </div>

            {/* Left panel */}
            <div className="ed-left">
                <div className="ed-panel-section">
                    <h4>Pages</h4>
                    <button className="ed-panel-btn" onClick={addPage}>+ Add Page</button>
                    <div className="page-thumbs">
                        {project.pages.map((p, i) => (
                            <div
                                key={p.id}
                                className={`page-thumb ${i === currentPageIdx ? 'active' : ''}`}
                                onClick={() => setCurrentPageIdx(i)}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ed-panel-section" style={{ borderTop: '1px solid var(--vp-border)', marginTop: '20px', paddingTop: '20px' }}>
                    <h4>Layers</h4>
                    <div className="layer-list">
                        {[...currentPage.elements].reverse().map(el => (
                            <div
                                key={el.id}
                                className={`layer-item ${vpState.selection.id === el.id ? 'active' : ''}`}
                                onClick={() => updateVpState({ selection: { type: 'element', id: el.id, pageIdx: currentPageIdx } })}
                            >
                                <span className="layer-name">{el.locked ? '🔒 ' : ''}{el.type === 'text' ? (el.content || '').substring(0, 15) : el.type}</span>
                                <button className="layer-btn" onClick={(e) => {
                                    e.stopPropagation()
                                    // Handle visibility toggle logic here if needed, or by updating State
                                }}>👁</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="ed-canvas-area">
                <div className="ed-canvas-bar">
                    <div className="zoom-group">
                        <button onClick={() => setZoom(z => Math.max(10, z - 10))}>−</button>
                        <span>{zoom}%</span>
                        <button onClick={() => setZoom(z => Math.min(400, z + 10))}>+</button>
                    </div>
                </div>
                <div className="ed-canvas-wrap">
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center top', transition: 'transform 0.2s' }}>
                        <Canvas page={currentPage} pageIdx={currentPageIdx} />
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="ed-right">
                <div className="prop-tabs">
                    <button className="prop-tab active">Props</button>
                    <button className="prop-tab">Effects</button>
                </div>
                <div className="prop-pane active">
                    <PropertyPanel />
                </div>
            </div>

            {/* Footer */}
            <div className="ed-footer">
                <span>Page <b>{currentPageIdx + 1}</b> of <b>{project.pages.length}</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.max(0, currentPageIdx - 1))}>◀ Prev</button>
                    <button className="ed-tool" onClick={() => setCurrentPageIdx(Math.min(project.pages.length - 1, currentPageIdx + 1))}>Next ▶</button>
                </div>
                <span className="status-text">REALITY: STABLE</span>
            </div>
        </div>
    )
}

export default Editor
