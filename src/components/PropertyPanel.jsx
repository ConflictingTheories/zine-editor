import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const VFX_OPTIONS = [
    { id: 'flash', name: 'Flash' },
    { id: 'lightning', name: 'Lightning' },
    { id: 'shake', name: 'Shake' },
    { id: 'pulse', name: 'Pulse' }
]

function PropertyPanel({ activeTab = 'props' }) {
    const { vpState, updateElement, updateVpState, playSFX } = useVP()
    const { selection, currentProject } = vpState

    if (!currentProject) {
        return <p className="empty-msg" style={{ padding: '20px', fontStyle: 'italic', color: 'var(--vp-text-dim)' }}>Select an element or the canvas to edit</p>
    }

    const pageIdx = selection?.pageIdx ?? 0
    const page = currentProject.pages[pageIdx]
    const numPages = currentProject.pages.length

    if (selection.type === 'page' || !selection.id) {
        if (activeTab === 'effects') {
            return <p className="empty-msg" style={{ padding: '20px', fontStyle: 'italic', color: 'var(--vp-text-dim)' }}>Select an element to edit effects</p>
        }
        if (activeTab === 'logic') {
            return <p className="empty-msg" style={{ padding: '20px', fontStyle: 'italic', color: 'var(--vp-text-dim)' }}>Select an element to set interactions</p>
        }
        const updatePage = (key, val) => {
            const project = JSON.parse(JSON.stringify(currentProject))
            project.pages[pageIdx][key] = val
            updateVpState({ currentProject: project })
        }
        return (
            <div className="property-panel">
                <h4 style={{ fontSize: '0.75em', color: 'var(--vp-accent)', marginBottom: 10 }}>PAGE PROPERTIES</h4>
                <div className="prop-section">
                    <div className="form-row">
                        <label>Background</label>
                        <input type="color" value={page.background || '#ffffff'} onChange={(e) => updatePage('background', e.target.value)} />
                    </div>
                    <div className="form-row">
                        <label>Texture</label>
                        <select value={page.texture || ''} onChange={(e) => updatePage('texture', e.target.value)}>
                            <option value="">None</option>
                            <option value="https://www.transparenttextures.com/patterns/old-mathematics.png">Old Paper</option>
                            <option value="https://www.transparenttextures.com/patterns/dark-matter.png">Dark Matter</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Page BGM (URL)</label>
                        <input type="text" value={page.bgm || ''} onChange={(e) => updatePage('bgm', e.target.value)} placeholder="https://.../mood.mp3" />
                    </div>
                    <div className="form-row-checkbox">
                        <label><input type="checkbox" checked={!!page.isLocked} onChange={(e) => updatePage('isLocked', e.target.checked)} /> Locked (skip in flow)</label>
                    </div>
                    {page.isLocked && (
                        <div className="form-row">
                            <label>Access Password</label>
                            <input type="text" value={page.password || ''} onChange={(e) => updatePage('password', e.target.value)} placeholder="Mystery code" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const element = page.elements.find(e => e.id === selection.id)
    if (!element) return null

    const handleChange = (prop, val) => {
        updateElement(selection.pageIdx, element.id, { [prop]: val })
    }

    const fonts = ['Crimson Text', 'Cinzel', 'Cinzel Decorative', 'Bebas Neue', 'Special Elite', 'Bangers', 'Playfair Display', 'EB Garamond', 'Orbitron', 'Roboto Mono', 'Montserrat', 'Assistant', 'Comic Neue', 'Courier Prime', 'MedievalSharp', 'Inter']

    if (activeTab === 'effects') {
        return (
            <div className="property-panel">
                <div className="prop-section">
                    <h4>Effects</h4>
                    <div className="prop-row">
                        <label>Drop Shadow</label>
                        <input type="text" value={element.shadow || ''} onChange={(e) => handleChange('shadow', e.target.value)} placeholder="2px 2px 8px rgba(0,0,0,.5)" />
                    </div>
                    <div className="prop-row">
                        <label>Blur (px)</label>
                        <input type="number" min={0} max={20} value={element.blur || 0} onChange={(e) => handleChange('blur', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="prop-row">
                        <label>Border Width</label>
                        <input type="number" value={element.borderWidth || 0} onChange={(e) => handleChange('borderWidth', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="prop-row">
                        <label>Border Color</label>
                        <input type="color" value={element.borderColor || '#000000'} onChange={(e) => handleChange('borderColor', e.target.value)} />
                    </div>
                    <div className="prop-row">
                        <label>Border Radius</label>
                        <input type="number" value={element.borderRadius || 0} onChange={(e) => handleChange('borderRadius', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="prop-row">
                        <label>Animation</label>
                        <select value={element.animation || 'none'} onChange={(e) => handleChange('animation', e.target.value)}>
                            <option value="none">None</option>
                            <option value="flash-in">Flash In</option>
                            <option value="lightning">Lightning</option>
                            <option value="shake">Shake</option>
                            <option value="pulse">Pulse</option>
                            <option value="spin">Spin</option>
                        </select>
                    </div>
                    <div className="prop-row">
                        <label>Anim Duration (s)</label>
                        <input type="number" step={0.1} min={0.1} max={5} value={element.animDuration ?? 1} onChange={(e) => handleChange('animDuration', parseFloat(e.target.value) || 1)} />
                    </div>
                    <div className="prop-row">
                        <label><input type="checkbox" checked={!!element.animLoop} onChange={(e) => handleChange('animLoop', e.target.checked)} /> Loop</label>
                    </div>
                    {(element.type === 'text' || element.type === 'balloon') && (
                        <>
                            <div className="prop-row">
                                <label>Text Shadow</label>
                                <input type="text" value={element.textShadow || ''} onChange={(e) => handleChange('textShadow', e.target.value)} placeholder="1px 1px 4px #000" />
                            </div>
                            <div className="prop-row">
                                <label>Stroke Width</label>
                                <input type="number" value={element.strokeWidth || 0} onChange={(e) => handleChange('strokeWidth', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="prop-row">
                                <label>Stroke Color</label>
                                <input type="color" value={element.strokeColor || '#ffffff'} onChange={(e) => handleChange('strokeColor', e.target.value)} />
                            </div>
                        </>
                    )}
                    {element.type === 'image' && (
                        <div className="prop-row">
                            <label>CSS Filter</label>
                            <input type="text" value={element.filter || ''} onChange={(e) => handleChange('filter', e.target.value)} placeholder="brightness(1.2) contrast(1.1)" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (activeTab === 'logic') {
        const labeledElements = (page.elements || []).filter(e => e !== element && (e.label || '').trim())
        return (
            <div className="property-panel">
                <div className="prop-section">
                    <h4>Logic / Interactions</h4>
                    <div className="prop-row">
                        <label>Action Type</label>
                        <select value={element.action || ''} onChange={(e) => handleChange('action', e.target.value)}>
                            <option value="">None</option>
                            <option value="goto">Go to Page</option>
                            <option value="unlock">Unlock Page</option>
                            <option value="password">Password Prompt</option>
                            <option value="toggle">Toggle Element</option>
                            <option value="vfx">Screen Effect</option>
                            <option value="sfx">Play SFX</option>
                            <option value="link">Open URL</option>
                        </select>
                    </div>
                    {(element.action === 'goto' || element.action === 'unlock' || element.action === 'password') && (
                        <div className="prop-row">
                            <label>Target Page #</label>
                            <input
                                type="number"
                                min={1}
                                max={numPages}
                                value={element.actionVal ? parseInt(element.actionVal, 10) || 1 : 1}
                                onChange={(e) => handleChange('actionVal', String(Math.max(1, Math.min(numPages, parseInt(e.target.value, 10) || 1))))}
                            />
                        </div>
                    )}
                    {element.action === 'toggle' && (
                        <>
                            <div className="prop-row">
                                <label>Target Element</label>
                                <select value={element.actionVal || ''} onChange={(e) => handleChange('actionVal', e.target.value)}>
                                    <option value="">Select element...</option>
                                    {labeledElements.map(el => (
                                        <option key={el.id} value={el.label}>{el.label} ({el.type})</option>
                                    ))}
                                </select>
                            </div>
                            <p className="prop-hint">Only elements with a Label appear here.</p>
                        </>
                    )}
                    {element.action === 'vfx' && (
                        <div className="prop-row">
                            <label>Effect</label>
                            <select value={element.actionVal || 'flash'} onChange={(e) => handleChange('actionVal', e.target.value)}>
                                {VFX_OPTIONS.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {element.action === 'sfx' && (
                        <>
                            <div className="prop-row">
                                <label>SFX URL</label>
                                <input type="text" value={element.actionVal || ''} onChange={(e) => handleChange('actionVal', e.target.value)} placeholder="https://.../sound.mp3" />
                            </div>
                            <button type="button" className="prop-btn" onClick={() => playSFX(element.actionVal)}>Test Sound</button>
                        </>
                    )}
                    {element.action === 'link' && (
                        <div className="prop-row">
                            <label>Target URL</label>
                            <input type="text" value={element.actionVal || ''} onChange={(e) => handleChange('actionVal', e.target.value)} placeholder="https://..." />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="property-panel">
            <div className="prop-section">
                <div className="form-row prop-row">
                    <label>Element Label</label>
                    <input
                        type="text"
                        value={element.label || ''}
                        onChange={(e) => handleChange('label', e.target.value)}
                        placeholder="ID for interactions (e.g. toggle target)"
                    />
                </div>
            </div>
            <div className="prop-section">
                <h4>Transform</h4>
                <div className="form-row">
                    <label>Position</label>
                    <div className="input-group">
                        <input type="number" value={Math.round(element.x)} onChange={(e) => handleChange('x', parseInt(e.target.value))} title="X" />
                        <input type="number" value={Math.round(element.y)} onChange={(e) => handleChange('y', parseInt(e.target.value))} title="Y" />
                    </div>
                </div>
                <div className="form-row">
                    <label>Dimensions</label>
                    <div className="input-group">
                        <input type="number" value={Math.round(element.width)} onChange={(e) => handleChange('width', parseInt(e.target.value))} title="Width" />
                        <input type="number" value={Math.round(element.height)} onChange={(e) => handleChange('height', parseInt(e.target.value))} title="Height" />
                    </div>
                </div>
                <div className="form-row">
                    <label>Rotation & Opacity</label>
                    <div className="input-group">
                        <input type="number" value={Math.round(element.rotation || 0)} onChange={(e) => handleChange('rotation', parseInt(e.target.value))} title="Rotation" />
                        <input type="number" step="0.1" min="0" max="1" value={element.opacity ?? 1} onChange={(e) => handleChange('opacity', parseFloat(e.target.value))} title="Opacity" />
                    </div>
                </div>
            </div>

            <div className="prop-section">
                <h4>Status</h4>
                <div className="form-row-checkbox">
                    <label><input type="checkbox" checked={!!element.locked} onChange={(e) => handleChange('locked', e.target.checked)} /> Locked</label>
                    <label><input type="checkbox" checked={!!element.hidden} onChange={(e) => handleChange('hidden', e.target.checked)} /> Hidden</label>
                </div>
            </div>

            {(element.type === 'text' || element.type === 'balloon') && (
                <div className="prop-section">
                    <h4>Typography</h4>
                    <div className="form-row">
                        <label>Font Family</label>
                        <select value={element.fontFamily || 'Crimson Text'} onChange={(e) => handleChange('fontFamily', e.target.value)}>
                            {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Size & Color</label>
                        <div className="input-group">
                            <input type="number" value={element.fontSize || 16} onChange={(e) => handleChange('fontSize', parseInt(e.target.value))} />
                            <input type="color" value={element.color || '#000000'} onChange={(e) => handleChange('color', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <label>Alignment</label>
                        <select value={element.align || 'left'} onChange={(e) => handleChange('align', e.target.value)}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                            <option value="justify">Justify</option>
                        </select>
                    </div>
                    <div className="form-row-checkbox">
                        <label><input type="checkbox" checked={!!element.bold} onChange={(e) => handleChange('bold', e.target.checked)} /> Bold</label>
                        <label><input type="checkbox" checked={!!element.italic} onChange={(e) => handleChange('italic', e.target.checked)} /> Italic</label>
                    </div>
                </div>
            )}

            {element.type === 'image' && (
                <div className="prop-section">
                    <h4>Image Styles</h4>
                    <div className="form-row">
                        <label>Object Fit</label>
                        <select value={element.objectFit || 'contain'} onChange={(e) => handleChange('objectFit', e.target.value)}>
                            <option value="contain">Contain</option>
                            <option value="cover">Cover</option>
                            <option value="fill">Fill</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Radius</label>
                        <input type="number" value={element.imgRadius || 0} onChange={(e) => handleChange('imgRadius', parseInt(e.target.value))} />
                    </div>
                </div>
            )}

            {element.type === 'shader' && (
                <div className="prop-section">
                    <h4>Shader Settings</h4>
                    <div className="form-row">
                        <label>Preset</label>
                        <select value={element.shaderPreset || 'plasma'} onChange={(e) => handleChange('shaderPreset', e.target.value)}>
                            {(typeof window !== 'undefined' && window.VPShader?.getPresetList ? window.VPShader.getPresetList() : [
                                { key: 'plasma', name: 'Plasma' },
                                { key: 'fire', name: 'Fire' },
                                { key: 'water', name: 'Water' },
                                { key: 'lightning', name: 'Lightning' },
                                { key: 'smoke', name: 'Smoke' },
                                { key: 'voidNoise', name: 'Void' },
                                { key: 'energy', name: 'Energy' },
                                { key: 'galaxy', name: 'Galaxy' }
                            ]).map(p => (
                                <option key={p.key} value={p.key}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="prop-section">
                <h4>Quick actions</h4>
                <p className="prop-hint">Use the <b>Logic</b> tab for full interaction setup.</p>
            </div>
        </div>
    )
}

export default PropertyPanel
