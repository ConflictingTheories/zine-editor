import React from 'react'

const ResizeHandles = ({ el, pageIdx, startResize, startRotate }) => (
    <>
        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((dir) => (
            <div key={dir} className={`handle ${dir}`} onMouseDown={(e) => startResize(e, el, pageIdx, dir)} />
        ))}
        <div className="handle rotate" onMouseDown={(e) => startRotate(e, el, pageIdx)} />
    </>
)

export default ResizeHandles