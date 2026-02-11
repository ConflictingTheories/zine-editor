import React, { useRef, useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { useEditor } from '../hooks/useEditor.js'
import ShaderElement from './ShaderElement.jsx'
import ContextMenu from './ContextMenu.jsx'
import CanvasElement from './CanvasElement.jsx'

function Canvas({ page, pageIdx, snapOn = true, gridOn = false }) {
    const { vpState, updateVpState } = useVP()
    const { selection } = vpState
    const { startDrag, startResize, startRotate, updateElement } = useEditor()
    const canvasRef = useRef(null)
    const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, element: null })

    const handleElementClick = (e, elId) => {
        e.stopPropagation()
        updateVpState({ selection: { type: 'element', id: elId, pageIdx } })
    }

    const handleCanvasClick = () => {
        updateVpState({ selection: { type: 'page', id: page.id, pageIdx } })
    }

    const handleContextMenu = (e, el) => {
        e.preventDefault()
        e.stopPropagation()
        const rect = canvasRef.current.getBoundingClientRect()
        setCtxMenu({ visible: true, x: e.clientX - rect.left, y: e.clientY - rect.top, element: el })
    }

    return (
        <>
            <div
                className={`ed-canvas ${page.orientation || 'portrait'} ${gridOn ? 'show-grid' : ''}`}
                style={{ background: page.background || '#fff', width: 528, height: 816 }}
                onClick={handleCanvasClick}
                onContextMenu={e => handleContextMenu(e, null)}
                ref={canvasRef}
            >
                {(page.elements || [])
                    .filter(el => !el.hidden)
                    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                    .map((el) => (
                        <CanvasElement
                            key={el.id}
                            el={el}
                            pageIdx={pageIdx}
                            isSelected={selection.type === 'element' && selection.id === el.id}
                            handlers={{
                                startDrag,
                                startResize,
                                startRotate,
                                handleElementClick,
                                handleContextMenu,
                                updateElement
                            }}
                        />
                    ))}
            </div>
            <ContextMenu
                x={ctxMenu.x}
                y={ctxMenu.y}
                visible={ctxMenu.visible}
                onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
                selection={selection}
                pageIdx={pageIdx}
                selectedElement={ctxMenu.element}
            />
        </>
    )
}

export default Canvas
