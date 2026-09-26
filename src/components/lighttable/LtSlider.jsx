/*
 * Component: LtSlider
 * Range control with a centre detent for bipolar parameters, a numeric
 * readout, and per-slider reset on double click.
 */

import React, { useCallback, useRef } from 'react'

/**
 * @param {string} label      Display name
 * @param {number} value      Current value
 * @param {function} onChange (nextValue) => void
 * @param {object} spec       { min, max, step, bipolar, defaultAtZero, format }
 */
function LtSlider({ label, value, onChange, spec }) {
    const dragging = useRef(false)
    const { min, max, step, bipolar } = spec

    // Double clicking the label returns the slider to its neutral value.
    const reset = useCallback(() => {
        if (spec.defaultAtZero === true) return onChange(0)
        if (bipolar) return onChange(0)
        // Non-bipolar params are all "more is more" — go to a subtle default.
        const neutral = spec.neutral ?? (min + (max - min) * 0.5)
        onChange(Number(neutral.toFixed(4)))
    }, [onChange, spec, bipolar, min, max])

    const format = spec.format || (v => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)))

    // Releasing outside the window must still commit the final value.
    const stop = useCallback(() => { dragging.current = false }, [])

    return (
        <div className={`lt-slider${bipolar ? ' bipolar' : ' mod'}`}>
            <div className="lt-slider-head">
                <label onDoubleClick={reset} title="Double-click to reset">{label}</label>
                <output>{format(Number(value))}</output>
            </div>
            <div className="lt-track">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    aria-label={label}
                    onPointerDown={() => { dragging.current = true }}
                    onPointerUp={stop}
                    onPointerCancel={stop}
                    onBlur={stop}
                    onChange={e => onChange(Number(e.target.value))}
                />
            </div>
        </div>
    )
}

export default LtSlider
