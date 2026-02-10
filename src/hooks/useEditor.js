import { useState, useCallback, useRef } from 'react'
import { useVP } from '../context/VPContext.jsx'

export function useEditor() {
    const { vpState, updateElement, updateVpState } = useVP()
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [isRotating, setIsRotating] = useState(false)

    const dragStartPos = useRef({ x: 0, y: 0 })
    const elementStartPos = useRef({ x: 0, y: 0, w: 0, h: 0, rot: 0 })

    const startDrag = useCallback((e, el, pageIdx) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
        dragStartPos.current = { x: e.clientX, y: e.clientY }
        elementStartPos.current = { x: el.x || 0, y: el.y || 0 }

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - dragStartPos.current.x
            const dy = moveEvent.clientY - dragStartPos.current.y

            updateElement(pageIdx, el.id, {
                x: elementStartPos.current.x + dx,
                y: elementStartPos.current.y + dy
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

    const startResize = useCallback((e, el, pageIdx, handle) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        dragStartPos.current = { x: e.clientX, y: e.clientY }
        elementStartPos.current = { x: el.x || 0, y: el.y || 0, w: el.width || 100, h: el.height || 50 }

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - dragStartPos.current.x
            const dy = moveEvent.clientY - dragStartPos.current.y

            const updates = {}
            if (handle.includes('e')) updates.width = Math.max(20, elementStartPos.current.w + dx)
            if (handle.includes('s')) updates.height = Math.max(20, elementStartPos.current.h + dy)
            if (handle.includes('w')) {
                updates.width = Math.max(20, elementStartPos.current.w - dx)
                updates.x = elementStartPos.current.x + dx
            }
            if (handle.includes('n')) {
                updates.height = Math.max(20, elementStartPos.current.h - dy)
                updates.y = elementStartPos.current.y + dy
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

    return {
        startDrag,
        startResize,
        startRotate,
        isDragging,
        isResizing,
        isRotating
    }
}
