import React from 'react'
import ShaderElement from './ShaderElement.jsx'

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
        fontFamily: el.fontFamily || 'inherit',
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
        border: `${el.panelBorderWidth || 4}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}`,
        borderRadius: `${el.panelRadius || 0}px`,
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

const ElementContent = ({ el, pageIdx, updateElement }) => {
    const handleBlur = (e) => {
        if (e.target.textContent !== el.content && updateElement) {
            updateElement(pageIdx, el.id, { content: e.target.textContent })
        }
    }

    switch (el.type) {
        case 'text':
            return (
                <div
                    className="el-text"
                    contentEditable
                    suppressContentEditableWarning
                    style={styles.text(el)}
                    onBlur={handleBlur}
                >
                    {el.content}
                </div>
            )
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
                <div
                    className="el-text"
                    contentEditable
                    suppressContentEditableWarning
                    style={styles.balloon(el)}
                    onBlur={handleBlur}
                >
                    {el.content}
                </div>
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
        case 'video':
            return (
                <div style={styles.video}>VIDEO: {el.src || 'No Source'}</div>
            )
        case 'audio-log':
            return (
                <div style={styles.audioLog}>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</div>
                        <span style={{ fontSize: 12 }}>{el.label || 'AUDIO LOG'}</span>
                    </div>
                    <div style={{ flex: 1, background: '#222', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#666' }}>[VISUALIZER: {el.vizTheme}]</div>
                </div>
            )
        default:
            return null
    }
}

export default ElementContent