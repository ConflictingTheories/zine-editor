// CPU reference pipeline used by Light Table previews, exports, and print-safe fallbacks.
// Keeping the recipe data-driven means every layer survives placement in a spread.
const clamp = value => Math.max(0, Math.min(1, value))
const luma = (r, g, b) => r * .2126 + g * .7152 + b * .0722
const channelWeight = (channel, r, g, b) => {
    const y = luma(r, g, b), max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (channel === 'red' || channel === 'r') return r
    if (channel === 'green' || channel === 'g') return g
    if (channel === 'blue' || channel === 'b') return b
    if (channel === 'luma') return y
    if (channel === 'shadows') return 1 - y
    if (channel === 'highlights') return y
    if (channel === 'sat') return max - min
    if (['red', 'orange', 'yellow', 'aqua', 'purple', 'magenta'].includes(channel)) {
        const hue = (() => { const d = max - min; if (!d) return 0; if (max === r) return ((g - b) / d + (g < b ? 6 : 0)) * 60; if (max === g) return ((b - r) / d + 2) * 60; return ((r - g) / d + 4) * 60 })()
        const centers = { red: 0, orange: 30, yellow: 60, aqua: 180, purple: 280, magenta: 320 }, distance = Math.abs(hue - centers[channel]); return Math.max(0, 1 - Math.min(distance, 360 - distance) / 60)
    }
    return 1
}

const maskWeight = (value, mask = {}) => {
    const low = Number(mask.low ?? 0), high = Number(mask.high ?? 1), feather = Math.max(.001, Number(mask.feather ?? .1))
    const edge = Math.min(clamp((value - low) / feather), clamp((high - value) / feather), 1)
    const result = value >= low && value <= high ? edge : 0
    return (mask.invert ? 1 - result : result) * Number(mask.weight ?? 1)
}

export function applyLut(rgb, lut) {
    if (!lut?.size || !lut?.data?.length) return rgb
    const size = lut.size - 1
    const index = (r, g, b) => ((b * lut.size + g) * lut.size + r) * 3
    const x = rgb.map(value => clamp(value) * size)
    const lo = x.map(Math.floor), hi = x.map(value => Math.min(size, Math.ceil(value))), f = x.map((value, i) => value - lo[i])
    const sample = (r, g, b) => { const i = index(r, g, b); return lut.data.slice(i, i + 3).map(clamp) }
    const out = [0, 1, 2].map(c => {
        const c000 = sample(lo[0], lo[1], lo[2])[c], c100 = sample(hi[0], lo[1], lo[2])[c]
        const c010 = sample(lo[0], hi[1], lo[2])[c], c110 = sample(hi[0], hi[1], lo[2])[c]
        const c001 = sample(lo[0], lo[1], hi[2])[c], c101 = sample(hi[0], lo[1], hi[2])[c]
        const c011 = sample(lo[0], hi[1], hi[2])[c], c111 = sample(hi[0], hi[1], hi[2])[c]
        const x0 = c000 + (c100 - c000) * f[0], x1 = c010 + (c110 - c010) * f[0], x2 = c001 + (c101 - c001) * f[0], x3 = c011 + (c111 - c011) * f[0]
        return x0 + (x1 - x0) * f[1] + (x2 + (x3 - x2) * f[1] - x2) * f[2]
    })
    return out
}

