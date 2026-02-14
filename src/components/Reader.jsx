import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'
import ShaderElement from './ShaderElement.jsx'

const ANIMATION_MAP = {
    'flash-in': 'reader-flash-in',
    'lightning': 'reader-el-lightning',
    'shake': 'reader-el-shake',
    'pulse': 'reader-el-pulse',
    'spin': 'reader-el-spin'
}

const BALLOON_PROPS = {
    dialog: { background: '#fff', border: '2px solid #000', borderRadius: '20px' },
    thought: { background: '#fff', border: '2px solid #000', borderRadius: '50%' },
    shout: { background: '#fff', border: '4px solid #000', fontWeight: 'bold' },
    caption: { background: '#000', color: '#fff' },
    whisper: { background: '#f8f8f8', border: '1px dashed #999', borderRadius: '16px', fontStyle: 'italic' },
    narration: { background: '#ffe', border: '1px solid #cc9', fontStyle: 'italic' }
}

const styles = {
    toolbarSpacer: { flex: 1 },
    page: (page) => ({
        background: page.background || '#fff',
        position: 'relative'
    }),
    texture: (page) => ({
        position: 'absolute', inset: 0,
        backgroundImage: `url(${page.texture})`,
        backgroundSize: 'cover', opacity: 0.2,
        pointerEvents: 'none'
    }),
    element: (el, hidden) => {
        const animName = ANIMATION_MAP[el.animation] || null
        const animDuration = el.animDuration ?? 1
        const animIter = el.animLoop ? 'infinite' : '1'
        return {
            position: 'absolute',
            left: el.x, top: el.y, width: el.width, height: el.height,
            transform: `rotate(${el.rotation || 0}deg)`,
            zIndex: el.zIndex,
            opacity: el.opacity ?? 1,
            mixBlendMode: el.blendMode || 'normal',
            cursor: el.action ? 'pointer' : 'default',
            display: hidden ? 'none' : undefined,
            // Visual effects (were missing)
            boxShadow: el.shadow || 'none',
            filter: el.blur ? `blur(${el.blur}px)` : el.filter || 'none',
            border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none',
            borderRadius: el.borderRadius ? `${el.borderRadius}px` : '0',
            // CSS animation
            animation: animName ? `${animName} ${animDuration}s ease ${animIter}` : 'none'
        }
    },
    text: (el) => ({
        fontSize: el.fontSize, color: el.color, fontFamily: el.fontFamily,
        textAlign: el.align, fontWeight: el.bold ? 'bold' : 'normal',
        fontStyle: el.italic ? 'italic' : 'normal',
        lineHeight: el.lineHeight || 'normal',
        letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : 'normal',
        textShadow: el.textShadow || 'none',
        WebkitTextStroke: el.strokeWidth ? `${el.strokeWidth}px ${el.strokeColor || '#fff'}` : 'none'
    }),
    image: (el) => ({
        width: '100%', height: '100%',
        objectFit: el.objectFit || 'contain',
        borderRadius: el.imgRadius ? `${el.imgRadius}px` : '0'
    }),
    panel: (el) => ({
        width: '100%', height: '100%',
        border: `${el.panelBorderWidth || 4}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}`,
        borderRadius: `${el.panelRadius || 0}px`,
        background: el.fill || 'transparent',
        boxShadow: el.panelShadow || 'none'
    }),
    shape: (el) => {
        const base = {
            width: '100%', height: '100%',
            background: el.shape === 'triangle' ? 'transparent' : (el.fill || '#000'),
            borderRadius: el.shape === 'circle' ? '50%' : 0
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
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', width: '100%', height: '100%',
            ...bStyle
        }
    },
    video: { width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    audioLog: { width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid #d4af37', padding: 10, color: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    modalControls: {
        display: 'flex', gap: '10px', marginTop: '15px'
    }
}

function Reader() {
    const { vpState, showView, playBGM, stopBGM, playSFX, triggerVfx } = useVP()
    const { currentProject, readerMode } = vpState
    const [pageIdx, setPageIdx] = useState(0)
    const [unlockedPages, setUnlockedPages] = useState(new Set())
    const [passwordModal, setPasswordModal] = useState({ active: false, targetIdx: -1, value: '' })
    const [toggledLabels, setToggledLabels] = useState(new Set())

    const project = currentProject
    if (!project) return <div className="reader-empty">No project loaded</div>

    const page = project.pages[pageIdx]

    useEffect(() => {
        if (page?.bgm) playBGM(page.bgm)
        else stopBGM()
        return () => stopBGM()
    }, [pageIdx, page])

    const handleNext = () => {
        let nextIdx = pageIdx + 1
        while (nextIdx < project.pages.length) {
            const p = project.pages[nextIdx]
            if (!p.isLocked || unlockedPages.has(nextIdx)) {
                setPageIdx(nextIdx)
                return
            }
            nextIdx++
        }
    }

    const handlePrev = () => {
        let prevIdx = pageIdx - 1
        while (prevIdx >= 0) {
            const p = project.pages[prevIdx]
            if (!p.isLocked || unlockedPages.has(prevIdx)) {
                setPageIdx(prevIdx)
                return
            }
            prevIdx--
        }
    }

    const handleInteraction = (el) => {
        const { action, actionVal } = el
        if (!action) return

        switch (action) {
            case 'goto': {
                const target = parseInt(actionVal, 10) - 1
                if (isNaN(target) || target < 0 || target >= project.pages.length) break
                const targetPage = project.pages[target]
                if (targetPage?.isLocked && !unlockedPages.has(target)) {
                    setPasswordModal({ active: true, targetIdx: target, value: '' })
                } else {
                    setPageIdx(target)
                }
                break
            }
            case 'unlock':
                const unlockIdx = parseInt(actionVal) - 1
                if (!isNaN(unlockIdx)) {
                    setUnlockedPages(prev => new Set(prev).add(unlockIdx))
                }
                break
            case 'password':
                const passIdx = parseInt(actionVal) - 1
                if (!isNaN(passIdx)) {
                    setPasswordModal({ active: true, targetIdx: passIdx, value: '' })
                }
                break
            case 'vfx':
                // fallback to "flash" when actionVal is missing so older elements still trigger
                triggerVfx(actionVal || 'flash')
                break
            case 'sfx':
                playSFX(actionVal)
                break
            case 'link':
                window.open(actionVal, '_blank')
                break
            case 'toggle':
                if (actionVal) setToggledLabels(prev => {
                    const next = new Set(prev)
                    if (next.has(actionVal)) next.delete(actionVal)
                    else next.add(actionVal)
                    return next
                })
                break
            default:
                break
        }
    }

    const handlePasswordSubmit = () => {
        const targetPage = project.pages[passwordModal.targetIdx]
        if (targetPage && targetPage.password === passwordModal.value) {
            setUnlockedPages(prev => new Set(prev).add(passwordModal.targetIdx))
            setPageIdx(passwordModal.targetIdx)
            setPasswordModal({ active: false, targetIdx: -1, value: '' })
        } else {
            alert('Incorrect Password')
        }
    }

    return (
        <div className="reader-view">
            <div className="reader-toolbar">
                <button className="reader-close btn-secondary" onClick={() => {
                    if (readerMode === 'preview') showView('editor')
                    else showView('discover')
                }}>✕ Close</button>
                <div style={styles.toolbarSpacer}></div>
                <span>{pageIdx + 1} / {project.pages.length}</span>
            </div>

            <div className="reader-canvas-wrap">
                <div className="reader-page" style={styles.page(page)}>
                    {page.texture && (
                        <div style={styles.texture(page)} />
                    )}
                    {page.elements.filter(e => !e.hidden).map(el => {
                        const hiddenByToggle = el.isHidden && !toggledLabels.has(el.label)
                        return (
                            <div
                                key={el.id}
                                className="reader-el reader-el-item"
                                data-label={el.label || ''}
                                style={styles.element(el, hiddenByToggle)}
                                onClick={() => handleInteraction(el)}
                            >
                                {el.type === 'text' && (
                                    <div style={styles.text(el)}>{el.content}</div>
                                )}
                                {el.type === 'image' && (
                                    <img src={el.src} style={styles.image(el)} alt="" />
                                )}
                                {el.type === 'panel' && (
                                    <div style={styles.panel(el)} />
                                )}
                                {el.type === 'shape' && (
                                    <div style={styles.shape(el)} />
                                )}
                                {el.type === 'shader' && (
                                    <ShaderElement preset={el.shaderPreset} width={el.width} height={el.height} />
                                )}
                                {el.type === 'balloon' && (
                                    <div style={styles.balloon(el)}>{el.content}</div>
                                )}
                                {el.type === 'video' && (
                                    el.src
                                        ? <video src={el.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls autoPlay muted />
                                        : <div style={styles.video}>VIDEO: No Source</div>
                                )}
                                {el.type === 'audio-log' && (
                                    <div style={styles.audioLog}>
                                        <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                onClick={(e) => { e.stopPropagation(); if (el.src) { const a = new Audio(el.src); a.play().catch(() => { }) } }}
                                            >▶</div>
                                            <span style={{ fontSize: 12 }}>{el.label || 'AUDIO LOG'}</span>
                                        </div>
                                        <div style={{ flex: 1, background: '#222', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#666' }}>[{el.vizTheme || 'bars'}]</div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="reader-controls">
                <button className="btn-primary" onClick={handlePrev}>◀ Prev</button>
                <button className="btn-primary" onClick={handleNext}>Next ▶</button>
            </div>

            {passwordModal.active && (
                <div className="modal-overlay active">
                    <div className="modal-box">
                        <h3>🔒 Locked</h3>
                        <p>Enter password to unlock path</p>
                        <input
                            type="password"
                            className="input-main"
                            value={passwordModal.value}
                            onChange={(e) => setPasswordModal(prev => ({ ...prev, value: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                            autoFocus
                        />
                        <div style={styles.modalControls}>
                            <button className="btn-primary" onClick={handlePasswordSubmit}>Unlock</button>
                            <button className="btn-secondary" onClick={() => setPasswordModal({ active: false, targetIdx: -1, value: '' })}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Reader
