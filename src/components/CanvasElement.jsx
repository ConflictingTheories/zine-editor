import React from 'react'
import ElementContent from './ElementContent.jsx'
import ResizeHandles from './ResizeHandles.jsx'

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

    return (
        <div
            className={`el ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
            style={style}
            onMouseDown={(e) => isSelected && !el.locked && startDrag(e, el, pageIdx)}
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