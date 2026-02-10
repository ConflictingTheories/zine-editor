import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'
import ShaderElement from './ShaderElement.jsx'

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
                triggerVfx(actionVal)
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
                <div style={{ flex: 1 }}></div>
                <span>{pageIdx + 1} / {project.pages.length}</span>
            </div>

            <div className="reader-canvas-wrap">
                <div className="reader-page" style={{ background: page.background || '#fff', position: 'relative' }}>
                    {page.texture && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `url(${page.texture})`,
                            backgroundSize: 'cover', opacity: 0.2,
                            pointerEvents: 'none'
                        }} />
                    )}
                    {page.elements.filter(e => !e.hidden).map(el => {
                        const hiddenByToggle = el.isHidden && !toggledLabels.has(el.label)
                        return (
                        <div
                            key={el.id}
                            className="reader-el reader-el-item"
                            data-label={el.label || ''}
                            style={{
                                position: 'absolute',
                                left: el.x, top: el.y, width: el.width, height: el.height,
                                transform: `rotate(${el.rotation || 0}deg)`,
                                zIndex: el.zIndex,
                                opacity: el.opacity ?? 1,
                                mixBlendMode: el.blendMode || 'normal',
                                cursor: el.action ? 'pointer' : 'default',
                                display: hiddenByToggle ? 'none' : undefined
                            }}
                            onClick={() => handleInteraction(el)}
                        >
                            {el.type === 'text' && (
                                <div style={{
                                    fontSize: el.fontSize, color: el.color, fontFamily: el.fontFamily,
                                    textAlign: el.align, fontWeight: el.bold ? 'bold' : 'normal',
                                    fontStyle: el.italic ? 'italic' : 'normal'
                                }}>{el.content}</div>
                            )}
                            {el.type === 'image' && (
                                <img src={el.src} style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain' }} alt="" />
                            )}
                            {el.type === 'panel' && (
                                <div style={{
                                    width: '100%', height: '100%',
                                    border: `${el.panelBorderWidth}px ${el.panelBorderStyle} ${el.panelBorderColor}`,
                                    borderRadius: el.panelRadius, background: el.fill
                                }} />
                            )}
                            {el.type === 'shape' && (
                                <div style={{
                                    width: '100%', height: '100%',
                                    background: el.shape === 'triangle' ? 'transparent' : el.fill,
                                    borderRadius: el.shape === 'circle' ? '50%' : 0,
                                    clipPath: el.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none'
                                }} />
                            )}
                            {el.type === 'shader' && (
                                <ShaderElement preset={el.shaderPreset} width={el.width} height={el.height} />
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
                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
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
