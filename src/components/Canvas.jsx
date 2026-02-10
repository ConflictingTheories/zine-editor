import React, { useRef, useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { useEditor } from '../hooks/useEditor.js'
import ShaderElement from './ShaderElement.jsx'
import ContextMenu from './ContextMenu.jsx'

function Canvas({ page, pageIdx, snapOn = true, gridOn = false }) {
    const { vpState, updateVpState } = useVP()
    const { selection } = vpState
    const { startDrag, startResize, startRotate } = useEditor()
    const canvasRef = useRef(null)
    const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, element: null })

    const handleElementClick = (e, elId) => {
        e.stopPropagation()
        updateVpState({ selection: { type: 'element', id: elId, pageIdx } })
    }

    const handleCanvasClick = () => {
        updateVpState({ selection: { type: 'page', id: page.id, pageIdx } })
    }

    const handleContextMenu = (e, el) => {
        e.preventDefault()
        e.stopPropagation()
        setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, element: el })
    }

    return (
        <>
        <div
            className={`ed-canvas ${page.orientation || 'portrait'} ${gridOn ? 'show-grid' : ''}`}
            style={{ background: page.background || '#fff', width: 528, height: 816 }}
            onClick={handleCanvasClick}
            onContextMenu={e => handleContextMenu(e, null)}
            ref={canvasRef}
        >
            {(page.elements || []).filter(el => !el.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((el) => {
                const isSelected = selection.type === 'element' && selection.id === el.id

                const elementStyle = {
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
                }

                const renderContent = () => {
                    switch (el.type) {
                        case 'text':
                            return (
                                <div
                                    className="el-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    style={{
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
                                    }}
                                    onBlur={(e) => {
                                        if (e.target.textContent !== el.content) {
                                            updateElement(pageIdx, el.id, { content: e.target.textContent })
                                        }
                                    }}
                                >
                                    {el.content}
                                </div>
                            )
                        case 'image':
                            return (
                                <div className="el-img">
                                    <img
                                        src={el.src}
                                        alt=""
                                        style={{
                                            pointerEvents: 'none',
                                            objectFit: el.objectFit || 'contain',
                                            borderRadius: el.imgRadius ? `${el.imgRadius}px` : '0'
                                        }}
                                    />
                                </div>
                            )
                        case 'panel':
                            return (
                                <div
                                    className="el-panel"
                                    style={{
                                        border: `${el.panelBorderWidth || 4}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}`,
                                        borderRadius: `${el.panelRadius || 0}px`,
                                        background: el.fill || 'transparent',
                                        boxShadow: el.panelShadow || 'none',
                                        width: '100%',
                                        height: '100%'
                                    }}
                                />
                            )
                        case 'shape':
                            const shapeStyle = {
                                background: el.shape === 'triangle' ? 'transparent' : (el.fill || '#000'),
                                width: '100%',
                                height: '100%',
                                borderRadius: el.shape === 'circle' ? '50%' : '0'
                            }
                            if (el.shape === 'diamond') {
                                shapeStyle.transform = 'rotate(45deg)'
                            }
                            if (el.shape === 'triangle') {
                                shapeStyle.width = '0'
                                shapeStyle.height = '0'
                                shapeStyle.borderLeft = `${el.width / 2}px solid transparent`
                                shapeStyle.borderRight = `${el.width / 2}px solid transparent`
                                shapeStyle.borderBottom = `${el.height}px solid ${el.fill || '#000'}`
                            }
                            return <div className="el-shape" style={shapeStyle} />
                        case 'balloon':
                            const balloonProps = {
                                dialog: { background: '#fff', border: '2px solid #000', borderRadius: '20px' },
                                thought: { background: '#fff', border: '2px solid #000', borderRadius: '50%' },
                                shout: { background: '#fff', border: '4px solid #000', fontWeight: 'bold' },
                                caption: { background: '#000', color: '#fff' },
                                whisper: { background: '#f8f8f8', border: '1px dashed #999', borderRadius: '16px', fontStyle: 'italic' },
                                narration: { background: '#ffe', border: '1px solid #cc9', fontStyle: 'italic' }
                            }
                            const bStyle = balloonProps[el.balloonType || 'dialog'] || balloonProps.dialog
                            return (
                                <div
                                    className="el-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    style={{
                                        fontSize: el.fontSize || 14,
                                        padding: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        width: '100%',
                                        height: '100%',
                                        ...bStyle
                                    }}
                                >
                                    {el.content}
                                </div>
                            )
                        case 'shader':
                            return (
                                <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
                                    <ShaderElement
                                        preset={el.shaderPreset || 'plasma'}
                                        customCode={el.customCode}
                                        width={el.width}
                                        height={el.height}
                                    />
                                </div>
                            )
                        default:
                            return null
                    }
                }

                return (
                    <div
                        key={el.id}
                        className={`el ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                        style={elementStyle}
                        onMouseDown={(e) => isSelected && !el.locked && startDrag(e, el, pageIdx)}
                        onClick={(e) => handleElementClick(e, el.id)}
                        onContextMenu={(e) => handleContextMenu(e, el)}
                    >
                        {renderContent()}

                        {isSelected && !el.locked && (
                            <>
                                <div className="rh nw" onMouseDown={(e) => startResize(e, el, pageIdx, 'nw')}></div>
                                <div className="rh n" onMouseDown={(e) => startResize(e, el, pageIdx, 'n')}></div>
                                <div className="rh ne" onMouseDown={(e) => startResize(e, el, pageIdx, 'ne')}></div>
                                <div className="rh e" onMouseDown={(e) => startResize(e, el, pageIdx, 'e')}></div>
                                <div className="rh se" onMouseDown={(e) => startResize(e, el, pageIdx, 'se')}></div>
                                <div className="rh s" onMouseDown={(e) => startResize(e, el, pageIdx, 's')}></div>
                                <div className="rh sw" onMouseDown={(e) => startResize(e, el, pageIdx, 'sw')}></div>
                                <div className="rh w" onMouseDown={(e) => startResize(e, el, pageIdx, 'w')}></div>
                                <div className="rh rot" onMouseDown={(e) => startRotate(e, el, pageIdx)}></div>
                            </>
                        )}
                    </div>
                )
            })}
        </div>
        <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            visible={ctxMenu.visible}
            onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
            selection={selection}
            pageIdx={pageIdx}
            selectedElement={ctxMenu.element}
        />
        </>
    )
}

export default Canvas
