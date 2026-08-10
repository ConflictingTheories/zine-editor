/*
 * Component: Canvas
 * Renders the editor page surface and coordinates element layout and interaction.
 */

import React, { useRef, useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { useEditor } from '../hooks/useEditor.js'
import ContextMenu from './ContextMenu.jsx'
import CanvasElement from './CanvasElement.jsx'
import { PAGE_W, PAGE_H } from '../constants.js'
import { resolvePublicationAsset } from '../utils/assets.js'

/**
 * Component: Canvas
 * Renders a single page's canvas including all elements. Responsible for
 * mouse interactions that are page-level (click to deselect, context menu)
 * and for mapping elements to `CanvasElement` components.
 *
 * Props:
 * - page: the page object containing `elements`, `background`, `texture`, etc.
 * - pageIdx: index of the page within the project
 * - snapOn, gridOn, zoom: visual/editor flags
 */

const styles = {
    canvas: (page) => {
        const landscape = page.orientation === 'landscape'
        return { background: page.background || '#fff', width: landscape ? PAGE_H : PAGE_W, height: landscape ? PAGE_W : PAGE_H }
    }
}

function Canvas({ page, pageIdx, snapOn = true, gridOn = false, zoom = 100 }) {
    const { vpState, updateVpState } = useVP()
    const { selection } = vpState
    const { startDrag, startResize, startRotate, updateElement } = useEditor(zoom, snapOn)
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
        if (el) updateVpState({ selection: { type: 'element', id: el.id, pageIdx } })
        else updateVpState({ selection: { type: 'page', id: page.id, pageIdx } })
        const rect = canvasRef.current.getBoundingClientRect()
        const scale = Math.max(0.01, zoom / 100)
        setCtxMenu({
            visible: true,
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale,
            element: el
        })
    }

    return (
        <>
            <div
                className={`ed-canvas ${page.orientation || 'portrait'} ${gridOn ? 'show-grid' : ''}`}
                style={styles.canvas(page)}
                onClick={handleCanvasClick}
                onContextMenu={e => handleContextMenu(e, null)}
                ref={canvasRef}
            >
                {page.texture && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `url(${resolvePublicationAsset(page.texture)})`, backgroundSize: 'cover', opacity: 0.2 }} />}
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
