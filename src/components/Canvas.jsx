/*
 * Component: Canvas
 * Renders the editor page surface and coordinates element layout and interaction.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
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
 * - renderContextMenu: optional override for the right-click menu. The
 *   photography workspace passes its own menu here, because replacing an
 *   image or changing how it fills is not an action the zine editor offers —
 *   without this, right-clicking a photograph in a portfolio would silently
 *   fall back to zine-only tools.
 * - pageSize: the page's pixel dimensions. Optional, and deliberately so: the
 *   zine editor has a fixed trim, but a portfolio book's page comes from its
 *   paper size. When it is absent the legacy zine page is used, so the editor
 *   keeps working unchanged.
 */

const styles = {
    canvas: (page, size) => {
        const w = size?.width ?? (page.orientation === 'landscape' ? PAGE_H : PAGE_W)
        const h = size?.height ?? (page.orientation === 'landscape' ? PAGE_W : PAGE_H)
        return { background: page.background || '#fff', width: w, height: h }
    }
}

function Canvas({ page, pageIdx, snapOn = true, gridOn = false, zoom = 100, importFiles, onRequestImage, onDropAsset, renderContextMenu, pageSize }) {
    const { vpState, updateVpState, addImportedAsset, setPageAudio } = useVP()
    const { selection } = vpState
    const { startDrag, startResize, startRotate, updateElement } = useEditor(zoom, snapOn)
    const canvasRef = useRef(null)
    const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, element: null })

    const handleElementClick = useCallback((e, elId) => {
        e.stopPropagation()
        updateVpState({ selection: { type: 'element', id: elId, pageIdx } })
    }, [pageIdx, updateVpState])

    const handleCanvasClick = useCallback(() => {
        updateVpState({ selection: { type: 'page', id: page.id, pageIdx } })
    }, [page.id, pageIdx, updateVpState])

    const handleDrop = useCallback((event) => {
        event.preventDefault()
        const files = Array.from(event.dataTransfer.files || [])
        const imageFiles = files.filter(file => file.type.startsWith('image/'))
        const audioFiles = files.filter(file => file.type.startsWith('audio/'))
        if (imageFiles.length && importFiles) importFiles(imageFiles)
        audioFiles.forEach((audioFile, index) => {
            const reader = new FileReader()
            reader.onload = (loadEvent) => {
                const asset = { id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: audioFile.name, src: loadEvent.target.result, kind: 'audio', addedAt: new Date().toISOString() }
                addImportedAsset(asset)
                if (index === 0) setPageAudio(pageIdx, asset.src, asset.name, true)
            }
            reader.readAsDataURL(audioFile)
        })
    }, [importFiles, addImportedAsset, setPageAudio, pageIdx])

    const handleContextMenu = useCallback((e, el) => {
        e.preventDefault()
        e.stopPropagation()
        if (el) updateVpState({ selection: { type: 'element', id: el.id, pageIdx } })
        else updateVpState({ selection: { type: 'page', id: page.id, pageIdx } })
        const rect = canvasRef.current.getBoundingClientRect()
        const scale = Math.max(0.01, zoom / 100)
        // Visible in the DOM so a test can assert the handler ran, rather than
        // relying on console output the QA harness does not surface.
        canvasRef.current?.setAttribute('data-ctx-fires', String((Number(canvasRef.current.getAttribute('data-ctx-fires')) || 0) + 1))
        setCtxMenu({
            visible: true,
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale,
            element: el
        })
    }, [page.id, pageIdx, zoom, updateVpState])

    /**
     * One stable `handlers` object for every element on the page.
     *
     * This is what makes memoised children possible. `useEditor` rebuilds its
     * callbacks whenever context state changes, so passing them inline created
     * a new object every render and forced *every* element on the page to
     * re-render while a single one was being dragged. Hoisting them here means
     * a drag re-renders the dragged element and nothing else.
     */
    const handlers = useMemo(() => ({
        startDrag, startResize, startRotate, handleElementClick, handleContextMenu, updateElement
    }), [startDrag, startResize, startRotate, handleElementClick, handleContextMenu, updateElement])

    return (
        <>
            <div
                className={`ed-canvas ${page.orientation || 'portrait'} ${gridOn ? 'show-grid' : ''} ${pageSize ? 'is-sized' : ''}`}
                style={styles.canvas(page, pageSize)}
                onClick={handleCanvasClick}
                onContextMenu={e => handleContextMenu(e, null)}
                onDragOver={event => event.preventDefault()}
                onDrop={handleDrop}
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
                            onRequestImage={onRequestImage}
                            onDropAsset={onDropAsset}
                            handlers={handlers}
                        />
                    ))}
            </div>
            {renderContextMenu ? renderContextMenu({
                x: ctxMenu.x,
                y: ctxMenu.y,
                visible: ctxMenu.visible,
                element: ctxMenu.element,
                pageIdx,
                page,
                onClose: () => setCtxMenu(prev => ({ ...prev, visible: false }))
            }) : (
                <ContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    visible={ctxMenu.visible}
                    onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
                    selection={selection}
                    pageIdx={pageIdx}
                    selectedElement={ctxMenu.element}
                />
            )}
        </>
    )
}
export default Canvas
