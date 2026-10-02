/*
 * Component: LtSlider
 * Range control with a centre detent for bipolar parameters, a numeric
 * readout, a fill track that reads from the centre (bipolar) or the left, and
 * reset on double click of either the label or the track.
 */

import React, { useCallback, useRef } from 'react'

/**
 * @param {string} label      Display name
 * @param {number} value      Current value
 * @param {function} onChange (nextValue) => void
 * @param {object} spec       { min, max, step, bipolar, defaultAtZero, format }
 */
function LtSlider({ label, value, onChange, onInteraction, spec }) {
    const dragging = useRef(false)
    const { min, max, step, bipolar } = spec

    // Bipolar params rest at 0; for the rest the caller supplies `neutral`,
    // because "rest" is not universal — contrast and saturation rest at 1.
    const reset = useCallback(() => {
        if (bipolar || spec.defaultAtZero === true) return onChange(0)
        const fallback = min + (max - min) * 0.5
        const neutral = spec.neutral ?? fallback
        onChange(Number(neutral.toFixed(4)))
    }, [onChange, spec, bipolar, min, max])

    const format = spec.format || (v => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)))

    // Releasing outside the window must still commit the final value.
    const stop = useCallback(() => {
        if (!dragging.current) return
        dragging.current = false
        onInteraction?.(false)
    }, [onInteraction])
    const start = useCallback(() => {
        if (dragging.current) return
        dragging.current = true
        onInteraction?.(true)
    }, [onInteraction])

    // The fill is an overlay behind the native range input rather than a styled
    // ::-webkit-slider-runnable-track: that pseudo-element has no portable width
    // and drifts across browsers inside a themed scrollbar box.
    const pct = ((Number(value) - min) / (max - min)) * 100
    const origin = bipolar ? 50 : 0
    const fillLeft = Math.min(origin, pct)
    const fillWidth = Math.abs(pct - origin)

    return (
        <div className={`lt-slider${bipolar ? ' bipolar' : ' mod'}`}>
            <div className="lt-slider-head">
                <label onDoubleClick={reset} title="Double-click to reset">{label}</label>
                <output>{format(Number(value))}</output>
            </div>
            <div className="lt-track" onDoubleClick={reset} title="Double-click to reset">
                <span
                    className="lt-track-fill"
                    aria-hidden="true"
                    style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    aria-label={label}
                    onPointerDown={start}
                    onPointerUp={stop}
                    onPointerCancel={stop}
                    onBlur={stop}
                    onKeyDown={start}
                    onKeyUp={stop}
                    onChange={e => onChange(Number(e.target.value))}
                />
            </div>
        </div>
    )
}

export default LtSlider
