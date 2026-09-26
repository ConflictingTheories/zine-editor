/*
 * Component: LtPresetStrip
 * Preset buttons that each render a small live preview of the current image
 * with that preset applied, so the choice is visual rather than guesswork.
 */

import React, { useEffect, useRef } from 'react'
import { PRESETS, getPreset, createRecipe, DEFAULT_RECIPE } from '../../lib/lightTableEngine.js'
import { renderRecipe } from '../../lib/lightTableEngine.js'

const SIZE = 72

function LtPresetStrip({ image, recipe, activeId, onApply }) {
    return (
        <div className="lt-presets">
            {PRESETS.map(preset => (
                <button
                    key={preset.id}
                    className={`lt-preset${activeId === preset.id ? ' active' : ''}`}
                    onClick={() => onApply(preset.id)}
                    title={preset.label}
                >
                    <PresetThumb image={image} recipe={recipe} preset={preset} />
                    <span>{preset.label}</span>
                </button>
            ))}
        </div>
    )
}

function PresetThumb({ image, recipe, preset }) {
    const ref = useRef(null)

    useEffect(() => {
        const canvas = ref.current
        if (!canvas || !image?.naturalWidth) return
        const p = getPreset(preset.id)
        const preview = createRecipe()
        preview.params = { ...DEFAULT_RECIPE.params, ...(p.params || {}) }
        preview.fx = { ...DEFAULT_RECIPE.fx, ...(p.fx || {}) }
        preview.bw = Boolean(p.bw)
        // Keep the user's geometry so crop/rotate show through the presets.
        preview.geometry = recipe?.geometry || DEFAULT_RECIPE.geometry
        try {
            renderRecipe(image, canvas, preview, { maxWidth: SIZE, maxHeight: SIZE })
        } catch {
            // A single failed thumbnail must never break the strip.
        }
    }, [image, recipe, preset])

    return <canvas ref={ref} />
}

export default LtPresetStrip
