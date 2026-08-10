/*
 * Component: CanvasElement
 * Displays an individual page element and forwards pointer events for selection and editing.
 */

import React from 'react'
import ElementContent from './ElementContent.jsx'
import ResizeHandles from './ResizeHandles.jsx'

/**
 * Component: CanvasElement
 * Wraps a single element instance on the canvas and wires up interaction
 * handlers for selection, dragging, context menu, and resize/rotate handles.
 *
 * Props:
 * - el: element object (type, position, size, styling props)
 * - pageIdx: index of the parent page
 * - isSelected: boolean whether this element is currently selected
 * - handlers: { startDrag, startResize, startRotate, handleElementClick, handleContextMenu, updateElement }
 */

/**
 * Compute the inline style object for an element based on its properties.
 * Keeping this deterministic avoids thrashing layout during quick updates.
 */
const getElementStyle = (el) => ({
    left: el.x || 0,
    top: el.y || 0,
    width: el.width || 100,
    height: el.height || 100,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    zIndex: el.zIndex || 1,
    opacity: el.opacity ?? 1,
    mixBlendMode: el.blendMode || 'normal',
    boxShadow: el.shadow || 'none',
    filter: el.blur ? `blur(${el.blur}px)` : el.filter || 'none',
    border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none',
    borderRadius: el.borderRadius ? `${el.borderRadius}px` : '0'
})

const CanvasElement = ({ el, pageIdx, isSelected, handlers }) => {
    const { startDrag, startResize, startRotate, handleElementClick, handleContextMenu, updateElement } = handlers

    const style = getElementStyle(el)

    const handleMouseDown = (e) => {
        if (e.button !== 0 || el.locked) return
        // Select on press so the first drag works; contentEditable targets are
        // still left alone by startDrag, preserving normal text-caret behavior.
        handleElementClick(e, el.id)
        startDrag(e, el, pageIdx)
    }

    return (
        <div
            className={`el ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
            style={style}
            onMouseDown={handleMouseDown}
            onClick={(e) => handleElementClick(e, el.id)}
            onContextMenu={(e) => handleContextMenu(e, el)}
        >
            <ElementContent el={el} pageIdx={pageIdx} updateElement={updateElement} />
            {isSelected && !el.locked && (
                <ResizeHandles el={el} pageIdx={pageIdx} startResize={startResize} startRotate={startRotate} />
            )}
        </div>
    )
}

export default CanvasElement
