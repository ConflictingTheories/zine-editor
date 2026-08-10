/*
 * Hook: useEditor
 * Custom editor hook that centralizes pointer drag, selection, keyboard navigation, and interaction state.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'

/**
 * Hook: useEditor
 * Handles element pointer interactions (drag, resize, rotate) within the
 * editor canvas. Returns control functions and state flags used by
 * `CanvasElement` / `Canvas` components to attach mouse handlers.
 *
 * @param {number} [zoom=100] initial zoom percentage (100 => 1:1)
 * @returns {object} { startDrag, startResize, startRotate, updateElement, isDragging, isResizing, isRotating }
 */
export function useEditor(zoom = 100, snapOn = true) {
    const { vpState, updateElement, moveLayer } = useVP()
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [isRotating, setIsRotating] = useState(false)
    const zoomRef = useRef(zoom)
    const snapRef = useRef(snapOn)

    useEffect(() => {
        zoomRef.current = zoom || 100
    }, [zoom])
    useEffect(() => { snapRef.current = snapOn }, [snapOn])

    const dragStartPos = useRef({ x: 0, y: 0 })
    const elementStartPos = useRef({ x: 0, y: 0, w: 0, h: 0, rot: 0 })

    const getScale = () => Math.max(0.01, (zoomRef.current || 100) / 100)
    const snap = (value) => snapRef.current ? Math.round(value / 8) * 8 : value

    /**
     * Begin dragging an element. This function attaches global mousemove/mouseup
     * listeners and updates the element position via `updateElement` while moving.
     * Holding Shift overrides editable content checks (allow drag while editing)
     * @param {MouseEvent} e pointer event
     * @param {object} el element data (must contain id,x,y)
     * @param {number} pageIdx index of page containing the element
     */
    const startDrag = useCallback((e, el, pageIdx) => {
        const editingTarget = e.target.isContentEditable || e.target.closest('[contenteditable]')
        if (editingTarget && !e.shiftKey) {
            return
        }
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
        dragStartPos.current = { x: e.clientX, y: e.clientY }
        elementStartPos.current = { x: el.x || 0, y: el.y || 0 }

        const onMouseMove = (moveEvent) => {
            const scale = getScale()
            const dx = (moveEvent.clientX - dragStartPos.current.x) / scale
            const dy = (moveEvent.clientY - dragStartPos.current.y) / scale

            updateElement(pageIdx, el.id, {
                x: snap(elementStartPos.current.x + dx),
                y: snap(elementStartPos.current.y + dy)
            })
        }

        const onMouseUp = () => {
            setIsDragging(false)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }, [updateElement])

    /**
     * Begin resizing an element from a resize handle (n, s, e, w combos).
     * The `handle` string indicates which edges are being dragged (e.g. 'se').
     * @param {MouseEvent} e
     * @param {object} el current element state
     * @param {number} pageIdx page index
     * @param {string} handle string containing one or more of 'n','s','e','w'
     */
    const startResize = useCallback((e, el, pageIdx, handle) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        dragStartPos.current = { x: e.clientX, y: e.clientY }
        elementStartPos.current = { x: el.x || 0, y: el.y || 0, w: el.width || 100, h: el.height || 50 }

        const onMouseMove = (moveEvent) => {
            const scale = getScale()
            const dx = (moveEvent.clientX - dragStartPos.current.x) / scale
            const dy = (moveEvent.clientY - dragStartPos.current.y) / scale

            const updates = {}
            if (handle.includes('e')) updates.width = Math.max(20, snap(elementStartPos.current.w + dx))
            if (handle.includes('s')) updates.height = Math.max(20, snap(elementStartPos.current.h + dy))
            if (handle.includes('w')) {
                updates.width = Math.max(20, snap(elementStartPos.current.w - dx))
                updates.x = snap(elementStartPos.current.x + dx)
            }
            if (handle.includes('n')) {
                updates.height = Math.max(20, snap(elementStartPos.current.h - dy))
                updates.y = snap(elementStartPos.current.y + dy)
            }

            updateElement(pageIdx, el.id, updates)
        }

        const onMouseUp = () => {
            setIsResizing(false)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }, [updateElement])

    /**
     * Begin rotating an element. Calculates center of the element and updates
     * rotation degrees by mapping pointer angle to degrees.
     * @param {MouseEvent} e
     * @param {object} el element object
     * @param {number} pageIdx page index
     */
    const startRotate = useCallback((e, el, pageIdx) => {
        e.preventDefault()
        e.stopPropagation()
        setIsRotating(true)

        const rect = e.currentTarget.parentElement.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const onMouseMove = (moveEvent) => {
            const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX)
            const deg = angle * (180 / Math.PI) + 90
            updateElement(pageIdx, el.id, { rotation: deg })
        }

        const onMouseUp = () => {
            setIsRotating(false)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }, [updateElement])

    // Hotkeys for layer movement
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!vpState.selection || vpState.selection.type !== 'element') return

            const isCtrl = e.ctrlKey || e.metaKey
            if (!isCtrl) return

            if (e.key === '[') {
                e.preventDefault()
                if (e.shiftKey) {
                    moveLayer('bottom')
                } else {
                    moveLayer('down')
                }
            } else if (e.key === ']') {
                e.preventDefault()
                if (e.shiftKey) {
                    moveLayer('top')
                } else {
                    moveLayer('up')
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [vpState.selection, moveLayer])

    return {
        startDrag,
        startResize,
        startRotate,
        updateElement,
        isDragging,
        isResizing,
        isRotating
    }
}
