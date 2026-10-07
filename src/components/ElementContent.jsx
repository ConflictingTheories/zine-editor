/*
 * Component: ElementContent
 * Renders editable element content inside the canvas and handles text / media display.
 */

import React from 'react'
import ShaderElement from './ShaderElement.jsx'
import AudioViz from './AudioViz.jsx'
import Object3D from './Object3D.jsx'
import PlayableEmbed from './PlayableEmbed.jsx'

/**
 * Component: ElementContent
 * Renders the inner content for an editor element depending on `el.type`.
 * This file centralizes the rendering logic for text/image/panel/shader/etc.
 *
 * Props:
 * - el: element descriptor object
 * - pageIdx: index of the page containing the element
 * - updateElement: function(pageIdx, elementId, updates) to persist changes
 */

const BALLOON_PROPS = {
    dialog: { background: '#fff', border: '2px solid #000', borderRadius: '20px' },
    thought: { background: '#fff', border: '2px solid #000', borderRadius: '50%' },
    shout: { background: '#fff', border: '4px solid #000', fontWeight: 'bold' },
    caption: { background: '#000', color: '#fff' },
    whisper: { background: '#f8f8f8', border: '1px dashed #999', borderRadius: '16px', fontStyle: 'italic' },
    narration: { background: '#ffe', border: '1px solid #cc9', fontStyle: 'italic' }
}

// Panels have their own surface model, separate from the editor wrapper.
// This preserves legacy `fill` values while enabling explicit solid and
// gradient fills in the inspector.
export const getPanelBackground = (el) => {
    if (el.panelFillType === 'transparent') return 'transparent'
    if (el.panelFillType === 'gradient') {
        const angle = Number.isFinite(Number(el.panelGradientAngle)) ? el.panelGradientAngle : 135
        return `linear-gradient(${angle}deg, ${el.panelFillColor || el.fill || '#ffffff'}, ${el.panelFillColorEnd || '#000000'})`
    }
    if (el.panelFillType === 'solid') return el.panelFillColor || el.fill || '#ffffff'
    return el.fill || 'transparent'
}

