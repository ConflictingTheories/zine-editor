import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const VFX_OPTIONS = [
    { id: 'flash', name: 'Flash' },
    { id: 'lightning', name: 'Lightning' },
    { id: 'shake', name: 'Shake' },
    { id: 'pulse', name: 'Pulse' }
]

// No inline styles - using CSS classes
const normalizeColor = (color) => {
    if (!color) return '#000000'
    if (color.length === 4 && color.startsWith('#')) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    }
    return color
}

function PropertyPanel({ activeTab = 'props' }) {
    const { vpState, updateElement, updateVpState, playSFX } = useVP()
    const { selection, currentProject } = vpState

    if (!currentProject) {
        return <div className="empty-msg">Select an element or the canvas to edit</div>
    }

    if (activeTab === 'settings') {
        const updateProject = (key, val) => {
            updateVpState({ currentProject: { ...currentProject, [key]: val } })
        }
        return (
            <div className="prop-panel">
                <h4 className="prop-header">PROJECT CONFIG</h4>
                <div className="prop-section">
                    <div className="form-row">
                        <label className="form-label">Monetization</label>
                        <select className="form-input" value={currentProject.monetization_type || 'free'} onChange={(e) => updateProject('monetization_type', e.target.value)}>
                            <option value="free">Free</option>
                            <option value="crowdfund">Crowdfund</option>
                            <option value="one_time">One-time Purchase</option>
                            <option value="token">Sovereign Token Gate</option>
                            <option value="subscription">Subscription Only</option>
                        </select>
                    </div>
                    {currentProject.monetization_type === 'crowdfund' && (
                        <div className="form-row">
                            <label className="form-label">Funding Goal ($)</label>
                            <input type="number" className="form-input" value={currentProject.funding_goal || 0} onChange={(e) => updateProject('funding_goal', parseFloat(e.target.value))} />
                        </div>
                    )}
                    {(currentProject.monetization_type === 'one_time' || currentProject.monetization_type === 'token') && (
                        <div className="form-row">
                            <label className="form-label">Price (Credits)</label>
                            <input type="number" className="form-input" value={currentProject.token_price || 5} onChange={(e) => updateProject('token_price', parseInt(e.target.value))} />
                        </div>
                    )}
                    <div className="form-row-checkbox">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none' }}>
                            <input type="checkbox" checked={!!currentProject.is_premium} onChange={(e) => updateProject('is_premium', e.target.checked)} />
                            Mark as Premium
                        </label>
                    </div>
                </div>
            </div>
        )
    }

    const pageIdx = selection?.pageIdx ?? 0
    const page = currentProject.pages[pageIdx]
    const numPages = currentProject.pages.length

    // 1. PAGE PROPERTIES (Default view when page is selected)
    if (selection.type === 'page' || !selection.id) {
        const updatePage = (key, val) => {
            const project = JSON.parse(JSON.stringify(currentProject))
            project.pages[pageIdx][key] = val
            updateVpState({ currentProject: project })
        }

        if (activeTab === 'effects') {
            return (
                <div className="prop-panel">
                    <div className="prop-section">
                        <h4>PAGE EFFECTS</h4>
                        <div className="form-row">
                            <label className="form-label">Transition</label>
                            <select className="form-input" value={page.transition || 'none'} onChange={(e) => updatePage('transition', e.target.value)}>
                                <option value="none">None</option>
                                <option value="fade">Crossfade</option>
                                <option value="slide">Slide</option>
                                <option value="void">Void Alpha</option>
                                <option value="flip">Book Flip</option>
                            </select>
                        </div>
                        <div className="form-row">
                            <label className="form-label">Overlay Filter</label>
                            <input type="text" className="form-input" value={page.filter || ''} onChange={(e) => updatePage('filter', e.target.value)} placeholder="sepia(0.2) contrast(1.1)" />
                        </div>
                    </div>
                </div>
            )
        }

        if (activeTab === 'logic') {
            return (
                <div className="prop-panel">
                    <div className="prop-section">
                        <h4>PAGE LOGIC</h4>
                        <div className="form-row">
                            <label className="form-label">On Page Enter</label>
                            <select className="form-input" value={page.onEnter || ''} onChange={(e) => updatePage('onEnter', e.target.value)}>
                                <option value="">No Action</option>
                                <option value="vfx:flash">VFX: Flash</option>
                                <option value="vfx:shake">VFX: Shake</option>
                                <option value="sfx:play">Play BGM</option>
                            </select>
                        </div>
                        <div className="form-row-checkbox">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none' }}>
                                <input type="checkbox" checked={!!page.isLocked} onChange={(e) => updatePage('isLocked', e.target.checked)} />
                                Access Gate (Locked)
                            </label>
                        </div>
                        {page.isLocked && (
                            <div className="form-row">
                                <label className="form-label">Key/Password</label>
                                <input type="text" className="form-input" value={page.password || ''} onChange={(e) => updatePage('password', e.target.value)} placeholder="Secret ID" />
                            </div>
                        )}
                    </div>
                </div>
            )
        }


        return (
            <div className="prop-panel">
                <div className="prop-section">
                    <h4>PAGE TELEMETRY</h4>
                    <div className="form-row">
                        <label className="form-label">Background</label>
                        <input type="color" className="form-input" style={{ height: '34px', padding: '2px' }} value={normalizeColor(page.background || '#ffffff')} onChange={(e) => updatePage('background', e.target.value)} />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Texture Overlay</label>
                        <select className="form-input" value={page.texture || ''} onChange={(e) => updatePage('texture', e.target.value)}>
                            <option value="">None</option>
                            <option value="https://www.transparenttextures.com/patterns/old-mathematics.png">Old Paper</option>
                            <option value="https://www.transparenttextures.com/patterns/dark-matter.png">Dark Matter</option>
                            <option value="https://www.transparenttextures.com/patterns/graphy.png">Graph Paper</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label className="form-label">Atmospheric Audio (URL)</label>
                        <input type="text" className="form-input" value={page.bgm || ''} onChange={(e) => updatePage('bgm', e.target.value)} placeholder="https://..." />
                    </div>
                </div>
            </div>
        )
    }

    // 2. ELEMENT PROPERTIES
    const element = page.elements.find(e => e.id === selection.id)
    if (!element) return null

    const handleChange = (prop, val) => {
        updateElement(selection.pageIdx, element.id, { [prop]: val })
    }

    const fonts = ['SF Pro Display', 'Roboto Mono', 'Inter', 'EB Garamond', 'Playfair Display', 'Cinzel', 'Bebas Neue', 'Special Elite', 'Orbitron']

    // EFFECTS TAB
    if (activeTab === 'effects') {
        return (
            <div className="prop-panel">
                <h4>VISUAL OVERRIDES</h4>
                <div className="prop-section">
                    <div className="form-row">
                        <label className="form-label">Blend Mode</label>
                        <select className="form-input" value={element.blendMode || 'normal'} onChange={(e) => handleChange('blendMode', e.target.value)}>
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply</option>
                            <option value="screen">Screen</option>
                            <option value="overlay">Overlay</option>
                            <option value="difference">Difference</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label className="form-label">Filter Chain</label>
                        <input type="text" className="form-input" value={element.filter || ''} onChange={(e) => handleChange('filter', e.target.value)} placeholder="blur(2px) brightness(1.5)" />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Animation</label>
                        <select className="form-input" value={element.animation || 'none'} onChange={(e) => handleChange('animation', e.target.value)}>
                            <option value="none">None</option>
                            <option value="flash-in">Flash In</option>
                            <option value="pulse">Pulse</option>
                            <option value="float">Float</option>
                            <option value="glitch">Glitch</option>
                        </select>
                    </div>
                    {element.type === 'shader' && (
                        <div className="form-row">
                            <label className="form-label">Shader Preset</label>
                            <select className="form-input" value={element.shaderPreset || 'plasma'} onChange={(e) => handleChange('shaderPreset', e.target.value)}>
                                <option value="plasma">Plasma</option>
                                <option value="voidNoise">Void</option>
                                <option value="energy">Energy Cell</option>
                                <option value="scanlines">Scanlines</option>
                            </select>
                        </div>
                    )}
                </div>
                <div className="prop-section">
                    <h4>Appearance</h4>
                    <div className="form-row">
                        <label className="form-label">Shadow Depth</label>
                        <input type="text" className="form-input" value={element.shadow || ''} onChange={(e) => handleChange('shadow', e.target.value)} placeholder="0 4px 12px rgba(0,0,0,0.5)" />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Opacity</label>
                        <input type="range" className="form-input" min="0" max="1" step="0.01" value={element.opacity ?? 1} onChange={(e) => handleChange('opacity', parseFloat(e.target.value))} />
                    </div>
                </div>
            </div>
        )
    }

    // LOGIC TAB
    if (activeTab === 'logic') {
        const otherElements = page.elements.filter(e => e.id !== element.id && e.label)
        return (
            <div className="prop-panel">
                <h4>INTERACTION LOGIC</h4>
                <div className="prop-section">
                    <div className="form-row">
                        <label className="form-label">Event Trigger</label>
                        <select className="form-input" value={element.trigger || 'onClick'} onChange={(e) => handleChange('trigger', e.target.value)}>
                            <option value="onClick">On Click</option>
                            <option value="onEnter">On Viewport Enter</option>
                            <option value="onHover">On Hover</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <label className="form-label">Action</label>
                        <select className="form-input" value={element.action || 'none'} onChange={(e) => handleChange('action', e.target.value)}>
                            <option value="none">No Action</option>
                            <option value="goto">Jump to Page</option>
                            <option value="vfx">Trigger Screen VFX</option>
                            <option value="sfx">Trigger Sound FX</option>
                            <option value="toggle">Toggle Element Visibility</option>
                            <option value="setVar">Set Variable</option>
                        </select>
                    </div>
                    {element.action === 'goto' && (
                        <div className="form-row">
                            <label className="form-label">Target Page</label>
                            <input type="number" className="form-input" min="1" max={numPages} value={element.actionVal || 1} onChange={(e) => handleChange('actionVal', e.target.value)} />
                        </div>
                    )}
                    {element.action === 'toggle' && (
                        <div className="form-row">
                            <label className="form-label">Target Element</label>
                            <select className="form-input" value={element.actionVal || ''} onChange={(e) => handleChange('actionVal', e.target.value)}>
                                <option value="">Select Element...</option>
                                {otherElements.map(el => (
                                    <option key={el.id} value={el.label}>{el.label} ({el.type})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {element.action === 'sfx' && (
                        <div className="form-row">
                            <label className="form-label">Audio Source</label>
                            <input type="text" className="form-input" value={element.actionVal || ''} onChange={(e) => handleChange('actionVal', e.target.value)} placeholder="https://..." />
                        </div>
                    )}
                    {element.action === 'setVar' && (
                        <div className="form-row">
                            <label className="form-label">Variable & Value</label>
                            <div className="input-group">
                                <input type="text" className="form-input" value={element.varName || ''} onChange={(e) => handleChange('varName', e.target.value)} placeholder="VAR_KEY" />
                                <input type="text" className="form-input" value={element.varVal || ''} onChange={(e) => handleChange('varVal', e.target.value)} placeholder="VALUE" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="prop-section">
                    <h4>Visibility Rules</h4>
                    <div className="form-row">
                        <label className="form-label">Show If Variable</label>
                        <input type="text" className="form-input" value={element.condVar || ''} onChange={(e) => handleChange('condVar', e.target.value)} placeholder="VAR_KEY" />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Equals Value</label>
                        <input type="text" className="form-input" value={element.condVal || ''} onChange={(e) => handleChange('condVal', e.target.value)} placeholder="VALUE" />
                    </div>
                </div>

                <div className="prop-section">
                    <h4>Security & Privacy</h4>
                    <div className="form-row-checkbox">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none' }}>
                            <input type="checkbox" checked={!!element.isSealed} onChange={(e) => handleChange('isSealed', e.target.checked)} />
                            Seal with 4D Token (SCEE)
                        </label>
                    </div>
                    {element.isSealed && (
                        <div className="form-row">
                            <label className="form-label">Content Key</label>
                            <input type="text" className="form-input" value={element.sealKey || ''} onChange={(e) => handleChange('sealKey', e.target.value)} placeholder="Passphrase" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // PROPS TAB (Default)
    return (
        <div className="property-panel">
            <div className="prop-section">
                <h4>Layout</h4>
                <div className="form-row">
                    <label className="form-label">Identity Label</label>
                    <input type="text" className="form-input" value={element.label || ''} onChange={(e) => handleChange('label', e.target.value)} placeholder="Element ID" />
                </div>
                <div className="form-row">
                    <label className="form-label">Position (X, Y)</label>
                    <div className="input-group">
                        <input type="number" className="form-input" value={Math.round(element.x)} onChange={(e) => handleChange('x', parseInt(e.target.value))} />
                        <input type="number" className="form-input" value={Math.round(element.y)} onChange={(e) => handleChange('y', parseInt(e.target.value))} />
                    </div>
                </div>
                <div className="form-row">
                    <label className="form-label">Dimensions (W, H)</label>
                    <div className="input-group">
                        <input type="number" className="form-input" value={Math.round(element.width)} onChange={(e) => handleChange('width', parseInt(e.target.value))} />
                        <input type="number" className="form-input" value={Math.round(element.height)} onChange={(e) => handleChange('height', parseInt(e.target.value))} />
                    </div>
                </div>
                <div className="form-row">
                    <label className="form-label">Rotation (deg)</label>
                    <input type="number" className="form-input" value={element.rotation || 0} onChange={(e) => handleChange('rotation', parseInt(e.target.value))} />
                </div>
            </div>

            {element.type === 'text' && (
                <div className="prop-section">
                    <h4>Typography</h4>
                    <div className="form-row">
                        <label className="form-label">Content</label>
                        <textarea
                            className="form-input"
                            style={{ minHeight: '80px', resize: 'vertical' }}
                            value={element.content || ''}
                            onChange={(e) => handleChange('content', e.target.value)}
                        />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Font</label>
                        <select className="form-input" value={element.fontFamily || 'Inter'} onChange={(e) => handleChange('fontFamily', e.target.value)}>
                            {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <div className="form-row" style={{ flex: 1 }}>
                            <label className="form-label">Size</label>
                            <input type="number" className="form-input" value={element.fontSize || 16} onChange={(e) => handleChange('fontSize', parseInt(e.target.value))} />
                        </div>
                        <div className="form-row" style={{ flex: 1 }}>
                            <label className="form-label">Color</label>
                            <input type="color" className="form-input" style={{ height: '34px', padding: '2px' }} value={normalizeColor(element.color || '#000000')} onChange={(e) => handleChange('color', e.target.value)} />
                        </div>
                    </div>
                </div>
            )}

            {element.type === 'image' && (
                <div className="prop-section">
                    <h4>Asset Settings</h4>
                    <div className="form-row">
                        <label className="form-label">Source URL</label>
                        <input type="text" className="form-input" value={element.src || ''} onChange={(e) => handleChange('src', e.target.value)} />
                    </div>
                </div>
            )}

            {element.type === 'widget' && (
                <div className="prop-section">
                    <h4>Widget Settings</h4>
                    <div className="form-row">
                        <label className="form-label">Type</label>
                        <select className="form-input" value={element.widgetType || 'rss-feed'} onChange={(e) => handleChange('widgetType', e.target.value)}>
                            <option value="rss-feed">RSS Feed</option>
                            <option value="countdown">Countdown</option>
                            <option value="ticker">Ticker</option>
                        </select>
                    </div>
                    {element.widgetType === 'rss-feed' && (
                        <div className="form-row">
                            <label className="form-label">RSS URL</label>
                            <input type="text" className="form-input" value={element.rssUrl || ''} onChange={(e) => handleChange('rssUrl', e.target.value)} placeholder="https://..." />
                        </div>
                    )}
                    {element.widgetType === 'countdown' && (
                        <div className="form-row">
                            <label className="form-label">Target Date</label>
                            <input type="datetime-local" className="form-input" value={element.targetDate || ''} onChange={(e) => handleChange('targetDate', e.target.value)} />
                        </div>
                    )}
                    {element.widgetType === 'ticker' && (
                        <div className="input-group-stack">
                            <div className="form-row">
                                <label className="form-label">Ticker Text</label>
                                <input type="text" className="form-input" value={element.tickerText || ''} onChange={(e) => handleChange('tickerText', e.target.value)} />
                            </div>
                            <div className="form-row">
                                <label className="form-label">Speed</label>
                                <input type="range" className="form-input" min="1" max="50" value={element.tickerSpeed || 10} onChange={(e) => handleChange('tickerSpeed', parseInt(e.target.value))} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default PropertyPanel
