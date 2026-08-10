/*
 * Component: ContextMenu
 * Renders right-click actions and quick commands for selected editor elements.
 */

import React, { useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'

/**
 * Component: ContextMenu
 * Small contextual menu used on the canvas to perform quick element
 * operations: copy/paste, layer movement, duplicate, lock, and delete.
 *
 * Props:
 * - x, y: screen coordinates where the menu should render
 * - visible: boolean
 * - onClose: function called to close the menu
 * - selection, pageIdx, selectedElement: editor selection context
 */
export default function ContextMenu({ x, y, visible, onClose, selection, pageIdx, selectedElement }) {
    const { copyElement, pasteElement, duplicateElement, moveLayer, deleteElement, updateElement } = useVP()

    useEffect(() => {
        if (!visible) return
        const close = () => onClose()
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [visible, onClose])

    if (!visible) return null

    const hasElement = selection?.type === 'element' && selection?.id
    const handle = (e, fn) => {
        e.stopPropagation()
        fn()
        onClose()
    }

    return (
        <div
            className="ctx-menu active"
            style={{ left: x, top: y }}
            onClick={e => e.stopPropagation()}
        >
            <div className="ctx-menu-item" onClick={e => handle(e, () => copyElement())}>📋 Copy</div>
            <div className="ctx-menu-item" onClick={e => handle(e, () => pasteElement())}>📄 Paste</div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={e => handle(e, () => moveLayer('top'))}>⬆ Bring to Front</div>
            <div className="ctx-menu-item" onClick={e => handle(e, () => moveLayer('up'))}>↑ Move Forward</div>
            <div className="ctx-menu-item" onClick={e => handle(e, () => moveLayer('down'))}>↓ Move Backward</div>
            <div className="ctx-menu-item" onClick={e => handle(e, () => moveLayer('bottom'))}>⬇ Send to Back</div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={e => handle(e, () => duplicateElement())}>⧉ Duplicate</div>
            {hasElement && selectedElement && (
                <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); updateElement(pageIdx, selection.id, { locked: !selectedElement.locked }); onClose(); }}>🔒 {selectedElement.locked ? 'Unlock' : 'Lock'}</div>
            )}
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item ctx-menu-item-danger" onClick={e => handle(e, () => deleteElement())}>✕ Delete</div>
        </div>
    )
}
