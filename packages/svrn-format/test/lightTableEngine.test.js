/*
 * Tests: lightTableEngine
 *
 * The curve pipeline is the part of the develop engine most likely to rot: the
 * GPU preview, the CPU export and the on-screen curve all evaluate the same
 * recipe by different routes, and any disagreement means a photographer grades
 * against a lie. These tests pin the three together.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    CURVE_LUT_SIZE,
    DEFAULT_RECIPE,
    bakeCurveLut,
    channelCurve,
    createRecipe,
    curveLutKey,
    curveValue,
    curvesAreIdentity,
    serialiseRecipe,
    normaliseRecipe
} from '../../../src/lib/lightTableEngine.js'

const sampleAt = (data, v) => {
    const i = Math.round(v * (CURVE_LUT_SIZE - 1))
    return data[i * 4] / 255
}

test('curveValue reproduces a straight line exactly', () => {
    // The regression that motivated the monotone cubic interpolator: the
    // default recipe is five collinear points, and the old smoothstep evaluator
    // bowed off the diagonal between them — so every photograph was being
    // graded with a distortion nobody asked for.
    const line = createRecipe().curves.rgb
    for (let i = 0; i <= 1000; i++) {
        const v = i / 1000
        assert.ok(Math.abs(curveValue(v, line) - v) < 1e-9, `curveValue(${v}) drifted from the identity`)
    }
    assert.equal(curvesAreIdentity(createRecipe()), true)
})

test('curveValue passes through every control point', () => {
    const s = [[0, 0], [0.2, 0.08], [0.5, 0.55], [0.8, 0.9], [1, 1]]
    for (const [x, y] of s) {
        assert.ok(Math.abs(curveValue(x, s) - y) < 1e-9, `curve missed its point at ${x}`)
    }
})

test('curveValue stays monotone and never overshoots', () => {
    // A curve that folds back on itself inverts tonal order, which shows up as
    // clipped bands rather than as an obviously wrong curve.
    const s = [[0, 0], [0.25, 0.05], [0.5, 0.5], [0.75, 0.95], [1, 1]]
    let previous = -Infinity
    for (let i = 0; i <= 1000; i++) {
        const y = curveValue(i / 1000, s)
        assert.ok(y >= previous, 'curve reversed tonal order')
        assert.ok(y >= -1e-9 && y <= 1 + 1e-9, 'curve overshot its control point range')
        previous = y
    }
})

test('bakeCurveLut agrees with curveValue across the whole range', () => {
    // The curve the GPU samples vs the curve the CPU computes. Before the baked
    // LUT these silently diverged past the fourth control point.
    const curve = [[0, 0], [0.2, 0.1], [0.4, 0.45], [0.6, 0.55], [0.8, 0.9], [1, 1]]
    const { data, size } = bakeCurveLut({ curves: { rgb: curve } })
    assert.equal(size, CURVE_LUT_SIZE)

    let worst = 0
    for (let i = 0; i < size; i++) {
        const v = i / (size - 1)
        worst = Math.max(worst, Math.abs(data[i * 4] / 255 - curveValue(v, curve)))
    }
    // One 8-bit quantisation step is 1/255; anything more means the bake is
    // not sampling the same function the CPU uses.
    assert.ok(worst <= 1 / 255 + 1e-9, `GPU/CPU curve drift ${worst} exceeds one quantisation step`)
})

test('bakeCurveLut honours every control point, past the fourth', () => {
    // A curve that only differs in its fifth point is the exact shape the old
    // 4-segment uniform packing could not represent.
    const curve = [[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [0.9, 0.2], [1, 1]]
    const { data } = bakeCurveLut({ curves: { rgb: curve } })
    assert.ok(Math.abs(sampleAt(data, 0.9) - 0.2) <= 1 / 255)
})

test('bakeCurveLut packs channels into their own byte and falls back to the master', () => {
    const recipe = {
        curves: {
            rgb: [[0, 0], [1, 1]],
            r: [[0, 0], [0.5, 1], [1, 1]]
        }
    }
    const { data } = bakeCurveLut(recipe)
    const mid = Math.round(0.5 * (CURVE_LUT_SIZE - 1)) * 4
    // Red is lifted to 1 at the midpoint.
    assert.ok(Math.abs(data[mid] / 255 - 1) <= 1 / 255)
    // Green and blue have no override, so they follow the identity master.
    assert.ok(Math.abs(data[mid + 1] / 255 - 0.5) <= 1 / 255)
    assert.ok(Math.abs(data[mid + 2] / 255 - 0.5) <= 1 / 255)
})

test('bakeCurveLut is a no-op for an identity curve', () => {
    const { data } = bakeCurveLut(createRecipe())
    for (let i = 0; i < CURVE_LUT_SIZE; i++) {
        const v = i / (CURVE_LUT_SIZE - 1)
        assert.ok(Math.abs(data[i * 4] / 255 - v) <= 1 / 255, `identity sample at ${v} drifted`)
    }
})

test('curvesAreIdentity treats the shipped default as identity', () => {
    // The default recipe carries an explicit 5-point straight line. If this
    // returned false, every untouched photograph would pay for a texture
    // fetch per pixel for no reason.
    assert.equal(curvesAreIdentity(createRecipe()), true)
    assert.equal(curvesAreIdentity(DEFAULT_RECIPE), true)
    assert.equal(curvesAreIdentity(null), true)
})

test('curvesAreIdentity detects a master-curve edit', () => {
    const recipe = createRecipe()
    recipe.curves.rgb = [[0, 0], [0.5, 0.7], [1, 1]]
    assert.equal(curvesAreIdentity(recipe), false)
})

test('curvesAreIdentity detects a per-channel edit that leaves the master alone', () => {
    const recipe = createRecipe()
    recipe.curves.b = [[0, 0], [0.5, 0.3], [1, 1]]
    assert.equal(curvesAreIdentity(recipe), false)
})

test('curveLutKey is stable while nothing moves and changes when a point does', () => {
    const a = createRecipe()
    const b = createRecipe()
    assert.equal(curveLutKey(a), curveLutKey(b))

    b.curves.rgb = [[0, 0], [0.25, 0.25], [0.5, 0.6], [0.75, 0.75], [1, 1]]
    assert.notEqual(curveLutKey(b), curveLutKey(a))
})

test('channelCurve falls back to the master curve for an unedited channel', () => {
    assert.deepEqual(channelCurve(createRecipe(), 'r'), channelCurve(createRecipe(), 'rgb'))
})

test('channelCurve prefers a channel override when present', () => {
    const recipe = createRecipe()
    recipe.curves.g = [[0, 0], [1, 0.5]]
    assert.deepEqual(channelCurve(recipe, 'g'), [[0, 0], [1, 0.5]])
})

test('channelCurve accepts the legacy single-array form', () => {
    const points = [[0, 0], [1, 1]]
    assert.equal(channelCurve({ curves: points }, 'rgb'), points)
})

test('a recipe survives serialise and normalise with its curve intact', () => {
    const recipe = createRecipe()
    recipe.curves.rgb = [[0, 0], [0.3, 0.2], [0.6, 0.8], [1, 1]]
    recipe.curves.r = [[0, 0], [0.5, 0.9], [1, 1]]

    const restored = normaliseRecipe(JSON.parse(JSON.stringify(serialiseRecipe(recipe))))
    assert.deepEqual(restored.curves.rgb, recipe.curves.rgb)
    assert.deepEqual(restored.curves.r, recipe.curves.r)
    assert.equal(curvesAreIdentity(restored), false)
})