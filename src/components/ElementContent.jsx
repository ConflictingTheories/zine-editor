import React from 'react'
import ShaderElement from './ShaderElement.jsx'
import AudioViz from './AudioViz.jsx'
import Object3D from './Object3D.jsx'

const BALLOON_PROPS = {
    dialog: { background: '#fff', border: '2px solid #000', borderRadius: '20px' },
    thought: { background: '#fff', border: '2px solid #000', borderRadius: '50%' },
    shout: { background: '#fff', border: '4px solid #000', fontWeight: 'bold' },
    caption: { background: '#000', color: '#fff' },
    whisper: { background: '#f8f8f8', border: '1px dashed #999', borderRadius: '16px', fontStyle: 'italic' },
    narration: { background: '#ffe', border: '1px solid #cc9', fontStyle: 'italic' }
}

const styles = {
    text: (el) => ({
        fontSize: el.fontSize || 16,
        color: el.color || '#000',
        fontFamily: el.fontFamily || 'var(--font-body, serif)',
        textAlign: el.align || 'left',
        fontWeight: el.bold ? 'bold' : 'normal',
        fontStyle: el.italic ? 'italic' : 'normal',
        lineHeight: el.lineHeight || 'normal',
        letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : 'normal',
        textShadow: el.textShadow || 'none',
        WebkitTextStroke: el.strokeWidth ? `${el.strokeWidth}px ${el.strokeColor || '#fff'}` : 'none'
    }),
    imageContainer: {
        width: '100%',
        height: '100%'
    },
    image: (el) => ({
        pointerEvents: 'none',
        objectFit: el.objectFit || 'contain',
        borderRadius: el.imgRadius ? `${el.imgRadius}px` : '0',
        width: '100%',
        height: '100%',
        display: 'block'
    }),
    panel: (el) => ({
        border: el.panelBorderWidth !== undefined ? `${el.panelBorderWidth}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}` : 'var(--panel-border)',
        borderRadius: el.panelRadius !== undefined ? `${el.panelRadius}px` : 'var(--radius)',
        background: el.fill || 'transparent',
        boxShadow: el.panelShadow || 'none',
        width: '100%',
        height: '100%'
    }),
    shape: (el) => {
        const base = {
            background: el.shape === 'triangle' ? 'transparent' : (el.fill || '#000'),
            width: '100%',
            height: '100%',
            borderRadius: el.shape === 'circle' ? '50%' : '0'
        }
        if (el.shape === 'diamond') base.transform = 'rotate(45deg)'
        if (el.shape === 'triangle') {
            base.width = '0'
            base.height = '0'
            base.borderLeft = `${el.width / 2}px solid transparent`
            base.borderRight = `${el.width / 2}px solid transparent`
            base.borderBottom = `${el.height}px solid ${el.fill || '#000'}`
        }
        return base
    },
    balloon: (el) => {
        const bStyle = BALLOON_PROPS[el.balloonType || 'dialog'] || BALLOON_PROPS.dialog
        return {
            fontSize: el.fontSize || 14,
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%',
            height: '100%',
            ...bStyle
        }
    },
    shaderContainer: {
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
    },
    video: {
        width: '100%',
        height: '100%',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
    },
    audioLog: {
        width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid #d4af37', padding: 10, color: '#fff', display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box'
    }
}

const EditableText = ({ el, pageIdx, updateElement, styleClass, styleProps }) => {
    const ref = React.useRef(null)
    const focusedRef = React.useRef(false)
    const debounceRef = React.useRef(null)
    const latestContentRef = React.useRef(el.content || '')
    const savedContentRef = React.useRef(el.content || '')
    const updateRef = React.useRef({ updateElement, pageIdx, id: el.id })

    updateRef.current = { updateElement, pageIdx, id: el.id }
    savedContentRef.current = el.content || ''

    React.useEffect(() => {
        // Don't overwrite in-progress typing from stale props while focused
        if (focusedRef.current) return
        if (ref.current && ref.current.textContent !== (el.content || '')) {
            ref.current.textContent = el.content || ''
        }
    }, [el.content])

    React.useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        const { updateElement: update, pageIdx: idx, id } = updateRef.current
        if (update && latestContentRef.current !== savedContentRef.current) {
            update(idx, id, { content: latestContentRef.current })
        }
    }, [])

    const commitContent = (text) => {
        if (!updateElement) return
        latestContentRef.current = text
        if (text === (el.content || '')) return
        updateElement(pageIdx, el.id, { content: text })
    }

    return (
        <div
            ref={ref}
            className={styleClass}
            contentEditable
            suppressContentEditableWarning
            style={styleProps}
            onFocus={() => { focusedRef.current = true }}
            onBlur={(e) => {
                focusedRef.current = false
                if (debounceRef.current) {
                    clearTimeout(debounceRef.current)
                    debounceRef.current = null
                }
                commitContent(e.target.textContent || '')
            }}
            onInput={(e) => {
                const text = e.target.textContent || ''
                latestContentRef.current = text
                if (debounceRef.current) clearTimeout(debounceRef.current)
                debounceRef.current = setTimeout(() => commitContent(text), 200)
            }}
        />
    )
}

const ElementContent = ({ el, pageIdx, updateElement }) => {
    switch (el.type) {
        case 'text':
            // Render unicode/emoji symbols and SFX text as static, non-editable so they stay freely draggable on the canvas
            if (el.symbol || el.sfx) {
                return <div className="el-text el-symbol" style={styles.text(el)}>{el.content}</div>
            }
            return (
                <EditableText
                    el={el}
                    pageIdx={pageIdx}
                    updateElement={updateElement}
                    styleClass="el-text"
                    styleProps={styles.text(el)}
                />
            )
        case 'sfx':
            return <div className="el-text el-symbol" style={styles.text(el)}>{el.content}</div>
        case 'image':
            return (
                <div className="el-img" style={styles.imageContainer}>
                    <img
                        src={el.src}
                        alt=""
                        style={styles.image(el)}
                    />
                </div>
            )
        case 'panel':
            return <div className="el-panel" style={styles.panel(el)} />
        case 'shape':
            return <div className="el-shape" style={styles.shape(el)} />
        case 'balloon':
            return (
                <EditableText
                    el={el}
                    pageIdx={pageIdx}
                    updateElement={updateElement}
                    styleClass="el-text"
                    styleProps={styles.balloon(el)}
                />
            )
        case 'shader':
            return (
                <div style={styles.shaderContainer}>
                    <ShaderElement
                        preset={el.shaderPreset || 'plasma'}
                        customCode={el.customCode}
                        width={el.width}
                        height={el.height}
                    />
                </div>
            )
        case 'object':
            return (
                <Object3D
                    model={el.objModel || 'crystal'}
                    color={el.objColor || '#4488ff'}
                    autoRotate={el.objSpin !== false}
                    width={el.width}
                    height={el.height}
                />
            )
        case 'video':
            return (
                <div style={styles.video}>VIDEO: {el.src || 'No Source'}</div>
            )
        case 'audio-log':
        case 'audio-viz':
            return (
                <AudioViz
                    src={el.src}
                    color={el.color || 'var(--vp-accent)'}
                    width={el.width}
                    height={el.height}
                />
            )
        default:
            return null
    }
}


export default ElementContent