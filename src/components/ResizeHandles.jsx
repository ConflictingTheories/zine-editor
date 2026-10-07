/*
 * Component: ResizeHandles
 * Draws interactive resize handles for moving and scaling selected editor elements.
 */

import React from 'react'

/**
 * Component: ResizeHandles
 * Renders eight directional resize handles plus a rotation handle.
 * Delegates pointer down events to `startResize` and `startRotate` handlers
 * provided by the editor interaction hook.
 *
 * Props:
 * - el: element object
 * - pageIdx: index of the parent page
 * - startResize: function(e, el, pageIdx, dir)
 * - startRotate: function(e, el, pageIdx)
 */
const ResizeHandles = ({ el, pageIdx, startResize, startRotate }) => (
    <>
        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((dir) => (
            <div key={dir} className={`rh ${dir}`} onMouseDown={(e) => startResize(e, el, pageIdx, dir)} />
        ))}
        <div className="rh rot" onMouseDown={(e) => startRotate(e, el, pageIdx)} />
    </>
)

export default ResizeHandles