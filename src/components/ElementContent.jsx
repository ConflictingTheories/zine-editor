import React from 'react'
import ShaderElement from './ShaderElement.jsx'
import AudioViz from './AudioViz.jsx'
import AudioLog from './AudioLog.jsx'
import WidgetRegistry from '../lib/WidgetRegistry.jsx'
import { SovereignSDK } from '../lib/sovereign-sdk.js'
import { useState, useEffect } from 'react'

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
    const [decrypted, setDecrypted] = useState(null)
    const [isDecrypting, setIsDecrypting] = useState(false)

    useEffect(() => {
        if (el.sealedContent && window._sovereign_identity && !decrypted) {
            handleDecrypt()
        }
    }, [el.sealedContent, window._sovereign_identity])

    const handleDecrypt = async () => {
        if (!el.sealedContent || !el.sealEnvelope) return
        setIsDecrypting(true)
        try {
            const pt = await SovereignSDK.decrypt(
                el.sealedContent,
                el.sealEnvelope,
                el.sealKey || 'default',
                window._sovereign_identity.id
            )
            setDecrypted(pt)
        } catch (e) {
            console.warn("SCEE: Decryption failed", e)
        } finally {
            setIsDecrypting(false)
        }
    }

    const handleBlur = (e) => {
        if (e.target.textContent !== el.content && updateElement) {
            updateElement(pageIdx, el.id, { content: e.target.textContent })
        }
    }

    // Use decrypted content if available
    const displayEl = decrypted ? {
        ...el, ...{
            text: el.type === 'text' ? decrypted : el.text,
            src: el.type === 'image' || el.type === 'video' ? decrypted : el.src,
            rssUrl: el.type === 'widget' ? decrypted : el.rssUrl,
            content: el.type === 'text' || el.type === 'balloon' ? decrypted : el.content
        }
    } : el

    if (el.sealedContent && !decrypted) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', border: '1px dashed var(--vp-accent)', color: 'var(--vp-accent)', fontSize: '10px', textAlign: 'center' }}>
                {isDecrypting ? 'DECRYPTING...' : 'PROTECTED_BY_SCEE'}
            </div>
        )
    }

    switch (displayEl.type) {
        case 'text':
            return (
                <div
                    className="el-text"
                    contentEditable
                    suppressContentEditableWarning
                    style={styles.text(displayEl)}
                    onBlur={handleBlur}
                >
                    {displayEl.content || displayEl.text}
                </div>
            )
        case 'image':
            return (
                <div className="el-img" style={styles.imageContainer}>
                    <img
                        src={displayEl.src}
                        alt=""
                        style={styles.image(displayEl)}
                    />
                </div>
            )
        case 'panel':
            return <div className="el-panel" style={styles.panel(displayEl)} />
        case 'shape':
            return <div className="el-shape" style={styles.shape(displayEl)} />
        case 'balloon':
            return (
                <div
                    className="el-text"
                    contentEditable
                    suppressContentEditableWarning
                    style={styles.balloon(displayEl)}
                    onBlur={handleBlur}
                >
                    {displayEl.content}
                </div>
            )
        case 'shader':
            return (
                <div style={styles.shaderContainer}>
                    <ShaderElement
                        preset={displayEl.shaderPreset || 'plasma'}
                        customCode={displayEl.customCode}
                        width={displayEl.width}
                        height={displayEl.height}
                    />
                </div>
            )
        case 'video':
            return (
                <div style={styles.video}>VIDEO: {displayEl.src || 'No Source'}</div>
            )
        case 'audio-log':
            return (
                <AudioLog
                    src={displayEl.src}
                    color={displayEl.color || 'var(--vp-accent)'}
                    width={displayEl.width}
                    height={displayEl.height}
                    seed={displayEl.seed || 123}
                />
            )
        case 'audio-viz':
            return (
                <AudioViz
                    src={displayEl.src}
                    color={displayEl.color || 'var(--vp-accent)'}
                    width={displayEl.width}
                    height={displayEl.height}
                />
            )
        case 'widget':
            const Widget = WidgetRegistry[displayEl.widgetType]
            return Widget ? <Widget {...displayEl} /> : <div style={{ background: '#f00', color: '#fff', fontSize: '10px' }}>MISSING_WIDGET: {displayEl.widgetType}</div>
        default:
            return null
    }
}


export default ElementContent