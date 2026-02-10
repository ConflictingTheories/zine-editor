import React from 'react'
import { useVP } from '../context/VPContext.jsx'

function PropertyPanel() {
    const { vpState, updateElement } = useVP()
    const { selection, currentProject } = vpState

    if (selection.type !== 'element' || !currentProject) {
        return <p className="empty-msg" style={{ padding: '20px', fontStyle: 'italic', color: 'var(--vp-text-dim)' }}>Select an element to edit</p>
    }

    const element = currentProject.pages[selection.pageIdx].elements.find(e => e.id === selection.id)
    if (!element) return null

    const handleChange = (prop, val) => {
        updateElement(selection.pageIdx, element.id, { [prop]: val })
    }

    const fonts = ['Crimson Text', 'Cinzel', 'Cinzel Decorative', 'Bebas Neue', 'Special Elite', 'Bangers', 'Playfair Display', 'EB Garamond', 'Orbitron', 'Roboto Mono', 'Montserrat', 'Assistant', 'Comic Neue', 'Courier Prime', 'MedievalSharp', 'Inter']

    return (
        <div className="property-panel">
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
                            <option value="plasma">Plasma</option>
                            <option value="starfield">Starfield</option>
                            <option value="fire">Fire</option>
                            <option value="water">Water</option>
                            <option value="glitch">Glitch</option>
                            <option value="matrix">Matrix</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="prop-section">
                <h4>Interactions</h4>
                <div className="form-row">
                    <label>Action</label>
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
                {element.action && (
                    <div className="form-row">
                        <label>Value</label>
                        <input
                            type="text"
                            value={element.actionVal || ''}
                            placeholder="e.g. Page # or URL"
                            onChange={(e) => handleChange('actionVal', e.target.value)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default PropertyPanel