function effect(rgb, id, strength, x, y, params = {}) {
    const amount = Number(params.p0 ?? strength), radius = Number(params.p1 ?? 1)
    if (id === 'grain') { const n = (Math.sin(x * (params.p1 || 400) + y * 78.233) * 43758.5453) % 1; return rgb.map(v => v + (n - .5) * amount * strength) }
    if (id === 'vignette') { const d = Math.hypot(x - .5, y - .5) * 1.414; return rgb.map(v => v * (1 - Math.max(0, Math.min(1, (d - (1 - radius) * .5) / Math.max(.05, radius))) * amount * strength)) }
    if (id === 'posterize') { const levels = Math.max(2, Number(params.p0 || 8)); return rgb.map(v => v * (1 - strength) + Math.floor(v * levels) / levels * strength) }
    if (id === 'chroma') return [rgb[0] + .06 * amount * strength, rgb[1], rgb[2] - .06 * amount * strength]
    if (id === 'tint') { const shift = amount * strength; return [rgb[0] + shift * .2, rgb[1] + shift * .05, rgb[2] - shift * .15] }
    if (id === 'sharpen') return rgb.map(v => v + (v - luma(...rgb)) * amount * .15 * strength)
    if (id === 'halation') return rgb.map((v, i) => v + Math.max(0, luma(...rgb) - (params.p0 ?? .7)) * (i === 0 ? 1 : i === 1 ? .55 : .4) * (params.p1 ?? .6) * strength)
    if (id === 'glow' || id === 'bloom') return rgb.map(v => v + Math.max(0, v - .5) * amount * strength * .3)
    if (id === 'displace' || id === 'water') { const wave = Math.sin((x + y) * Number(params.p1 || 4) * 12) * amount * strength; return rgb.map((v, i) => v + wave * (i === 1 ? .5 : i === 2 ? -.3 : 0)) }
    return rgb
}

const curveValue = (value, points = []) => {
    if (!points.length) return value
    const sorted = points.slice().sort((a, b) => a[0] - b[0])
    for (let i = 1; i < sorted.length; i++) if (value <= sorted[i][0]) {
        const [x0, y0] = sorted[i - 1], [x1, y1] = sorted[i], t = (value - x0) / Math.max(.001, x1 - x0)
        return y0 + (y1 - y0) * t
    }
    return sorted[sorted.length - 1][1]
}

export function renderLightTable(source, target, recipe) {
    if (!source?.naturalWidth || !target) return
    const scale = Math.min(1, 1400 / source.naturalWidth, 900 / source.naturalHeight)
    target.width = Math.round(source.naturalWidth * scale); target.height = Math.round(source.naturalHeight * scale)
    const ctx = target.getContext('2d', { willReadFrequently: true })
    if (!ctx) return target
    ctx.drawImage(source, 0, 0, target.width, target.height)
    const pixels = ctx.getImageData(0, 0, target.width, target.height), data = pixels.data, params = recipe?.params || {}
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4 % target.width) / target.width, y = Math.floor(i / 4 / target.width) / target.height
        let rgb = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]
        const exposure = Math.pow(2, Number(params.exposure || 0)), contrast = Number(params.contrast ?? 1), saturation = Number(params.saturation ?? 1), lum = luma(...rgb)
        rgb = rgb.map(v => ((v * exposure - .5) * contrast + .5)); rgb = rgb.map(v => lum + (v - lum) * saturation)
        const curves = recipe?.curves
        rgb = rgb.map((v, c) => curveValue(clamp(curves?.[c === 0 ? 'r' : c === 1 ? 'g' : c === 2 ? 'b' : 'rgb'] || curves), curves?.rgb || curves))
        const luts = recipe?.luts || (recipe?.lut ? [recipe.lut] : [])
        luts.forEach(entry => { const lutRgb = applyLut(rgb, entry); const strength = Number(entry.strength ?? 1); rgb = rgb.map((v, c) => v + (lutRgb[c] - v) * strength) })
        const layers = recipe?.effects || []
        layers.filter(layer => layer.enabled !== false).slice(0, 8).forEach(layer => { const weight = channelWeight(layer.channel || 'all', ...rgb) * maskWeight(luma(...rgb), layer.mask); const next = effect(rgb, layer.id || layer.typeId, Number(layer.strength ?? 1), x, y, layer.params || {}); rgb = rgb.map((v, c) => v + (next[c] - v) * weight) })
        data[i] = clamp(rgb[0]) * 255; data[i + 1] = clamp(rgb[1]) * 255; data[i + 2] = clamp(rgb[2]) * 255
    }
    ctx.putImageData(pixels, 0, 0); return target
}