export const lightTableFilter = (recipe) => {
    if (!recipe) return undefined
    const params = recipe.params || {}
    const filters = [`brightness(${Math.pow(2, Number(params.exposure || 0))})`, `contrast(${Number(params.contrast ?? 1)})`, `saturate(${Number(params.saturation ?? 1)})`]
        ; (recipe.effects || []).forEach(layer => {
            if (layer.id === 'vignette') filters.push(`brightness(${1 - Number(layer.strength || 0) * .35})`)
            if (layer.id === 'grain') filters.push(`contrast(${1 + Number(layer.strength || 0) * .12})`)
            if (layer.id === 'posterize') filters.push(`contrast(${1 + Number(layer.strength || 0) * .8})`)
            if (layer.id === 'chroma') filters.push(`hue-rotate(${Number(layer.strength || 0) * 8}deg)`)
        })
    return filters.join(' ')
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
    imageContainer: (el) => {
        let pad = 0; let bg = 'transparent'; let shadow = 'none'; let border = 'none';
        if (el.matStyle === 'thin') { pad = '8px'; bg = '#fff'; shadow = '0 2px 8px rgba(0,0,0,0.2)'; }
        if (el.matStyle === 'polaroid') { pad = '12px 12px 40px 12px'; bg = '#fff'; shadow = '0 4px 12px rgba(0,0,0,0.3)'; }
        if (el.matStyle === 'gallery') { pad = '40px'; bg = '#fafafa'; shadow = 'inset 0 0 10px rgba(0,0,0,0.1), 0 10px 25px rgba(0,0,0,0.5)'; border = '4px solid #222'; }
        return {
            width: '100%',
            height: '100%',
            padding: pad,
            background: bg,
            boxShadow: shadow,
            border: border,
            boxSizing: 'border-box'
        }
    },
    image: (el) => ({
        pointerEvents: 'none',
        objectFit: el.objectFit || 'contain',
        borderRadius: el.imgRadius ? `${el.imgRadius}px` : '0',
        width: '100%',
        height: '100%',
        display: 'block',
        // A Light Table recipe can remain live in an interactive publication.
        // CSS is the resilient playback fallback; the authored recipe remains
        // attached to the element for the GPU renderer/exporter to consume.
        filter: lightTableFilter(el.lightTableRecipe)
    }),
    panel: (el) => ({
        border: el.panelBorderWidth !== undefined ? `${el.panelBorderWidth}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}` : 'var(--panel-border)',
        borderRadius: el.panelRadius !== undefined ? `${el.panelRadius}px` : 'var(--radius)',
        background: getPanelBackground(el),
        boxShadow: el.panelShadow || 'none',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        pointerEvents: 'none'
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
            fontFamily: el.fontFamily || 'var(--font-body, serif)',
            fontWeight: el.bold ? 'bold' : bStyle.fontWeight || 'normal',
            fontStyle: el.italic ? 'italic' : bStyle.fontStyle || 'normal',
            lineHeight: el.lineHeight || 'normal',
            letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : 'normal',
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

/**
 * EditableText
 * A small controlled contentEditable wrapper that debounces updates and
 * avoids overwriting user input while focused.
 */
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

/**
 * The portfolio's primary placement primitive. A frame is a mat, a window and
 * a caption rail — not a bare image box — so a book reads as a book without
 * the photographer hand-tuning borders on every spread.
 */
export const PhotoFrameSurface = ({ el, onRequestImage, onDropAsset, onContextMenu }) => {
    const mode = el.frameStyle || 'mat'
    const matTop = el.frameWidth ?? 18
    const matBottom = el.frameWidthBottom ?? matTop
    const matRight = el.frameWidthRight ?? matTop
    const hasImage = Boolean(el.src)

    const padding = mode === 'bleed' || mode === 'none'
        ? 0
        : mode === 'inset'
            ? `${matTop}px ${matRight}px ${matBottom}px ${matTop}px`
            : `${matTop}px ${matRight}px ${matBottom}px ${matTop}px`

    const captionSpace = Math.max(matBottom - matTop, 0)
    const sideSpace = Math.max(matRight - matTop, 0)

    return (
        <div
            className={`el-photo-frame frame-${mode} ${hasImage ? '' : 'is-empty'}`}
            style={{
                width: '100%',
                height: '100%',
                padding: mode === 'bleed' || mode === 'none' ? 0 : undefined,
                paddingTop: mode === 'bleed' || mode === 'none' ? 0 : `${matTop}px`,
                paddingRight: mode === 'bleed' || mode === 'none' ? 0 : `${matRight}px`,
                paddingLeft: mode === 'bleed' || mode === 'none' ? 0 : `${matTop}px`,
                paddingBottom: 0,
                boxSizing: 'border-box',
                background: mode === 'bleed' || mode === 'none' ? 'transparent' : (el.frameColor || '#faf8f4'),
                border: el.frameBorderWidth
                    ? `${el.frameBorderWidth}px solid ${el.frameBorderColor || '#000000'}`
                    : 'none',
                borderRadius: el.frameRadius ? `${el.frameRadius}px` : 0,
                boxShadow: el.frameShadow || 'none',
                display: 'flex',
                // A frame with a pillar rail puts the caption beside the image,
                // so the two live in a row; every other frame is a column.
                flexDirection: sideSpace > captionSpace && sideSpace > 0 ? 'row' : 'column'
            }}
        >
            <div
                className="el-photo-frame-window"
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    minHeight: 0,
                    background: el.frameWindowColor || '#111111',
                    border: mode === 'inset' && el.frameBorderWidth
                        ? `${el.frameBorderWidth}px solid ${el.frameBorderColor || '#1a1a1a'}`
                        : 'none',
                    outline: mode === 'bleed' ? 'none' : undefined
                }}
                onClick={hasImage ? undefined : (e) => { e.stopPropagation(); onRequestImage?.(el) }}
                onDragOver={e => { if (!hasImage) e.preventDefault() }}
                onDrop={e => { if (!hasImage) { e.preventDefault(); onDropAsset?.(el, e) } }}
            >
                {hasImage ? (
                    <img
                        src={el.src}
                        alt={el.alt || el.assetName || ''}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'block',
                            objectFit: el.imageFit || 'cover',
                            objectPosition: el.imagePosition || 'center',
                            filter: lightTableFilter(el.lightTableRecipe)
                        }}
                    />
                ) : (
                    <div className="el-photo-frame-empty">
                        <span className="el-photo-frame-plus">+</span>
                        <span>{onRequestImage ? 'Click to add a photo' : 'Drop a photo here'}</span>
                    </div>
                )}
            </div>
            {mode !== 'bleed' && mode !== 'none' && (el.caption || captionSpace > 0 || sideSpace > 0) && (
                <div
                    className="el-photo-frame-caption"
                    style={{
                        height: captionSpace > 0 ? captionSpace : 'auto',
                        width: sideSpace > 0 ? sideSpace : 'auto',
                        // A pillar rail sits beside the image, so it reads top
                        // to bottom rather than left to right.
                        writingMode: sideSpace > captionSpace ? 'vertical-rl' : 'horizontal-tb'
                    }}
                >
                    {el.caption || <span className="el-photo-frame-caption-hint">Caption</span>}
                </div>
            )}
        </div>
    )
}

const ElementContent = ({ el, pageIdx, updateElement, onRequestImage, onDropAsset }) => {
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
                <div className={`el-img ${el.lightTableRecipe?.effects?.some(effect => effect.id === 'water') || el.lightTableRecipe?.effect === 'water' ? 'el-img-ethereal-water' : ''}`} style={typeof styles.imageContainer === 'function' ? styles.imageContainer(el) : styles.imageContainer}>
                    <img
                        src={el.src}
                        alt=""
                        style={styles.image(el)}
                    />
                </div>
            )
        case 'photo-frame':
            return <PhotoFrameSurface el={el} />
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
        case 'playable':
            return <PlayableEmbed playable={el.playable || el} />
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
