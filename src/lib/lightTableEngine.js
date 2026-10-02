/**
 * Light Table Engine
 *
 * Single source of truth for the develop recipe used by the GPU preview,
 * the CPU export renderer, and the saved-asset pipeline. Everything the
 * UI can change is declared here so the editor, the export path and the
 * placement pipeline can never drift apart.
 */

// ── Recipe schema ────────────────────────────────────────────────────────────
export const GRADE_DEFAULTS = {
    exposure: 0,
    contrast: 1,
    saturation: 1,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    clarity: 0,
    dehaze: 0,
    vibrance: 0,
    fade: 0,
    sharpen: 0,
    denoise: 0
}

export const FX_DEFAULTS = {
    grain: 0,
    vignette: 0,
    bloom: 0,
    halation: 0,
    chroma: 0,
    posterize: 0,
    splitTone: 0,
    fade: 0
}

export const DEFAULT_RECIPE = {
    version: 2,
    params: { ...GRADE_DEFAULTS },
    fx: { ...FX_DEFAULTS },
    geometry: { zoom: 1, rotate: 0, flipH: false, flipV: false, crop: null },
    curves: { rgb: [[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1]], r: null, g: null, b: null },
    lut: null,
    lutStrength: 1,
    bw: false
}

export const createRecipe = () => JSON.parse(JSON.stringify(DEFAULT_RECIPE))

// ── Control definitions (drive the inspector UI) ─────────────────────────────
// [key, label, min, max, step, defaultAtZero, bipolar]
const pct = 0.05
export const CONTROL_GROUPS = [
    {
        id: 'tone',
        label: 'Tone',
        controls: [
            ['exposure', 'Exposure', -3, 3, 0.05, true],
            ['contrast', 'Contrast', 0, 2.5, pct, false],
            ['highlights', 'Highlights', -1, 1, pct, true],
            ['shadows', 'Shadows', -1, 1, pct, true],
            ['whites', 'Whites', -1, 1, pct, true],
            ['blacks', 'Blacks', -1, 1, pct, true]
        ]
    },
    {
        // Tone is the light: where the image sits and how far apart its
        // extremes are. Every one of these is bipolar except contrast, which is
        // a ratio around 1 — so the slider shows a centre detent for five of six.
        id: 'presence',
        label: 'Presence',
        controls: [
            ['clarity', 'Clarity', -1, 1, pct, true],
            ['dehaze', 'Dehaze', -1, 1, pct, true],
            ['vibrance', 'Vibrance', -1, 1, pct, true],
            ['saturation', 'Saturation', 0, 2.5, pct, false]
        ]
    },
    {
        id: 'colour',
        label: 'Colour',
        controls: [
            ['temperature', 'Temp', -1, 1, pct, true],
            ['tint', 'Tint', -1, 1, pct, true]
        ]
    },
    {
        // Detail is texture, not tone. The renderer exposes one sharpen and one
        // denoise control, so this stays honest about what actually moves the
        // pixels rather than adding sub-controls that would silently do nothing.
        id: 'detail',
        label: 'Detail',
        controls: [
            ['sharpen', 'Sharpening', 0, 1, pct, false],
            ['denoise', 'Noise Reduction', 0, 1, pct, false],
            ['fade', 'Fade', 0, 1, pct, false]
        ]
    },
    {
        id: 'effects',
        label: 'Effects',
        controls: [
            ['grain', 'Grain', 0, 1, pct, false],
            ['vignette', 'Vignette', 0, 1, pct, false],
            ['bloom', 'Bloom', 0, 1, pct, false],
            ['halation', 'Halation', 0, 1, pct, false],
            ['chroma', 'Chroma', 0, 1, pct, false],
            ['posterize', 'Posterize', 0, 1, pct, false],
            ['splitTone', 'Split Tone', 0, 1, pct, false]
        ]
    }
]

export const ALL_CONTROLS = CONTROL_GROUPS.flatMap(g => g.controls)

// ── Presets ──────────────────────────────────────────────────────────────────
export const PRESETS = [
    { id: 'none', label: 'Original', params: {}, fx: {}, bw: false },
    { id: 'clean', label: 'Clean', params: { contrast: 1.05, clarity: 0.15, vibrance: 0.1 }, fx: {} },
    { id: 'fogwater', label: 'Fog on Water', params: { temperature: -0.08, fade: 0.2 }, fx: { bloom: 0.55, grain: 0.28, vignette: 0.38 } },
    { id: 'edgemist', label: 'Edge Mist', params: { shadows: 0.15 }, fx: { bloom: 0.72, vignette: 0.62, grain: 0.18 } },
    { id: 'heatwave', label: 'Heat Haze', params: { temperature: 0.18, chroma: 0.1 }, fx: { chroma: 0.42, grain: 0.2 } },
    { id: 'colbloom', label: 'Colour Bloom', params: { saturation: 1.35, vibrance: 0.3 }, fx: { bloom: 0.88, grain: 0.12 } },
    { id: 'polaroid', label: 'Polaroid', params: { contrast: 1.12, temperature: 0.07, fade: 0.25 }, fx: { vignette: 0.28, grain: 0.22, halation: 0.25 } },
    { id: 'bleachby', label: 'Bleach Bypass', params: { contrast: 1.35, saturation: 0.62, clarity: 0.25 }, fx: { vignette: 0.32, grain: 0.15 } },
    { id: 'noir', label: 'Film Noir', params: { contrast: 1.28, clarity: 0.3 }, fx: { vignette: 0.52, grain: 0.3 }, bw: true },
    { id: 'goldenhour', label: 'Golden Hour', params: { temperature: 0.3, saturation: 1.15, vibrance: 0.25, highlights: -0.1 }, fx: { bloom: 0.3, halation: 0.35 } },
    { id: 'coldsteel', label: 'Cold Steel', params: { temperature: -0.32, tint: 0.1, saturation: 0.8, contrast: 1.15 }, fx: { vignette: 0.25, grain: 0.2 } },
    { id: 'cws', label: 'Cyan / Magenta', params: { tint: -0.3, temperature: -0.1, vibrance: 0.2 }, fx: { splitTone: 0.5 } },
    { id: 'dream', label: 'Dream Soft', params: { fade: 0.5, saturation: 0.85, contrast: 0.9 }, fx: { bloom: 0.45, grain: 0.12 } }
]

export const getPreset = id => PRESETS.find(p => p.id === id) || PRESETS[0]

// ── Shared math ──────────────────────────────────────────────────────────────
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
export const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0 || 1e-6))
    return t * t * (3 - 2 * t)
}
export const luma = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722

/**
 * Evaluate a tone curve with monotone cubic (Fritsch–Carlson) interpolation.
 *
 * The previous evaluator used a smoothstep between each pair of control points.
 * Two things were wrong with that:
 *
 *  1. Smoothstep is not a spline — it bows away from the straight line between
 *     any two control points, including collinear ones. The shipped default
 *     curve is five points on the diagonal, so *every* untouched photograph was
 *     being given an S-shaped distortion it never asked for.
 *  2. Per-segment easing lets a curve fold back on itself, which can invert
 *     tonal order and produce clipped bands.
 *
 * Monotone cubic passes exactly through every control point, reproduces a
 * straight line exactly when the points are collinear, and refuses to overshoot
 * outside the neighbouring values. A straight line in means a straight line out
 * — which is the property the whole non-destructive pipeline depends on.
 */
export function curveValue(value, points) {
    if (!points || points.length < 2) return value
    const sorted = points.slice().sort((a, b) => a[0] - b[0])
    if (value <= sorted[0][0]) return sorted[0][1]
    const last = sorted[sorted.length - 1]
    if (value >= last[0]) return last[1]

    const n = sorted.length
    const slopeAt = (i) => {
        if (i === 0) return (sorted[1][1] - sorted[0][1]) / (sorted[1][0] - sorted[0][0])
        if (i === n - 1) return (sorted[n - 1][1] - sorted[n - 2][1]) / (sorted[n - 1][0] - sorted[n - 2][0])
        return (sorted[i + 1][1] - sorted[i - 1][1]) / (sorted[i + 1][0] - sorted[i - 1][0])
    }

    // Segment index: the last segment whose x start is <= value.
    let i = 0
    while (i < n - 2 && value >= sorted[i + 1][0]) i++

    const [x0, y0] = sorted[i]
    const [x1, y1] = sorted[i + 1]
    const h = x1 - x0
    if (h <= 0) return y1

    const d0 = slopeAt(i)
    const d1 = slopeAt(i + 1)
    const slope = (y1 - y0) / h

    // Fritsch–Carlson limiter: clip tangents into the monotone circle so the
    // interpolant can never overshoot and reverse the tonal order.
    const limit = (d, s) => (s === 0 ? 0 : Math.max(-3 * s, Math.min(3 * s, d)))
    const m0 = limit(d0, slope)
    const m1 = limit(d1, slope)

    const t = (value - x0) / h
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    return clamp(h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1)
}

// Effective curve for a channel: falls back to the shared rgb curve.
export function channelCurve(recipe, channel) {
    const curves = recipe?.curves
    if (!curves) return null
    if (Array.isArray(curves)) return curves
    return curves[channel] || curves.rgb || null
}

// ── Curve baking ─────────────────────────────────────────────────────────────
/**
 * Resolution of a baked curve. 256 entries is the point at which the texture
 * read becomes indistinguishable from the analytic curve: the steepest useful
 * control slope is roughly 8×, so consecutive samples differ by ~0.03 and the
 * linear filter hides the rest.
 */
export const CURVE_LUT_SIZE = 256

/**
 * Bake a channel's curve into a flat RGBA byte table for upload as a 1D
 * texture.
 *
 * Why this exists: the shader used to carry a fixed 4-segment spline in two
 * `vec4` uniforms, which silently discarded every control point past the
 * fourth — the shipped default has five, so the GPU preview and the exported
 * JPEG disagreed for every photograph with an edited curve. Baking means the
 * GPU evaluates exactly the samples `curveValue()` would return, so what a
 * photographer sees on the stage is what lands on the spread.
 *
 * Channels R, G and B share one RGBA texture: R in the red byte, G in green,
 * B in blue, which keeps this to a single texture unit and one sampler.
 */
export function bakeCurveLut(recipe, { rgb = null, r = null, g = null, b = null, size = CURVE_LUT_SIZE } = {}) {
    const rgbCurve = rgb !== null ? rgb : channelCurve(recipe, 'rgb')
    const rCurve = r !== null ? r : channelCurve(recipe, 'r')
    const gCurve = g !== null ? g : channelCurve(recipe, 'g')
    const bCurve = b !== null ? b : channelCurve(recipe, 'b')
    const n = Math.max(2, size)
    const out = new Uint8Array(n * 4)
    const toByte = (v) => {
        const c = Math.max(0, Math.min(1, v))
        return Math.round(c * 255)
    }
    for (let i = 0; i < n; i++) {
        const v = i / (n - 1)
        out[i * 4] = toByte(curveValue(v, rCurve || rgbCurve))
        out[i * 4 + 1] = toByte(curveValue(v, gCurve || rgbCurve))
        out[i * 4 + 2] = toByte(curveValue(v, bCurve || rgbCurve))
        out[i * 4 + 3] = 255
    }
    return { data: out, size: n }
}

/**
 * True when every effective channel curve is a straight line, i.e. the curve
 * pass is a no-op. The renderer uses this to skip the per-pixel texture fetch
 * on the common case where no curve has been touched.
 */
export function curvesAreIdentity(recipe) {
    const straight = (curve) => {
        if (!Array.isArray(curve)) return true
        return curve.every(([x, y]) => Math.abs(Number(y) - Number(x)) < 0.002)
    }
    return ['rgb', 'r', 'g', 'b'].every(ch => straight(channelCurve(recipe, ch)))
}

/**
 * A short content key for a baked curve table, so the renderer only re-uploads
 * when the curve genuinely changed. JSON over a 256-entry table is far cheaper
 * than uploading 1KB on every slider tick.
 */
export function curveLutKey(recipe) {
    const round = (curve) => (Array.isArray(curve)
        ? curve.map(([x, y]) => `${Number(x).toFixed(4)}:${Number(y).toFixed(4)}`).join(',')
        : '-')
    return [
        round(channelCurve(recipe, 'rgb')),
        round(channelCurve(recipe, 'r')),
        round(channelCurve(recipe, 'g')),
        round(channelCurve(recipe, 'b'))
    ].join('|')
}

export const VERTEX_SOURCE = `#version 300 es
in vec2 p;
out vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

export const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSource;
uniform vec2  uResolution;
uniform float uTime;
uniform float uExposure, uContrast, uTemperature, uTint;
uniform float uHighlights, uShadows, uWhites, uBlacks;
uniform float uSaturation, uVibrance, uClarity, uDehaze, uFade;
uniform float uGrain, uVignette, uBloom, uHalation, uChroma, uPosterize, uSplitTone;
uniform float uBw;
uniform float uZoom, uRotate;
uniform vec2  uFlip;
uniform vec4  uCrop;   // x0, y0, x1, y1 in 0..1 space
uniform sampler2D uLut;
uniform float uLutSize, uLutStrength;
uniform sampler2D uCurveLut;  // N×1 RGBA: per-channel baked tone curve
uniform float uCurveAmount;    // 0 = curves bypassed (keeps the CPU cost off idle GPUs)

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

vec3 toLinear(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 toSRGB(vec3 c){ return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

// Tone curve: baked lookup table shared by every channel.
// uCurveLut is an N×1 RGBA texture holding R, G and B curve samples; the
// tables are produced by bakeCurveLut() from the same curveValue() the CPU
// export uses, so the preview and the saved JPEG cannot drift apart.
vec3 curveLookup(vec3 c){
    vec3 s = texture(uCurveLut, vec3(c.r, 0.5)).rgb;
    return mix(c, s, uCurveAmount);
}

vec3 sampleSource(vec2 uv){
    return texture(uSource, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
}

// Grade: exposure -> white balance -> tone -> colour. Returns display-referred.
vec3 grade(vec3 c){
    // 1. Exposure in linear light so highlights roll off predictably.
    c = toLinear(c) * exp2(uExposure);
    c = toSRGB(c);

    // 2. White balance (temp/tint) as simple channel gains.
    c.r *= 1.0 + uTemperature * 0.18;
    c.b *= 1.0 - uTemperature * 0.18;
    c.g *= 1.0 - abs(uTint) * 0.10;
    c.r *= 1.0 + uTint * 0.06;
    c.b *= 1.0 + uTint * 0.06;

    // 3. Luma-driven tone: contrast pivot, then range endpoints.
    float l = luma(c);
    c = (c - 0.5) * uContrast + 0.5;
    c += (1.0 - l) * uShadows * 0.24;
    c += l * uHighlights * 0.18;
    c += smoothstep(0.75, 1.0, l) * uWhites * 0.20;
    c += (1.0 - smoothstep(0.0, 0.25, l)) * uBlacks * 0.20;

    // 4. Lifted blacks for a faded / matte film look.
    c = mix(c, c * (1.0 - uFade) + uFade * 0.10, 1.0);

    // 5. Vibrance protects already-saturated skin; saturation is blunt.
    l = luma(c);
    float mx = max(max(c.r, c.g), c.b);
    float mn = min(min(c.r, c.g), c.b);
    float sat = mx - mn;
    c = mix(vec3(l), c, 1.0 + uVibrance * (1.0 - sat));
    c = mix(vec3(luma(c)), c, uSaturation);

    // 6. Clarity: local contrast, gentle midtone weight.
    c = (c - 0.5) * (1.0 + uClarity * 0.35) + 0.5;

    // 7. Dehaze: pull toward luminance, lift the black point, add local punch.
    float dl = luma(c);
    c = mix(vec3(dl), c, 1.0 + uDehaze * 0.5);
    c += uDehaze * 0.06 * (dl - 0.5);

    return c;
}

// 3D LUT lookup (trilinear) on a 2D-packed texture.
vec3 sampleLut(vec3 c){
    if(uLutSize < 2.0) return c;
    float n = uLutSize;
    vec3 scaled = clamp(c, 0.0, 1.0) * (n - 1.0);
    vec3 base = floor(scaled);
    vec3 f = scaled - base;
    vec3 acc = vec3(0.0);
    for(int i = 0; i < 2; i++){
        for(int j = 0; j < 2; j++){
            for(int k = 0; k < 2; k++){
                vec3 idx = base + vec3(float(i), float(j), float(k));
                idx = clamp(idx, vec3(0.0), vec3(n - 1.0));
                // Layout: red fastest, then green, then blue.
                float u = (idx.r + idx.b * n) / (n * n);
                float v = (idx.g + 0.5) / n;
                vec3 s = texture(uLut, vec2(u, v)).rgb;
                acc += s * ((i == 1 ? f.r : 1.0 - f.r) * (j == 1 ? f.g : 1.0 - f.g) * (k == 1 ? f.b : 1.0 - f.b));
            }
        }
    }
    return acc;
}

// Apply crop, rotation, flip and zoom to the source UV.
vec2 transformUv(vec2 uv){
    // Crop remaps the visible window onto the full 0..1 range.
    vec2 p = vec2(
        mix(uCrop.x, uCrop.z, uv.x),
        mix(uCrop.y, uCrop.w, uv.y)
    );
    // Rotate about centre.
    float a = radians(uRotate);
    vec2 c = p - 0.5;
    float s = sin(a), co = cos(a);
    c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
    // Zoom about centre, then flip.
    c *= 1.0 / max(0.01, uZoom);
    c *= uFlip;
    return c + 0.5;
}

void main(){
    vec2 uv = transformUv(vUv);
    // Outside the source after transform: render as transparent-free black.
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0){
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec2 suv = clamp(uv, vec2(0.001), vec2(0.999));
    vec3 c = sampleSource(suv);
    c = grade(c);

    // --- Tone curves (applied per channel on top of the grade) ---
    c = curveLookup(c);

    // --- Bloom: bright-pass blur, added back. ---
    if(uBloom > 0.001){
        vec3 acc = vec3(0.0);
        for(int i = -3; i <= 3; i++){
            for(int j = -3; j <= 3; j++){
                vec2 o = vec2(float(i), float(j)) * 0.0035;
                acc += max(grade(sampleSource(clamp(suv + o, vec2(0.001), vec2(0.999)))) - 0.5, 0.0);
            }
        }
        acc /= 49.0;
        c += acc * uBloom * 1.6;
    }

    // --- Halation: red-orange bleed around hot areas (film print look). ---
    if(uHalation > 0.001){
        vec3 glow = vec3(0.0);
        for(int i = -2; i <= 2; i++){
            for(int j = -2; j <= 2; j++){
                vec2 o = vec2(float(i), float(j)) * 0.006;
                vec3 s = sampleSource(clamp(suv + o, vec2(0.001), vec2(0.999)));
                glow += vec3(1.0, 0.42, 0.18) * smoothstep(0.6, 1.0, luma(s));
            }
        }
        c += glow / 25.0 * uHalation;
    }

    // --- Chromatic aberration: sample R and B at opposite offsets. ---
    if(uChroma > 0.001){
        float d = 0.006 * uChroma;
        c.r = grade(sampleSource(clamp(suv + vec2(d, 0.0), vec2(0.001), vec2(0.999)))).r;
        c.b = grade(sampleSource(clamp(suv - vec2(d, 0.0), vec2(0.001), vec2(0.999)))).b;
    }

    // --- Split tone: teal shadows, warm highlights. ---
    if(uSplitTone > 0.001){
        float l = luma(c);
        vec3 shadowTint = vec3(0.42, 0.72, 0.85);
        vec3 highTint = vec3(1.0, 0.88, 0.68);
        c = mix(c, c * shadowTint, (1.0 - l) * uSplitTone * 0.55);
        c = mix(c, c * highTint, l * uSplitTone * 0.55);
    }

    // --- LUT ---
    if(uLutSize >= 2.0 && uLutStrength > 0.001){
        c = mix(c, sampleLut(c), uLutStrength);
    }

    // --- Vignette ---
    if(uVignette > 0.001){
        float d = length(vUv - 0.5) * 1.414;
        c *= 1.0 - smoothstep(0.35, 0.95, d) * uVignette * 0.8;
    }

    // --- Monochrome ---
    if(uBw > 0.5){
        float l = luma(c);
        c = vec3(l);
    }

    // --- Posterize ---
    if(uPosterize > 0.001){
        c = mix(c, floor(c * 8.0) / 8.0, uPosterize);
    }

    // --- Film grain, animated. Applied last so it reads as emulsion. ---
    if(uGrain > 0.001){
        float n = hash(vUv * uResolution + uTime * 60.0) - 0.5;
        c += n * 0.14 * uGrain;
    }

    outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

// ── CPU renderer ─────────────────────────────────────────────────────────────
// Used for export, save-to-library, and when WebGL2 is unavailable. Mirrors the
// fragment shader so an exported file matches the preview.

const srgbToLinear = v => Math.pow(Math.max(v, 0), 2.2)
const linearToSrgb = v => Math.pow(Math.max(v, 0), 1 / 2.2)

// Cheap separable box blur used for the bloom/halation light-spread passes.
function boxBlur(source, target, radius) {
    const w = target.width, h = target.height
    const tmp = new Float32Array(w * h * 3)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, n = 0
            for (let k = -radius; k <= radius; k++) {
                const sx = clamp(x + k, 0, w - 1)
                const i = (y * w + sx) * 4
                r += source[i]; g += source[i + 1]; b += source[i + 2]; n++
            }
            const o = (y * w + x) * 3
            tmp[o] = r / n; tmp[o + 1] = g / n; tmp[o + 2] = b / n
        }
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, n = 0
            for (let k = -radius; k <= radius; k++) {
                const sy = clamp(y + k, 0, h - 1)
                const i = (sy * w + x) * 3
                r += tmp[i]; g += tmp[i + 1]; b += tmp[i + 2]; n++
            }
            const o = (y * w + x) * 4
            target[o] = r / n; target[o + 1] = g / n; target[o + 2] = b / n
        }
    }
    return target
}

// The grading stage, per pixel. Kept separate so bloom/halation can re-grade
// the untouched source for their light-spread samples.
/**
 * Grade one pixel. `out` is written in place and returned.
 *
 * This is the innermost loop of the CPU render path — it runs once per output
 * pixel, so at 1400x1000 that is 1.4M calls per frame. It originally built a
 * fresh array for nearly every stage (`.map` eight times), which allocated
 * roughly 11M short-lived arrays per frame and put the fallback path well over
 * a second per edit. Everything here is now scalar math into `out`.
 */
function gradePixel(r, g, b, p, out = [0, 0, 0]) {
    // Exposure in linear light
    const gain = p.exposureGain ?? Math.pow(2, p.exposure || 0)
    let cr = r, cg = g, cb = b
    if (gain !== 1) {
        cr = linearToSrgb(srgbToLinear(r) * gain)
        cg = linearToSrgb(srgbToLinear(g) * gain)
        cb = linearToSrgb(srgbToLinear(b) * gain)
    }

    // White balance
    const temp = p.temperature || 0, tint = p.tint || 0
    cr *= 1 + temp * 0.18
    cb *= 1 - temp * 0.18
    cg *= 1 - Math.abs(tint) * 0.10
    cr *= 1 + tint * 0.06
    cb *= 1 + tint * 0.06

    let l = luma(cr, cg, cb)

    // Tone: contrast, then luma-driven region weights
    const contrast = p.contrast ?? 1
    if (contrast !== 1) {
        cr = (cr - 0.5) * contrast + 0.5
        cg = (cg - 0.5) * contrast + 0.5
        cb = (cb - 0.5) * contrast + 0.5
    }
    l = luma(cr, cg, cb)
    const shadows = p.shadows || 0, highlights = p.highlights || 0
    if (shadows || highlights) {
        const ds = (1 - l) * shadows * 0.24
        const dh = l * highlights * 0.18
        cr += ds + dh; cg += ds + dh; cb += ds + dh
    }

    // Whites / blacks endpoints
    const whites = p.whites || 0, blacks = p.blacks || 0
    if (whites || blacks) {
        l = luma(cr, cg, cb)
        const highMask = smoothstep(0.75, 1, l), lowMask = 1 - smoothstep(0, 0.25, l)
        const d = highMask * whites * 0.20 + lowMask * blacks * 0.20
        cr += d; cg += d; cb += d
    }

    // Fade (lifted blacks)
    const fade = p.fade || 0
    if (fade) {
        const k = 1 - fade, lift = fade * 0.10
        cr = cr * k + lift; cg = cg * k + lift; cb = cb * k + lift
    }

    // Vibrance then saturation
    l = luma(cr, cg, cb)
    const sat = Math.max(cr, cg, cb) - Math.min(cr, cg, cb)
    const vibrance = p.vibrance || 0
    if (vibrance) {
        const k = 1 + vibrance * (1 - sat)
        cr = l + (cr - l) * k; cg = l + (cg - l) * k; cb = l + (cb - l) * k
    }
    const saturation = p.saturation ?? 1
    if (saturation !== 1) {
        const l2 = luma(cr, cg, cb)
        cr = l2 + (cr - l2) * saturation
        cg = l2 + (cg - l2) * saturation
        cb = l2 + (cb - l2) * saturation
    }

    // Clarity
    const clarity = p.clarity || 0
    if (clarity) {
        const k = 1 + clarity * 0.35
        cr = (cr - 0.5) * k + 0.5
        cg = (cg - 0.5) * k + 0.5
        cb = (cb - 0.5) * k + 0.5
    }

    // Dehaze
    const dehaze = p.dehaze || 0
    if (dehaze) {
        const dl = luma(cr, cg, cb)
        const k = 1 + dehaze * 0.5
        const add = dehaze * 0.06 * (dl - 0.5)
        cr = (dl + (cr - dl) * k) + add
        cg = (dl + (cg - dl) * k) + add
        cb = (dl + (cb - dl) * k) + add
    }

    out[0] = cr; out[1] = cg; out[2] = cb
    return out
}

// Geometry: map a destination pixel back to source coordinates, applying
// crop, rotation, zoom and flip. Returns null when the sample is off-image.
//
// The rotation terms are the same for every pixel, so they are hoisted and
// memoised rather than recomputed 1.4M times per frame.
const geoCache = { key: null, cos: 1, sin: 0, zoom: 1 }
function geoTerms(geo) {
    const key = `${geo?.rotate || 0}|${geo?.zoom ?? 1}`
    if (geoCache.key !== key) {
        geoCache.key = key
        geoCache.cos = Math.cos((geo?.rotate || 0) * Math.PI / 180)
        geoCache.sin = Math.sin((geo?.rotate || 0) * Math.PI / 180)
        geoCache.zoom = Math.max(0.01, geo?.zoom ?? 1)
    }
    return geoCache
}
function mapGeometry(x, y, w, h, geo, out = [0, 0]) {
    const crop = geo?.crop || [0, 0, 1, 1]
    let u = crop[0] + (x / w) * (crop[2] - crop[0])
    let v = crop[1] + (y / h) * (crop[3] - crop[1])

    const { cos, sin, zoom } = geoTerms(geo)
    const ox = u - 0.5, oy = v - 0.5
    let dx = ox * cos - oy * sin
    let dy = ox * sin + oy * cos

    dx /= zoom
    dy /= zoom
    if (geo?.flipH) dx = -dx
    if (geo?.flipV) dy = -dy
    out[0] = dx + 0.5
    out[1] = dy + 0.5
    return out
}

// Trilinear 3D LUT lookup, matching sampleLut() in the shader.
// Writes into `rgb` in place and returns it — the original allocated four
// arrays per pixel (one per `at` call plus a `.map`), which dominated any
// LUT-using export.
export function applyLut(rgb, lut, strength = 1) {
    if (!lut?.size || !lut?.data?.length) return rgb
    const n = lut.size
    const last = n - 1
    const ri = Math.round(clamp(rgb[0]) * last)
    const gi = Math.round(clamp(rgb[1]) * last)
    const bi = Math.round(clamp(rgb[2]) * last)
    const base = ((bi * n + gi) * n + ri) * 3
    const d = lut.data
    rgb[0] += (d[base] - rgb[0]) * strength
    rgb[1] += (d[base + 1] - rgb[1]) * strength
    rgb[2] += (d[base + 2] - rgb[2]) * strength
    return rgb
}

/**
 * Render an image through a recipe on the CPU.
 * @param {HTMLImageElement|HTMLCanvasElement} source
 * @param {HTMLCanvasElement} target
 * @param {object} recipe
 * @param {object} [options] { maxWidth, maxHeight }
 */
export function renderRecipe(source, target, recipe, options = {}) {
    const sw = source.naturalWidth || source.width
    const sh = source.naturalHeight || source.height
    if (!sw || !sh || !target) return target

    const maxW = options.maxWidth ?? 2000
    const maxH = options.maxHeight ?? 2000
    const scale = Math.min(1, maxW / sw, maxH / sh)
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))
    target.width = w
    target.height = h

    // Sample the source once at render resolution.
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = w
    srcCanvas.height = h
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
    if (!srcCtx) return target
    srcCtx.drawImage(source, 0, 0, w, h)
    const srcData = srcCtx.getImageData(0, 0, w, h)
    const sd = srcData.data

    const out = srcCtx.createImageData(w, h)
    const od = out.data

    const params = { ...GRADE_DEFAULTS, ...(recipe?.params || {}) }
    params.exposureGain = Math.pow(2, params.exposure || 0)
    const fx = { ...FX_DEFAULTS, ...(recipe?.fx || {}) }
    const geo = recipe?.geometry || DEFAULT_RECIPE.geometry
    const crop = geo.crop
    const fullCrop = !crop || (crop[0] === 0 && crop[1] === 0 && crop[2] === 1 && crop[3] === 1)
    const identityGeometry = fullCrop
        && (((geo.rotate || 0) % 360 + 360) % 360) === 0
        && (geo.zoom ?? 1) === 1
        && !geo.flipH
        && !geo.flipV
    const curveData = curvesAreIdentity(recipe) ? null : bakeCurveLut(recipe).data
    const curveAt = (value, channel) => {
        const position = clamp(value) * (CURVE_LUT_SIZE - 1)
        const low = Math.floor(position)
        const high = Math.min(CURVE_LUT_SIZE - 1, low + 1)
        const offset = channel
        const from = curveData[low * 4 + offset]
        const to = curveData[high * 4 + offset]
        return (from + (to - from) * (position - low)) / 255
    }
    const isBw = Boolean(recipe?.bw)
    const lutStrength = recipe?.lutStrength ?? 1

    // Bilinear sample of the resized source at normalised coordinates.
    // Writes into the caller's buffer rather than allocating, for the same
    // reason gradePixel does — this runs 1.4M times per frame. The caller must
    // pass a distinct buffer for any sample it intends to keep: the chroma
    // pass needs three of them live at once, so a shared scratch would make
    // the red and blue taps read the same pixel and quietly kill the effect.
    const sampleSrc = (u, v, sampleOut) => {
        const x = u * (w - 1), y = v * (h - 1)
        const x0 = Math.floor(x), y0 = Math.floor(y)
        const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
        const fx0 = x - x0, fy0 = y - y0
        const row0 = (y0 * w) * 4, row1 = (y1 * w) * 4
        for (let ch = 0; ch < 3; ch++) {
            const p00 = sd[row0 + x0 * 4 + ch]
            const p10 = sd[row0 + x1 * 4 + ch]
            const p01 = sd[row1 + x0 * 4 + ch]
            const p11 = sd[row1 + x1 * 4 + ch]
            sampleOut[ch] = ((p00 * (1 - fx0) + p10 * fx0) * (1 - fy0) + (p01 * (1 - fx0) + p11 * fx0) * fy0) / 255
        }
        return sampleOut
    }

    // Bloom / halation need blurred, graded versions of the source. Build a
    // downsampled copy once instead of re-grading per pixel later.
    let brightPass = null
    if (fx.bloom > 0.001 || fx.halation > 0.001) {
        const brightSrc = [0, 0, 0]
        const brightGrd = [0, 0, 0]
        const bw = Math.max(1, Math.round(w / 2)), bh = Math.max(1, Math.round(h / 2))
        const small = new Uint8ClampedArray(bw * bh * 4)
        const brightPoint = [0, 0]
        for (let y = 0; y < bh; y++) {
            for (let x = 0; x < bw; x++) {
                const point = mapGeometry((x + 0.5) / bw, (y + 0.5) / bh, 1, 1, geo, brightPoint)
                const su = point[0], sv = point[1]
                const o = (y * bw + x) * 4
                if (su < 0 || su > 1 || sv < 0 || sv > 1) { small[o + 3] = 255; continue }
                const s = sampleSrc(su, sv, brightSrc)
                const gr = gradePixel(s[0], s[1], s[2], params, brightGrd)
                const l = luma(gr[0], gr[1], gr[2])
                small[o] = clamp(gr[0]) * 255
                small[o + 1] = clamp(gr[1]) * 255
                small[o + 2] = clamp(gr[2]) * 255
                small[o + 3] = 255
                void l
            }
        }
        const blurred = boxBlur(small, new Uint8ClampedArray(bw * bh * 4), Math.max(1, Math.round(bw / 90)))
        brightPass = { data: blurred, w: bw, h: bh }
    }

    const sampleBright = (u, v) => {
        if (!brightPass) return [0, 0, 0];
        const x = clamp(u) * (brightPass.w - 1), y = clamp(v) * (brightPass.h - 1)
        const x0 = Math.floor(x), y0 = Math.floor(y)
        const x1 = Math.min(brightPass.w - 1, x0 + 1), y1 = Math.min(brightPass.h - 1, y0 + 1)
        const fx0 = x - x0, fy0 = y - y0
        const d = brightPass.data
        const out = [0, 0, 0]
        for (let ch = 0; ch < 3; ch++) {
            const p00 = d[(y0 * brightPass.w + x0) * 4 + ch]
            const p10 = d[(y0 * brightPass.w + x1) * 4 + ch]
            const p01 = d[(y1 * brightPass.w + x0) * 4 + ch]
            const p11 = d[(y1 * brightPass.w + x1) * 4 + ch]
            out[ch] = ((p00 * (1 - fx0) + p10 * fx0) * (1 - fy0) + (p01 * (1 - fx0) + p11 * fx0) * fy0) / 255
        }
        return out
    }

    // Deterministic grain: the CPU export must not shimmer between runs.
    const grainSeed = (x, y) => {
        const s = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453
        return (s - Math.floor(s)) - 0.5
    }

    // Scratch buffers, reused for every pixel. At 1400x1000 this loop runs 1.4M
    // times; allocating a fresh [r,g,b] per pixel was the dominant cost and is
    // what made the CPU fallback feel like it was rendering a slideshow.
    // Three separate ones: the chroma pass needs the base sample and two
    // offset taps alive at the same time.
    const px = [0, 0, 0]
    const chromaR = [0, 0, 0]
    const chromaB = [0, 0, 0]

    const point = [0, 0]
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4
            const uvx = (x + 0.5) / w, uvy = (y + 0.5) / h
            let s
            if (identityGeometry) {
                px[0] = sd[o] / 255
                px[1] = sd[o + 1] / 255
                px[2] = sd[o + 2] / 255
                s = px
            } else {
                const mapped = mapGeometry(uvx, uvy, 1, 1, geo, point)
                const su = mapped[0], sv = mapped[1]
                if (su < 0 || su > 1 || sv < 0 || sv > 1) {
                    od[o] = 0; od[o + 1] = 0; od[o + 2] = 0; od[o + 3] = 255
                    continue
                }
                s = sampleSrc(su, sv, px)
            }
            const c = gradePixel(s[0], s[1], s[2], params, px)
            if (curveData) {
                c[0] = curveAt(c[0], 0)
                c[1] = curveAt(c[1], 1)
                c[2] = curveAt(c[2], 2)
            }

            // Bloom
            if (fx.bloom > 0.001) {
                const bl = sampleBright(uvx, uvy)
                c[0] += Math.max(0, bl[0] - 0.5) * fx.bloom * 1.6
                c[1] += Math.max(0, bl[1] - 0.5) * fx.bloom * 1.6
                c[2] += Math.max(0, bl[2] - 0.5) * fx.bloom * 1.6
            }

            // Halation — warm red bleed around highlights
            if (fx.halation > 0.001) {
                const bl = sampleBright(uvx, uvy)
                const heat = smoothstep(0.6, 1, luma(bl[0], bl[1], bl[2]))
                const k = heat * fx.halation
                c[0] += 1.0 * k; c[1] += 0.42 * k; c[2] += 0.18 * k
            }

            // Chromatic aberration — two offset taps of the *source*, each
            // graded independently, then the red and blue channels swapped in.
            if (fx.chroma > 0.001) {
                const d = 0.006 * fx.chroma
                const sr = sampleSrc(clamp(su + d, 0, 1), sv, chromaR)
                const sb = sampleSrc(clamp(su - d, 0, 1), sv, chromaB)
                c[0] = gradePixel(sr[0], sr[1], sr[2], params, chromaR)[0]
                c[2] = gradePixel(sb[0], sb[1], sb[2], params, chromaB)[2]
            }

            // Split tone
            if (fx.splitTone > 0.001) {
                const l = luma(c[0], c[1], c[2])
                const k = fx.splitTone * 0.55
                c[0] = c[0] + ((1 - l) * (0.42 - 1) * k) + (l * (1.0 - 1) * k)
                c[1] = c[1] + ((1 - l) * (0.72 - 1) * k) + (l * (0.88 - 1) * k)
                c[2] = c[2] + ((1 - l) * (0.85 - 1) * k) + (l * (0.68 - 1) * k)
            }

            // LUT
            if (recipe?.lut && lutStrength > 0.001) applyLut(c, recipe.lut, lutStrength)

            // Vignette — measured on screen space, not source space
            if (fx.vignette > 0.001) {
                const dist = Math.hypot(uvx - 0.5, uvy - 0.5) * 1.414
                const k = 1 - smoothstep(0.35, 0.95, dist) * fx.vignette * 0.8
                c[0] *= k; c[1] *= k; c[2] *= k
            }

            // Monochrome
            if (isBw) {
                const l = luma(c[0], c[1], c[2])
                c[0] = l; c[1] = l; c[2] = l
            }

            // Posterize
            if (fx.posterize > 0.001) {
                const k = fx.posterize
                c[0] += (Math.floor(c[0] * 8) / 8 - c[0]) * k
                c[1] += (Math.floor(c[1] * 8) / 8 - c[1]) * k
                c[2] += (Math.floor(c[2] * 8) / 8 - c[2]) * k
            }

            // Grain (deterministic)
            if (fx.grain > 0.001) {
                const g = grainSeed(x, y) * 0.14 * fx.grain
                c[0] += g; c[1] += g; c[2] += g
            }

            od[o] = clamp(c[0]) * 255
            od[o + 1] = clamp(c[1]) * 255
            od[o + 2] = clamp(c[2]) * 255
            od[o + 3] = 255
        }
    }

    target.getContext('2d').putImageData(out, 0, 0)
    return target
}

// ── Geometry helpers ─────────────────────────────────────────────────────────
// Output pixel dimensions after crop/rotation, so the stage and the export
// always agree on aspect ratio.
export function outputSize(sourceW, sourceH, geometry) {
    const crop = geometry?.crop
    if (!crop) return [sourceW, sourceH]
    const cropW = Math.max(1, (crop[2] - crop[0]) * sourceW)
    const cropH = Math.max(1, (crop[3] - crop[1]) * sourceH)
    const rot = Math.abs(((geometry?.rotate || 0) % 180 + 180) % 180)
    if (rot === 90) return [Math.round(cropH), Math.round(cropW)]
    return [Math.round(cropW), Math.round(cropH)]
}

export const CROP_PRESETS = {
    free: [0, 0, 1, 1],
    '1:1': [0, 0, 1, 1],   // resolved against the image aspect at apply time
    '4:5': [0, 0, 1, 1],
    '3:2': [0, 0, 1, 1],
    '16:9': [0, 0, 1, 1],
    '2:3': [0, 0, 1, 1]
}

// Build a centred crop box for a target aspect ratio.
export function centreCrop(aspect, current = [0, 0, 1, 1]) {
    const [x0, y0, x1, y1] = current
    const curW = x1 - x0, curH = y1 - y0
    if (aspect >= curW / curH) {
        const newW = curH * aspect
        const cx = (x0 + x1) / 2
        return [cx - newW / 2, y0, cx + newW / 2, y1]
    }
    const newH = curW / aspect
    const cy = (y0 + y1) / 2
    return [x0, cy - newH / 2, x1, cy + newH / 2]
}


// ── Auto adjust ──────────────────────────────────────────────────────────────
/**
 * Analyse an image and suggest grade values: black/white points, average
 * exposure, white balance from channel means, and initial contrast.
 * Runs on a small thumbnail so it stays instant even for large files.
 */
export function analyseImage(image) {
    const sw = image.naturalWidth || image.width
    const sh = image.naturalHeight || image.height
    if (!sw || !sh) return null

    const size = 96
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(image, 0, 0, size, size)
    const d = ctx.getImageData(0, 0, size, size).data

    const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
    let sumR = 0, sumG = 0, sumB = 0
    const n = size * size
    for (let i = 0; i < d.length; i += 4) {
        hist[0][d[i]]++; hist[1][d[i + 1]]++; hist[2][d[i + 2]]++
        sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2]
    }
    // 98th percentile cut-off rejects specular highlights from the white point.
    const percentile = (bins, p) => {
        const target = n * p
        let acc = 0
        for (let i = 0; i < 256; i++) { acc += bins[i]; if (acc >= target) return i }
        return 255
    }
    const black = [0, 1, 2].map(i => percentile(hist[i], 0.02))
    const white = [0, 1, 2].map(i => percentile(hist[i], 0.98))
    const meanR = sumR / n / 255, meanG = sumG / n / 255, meanB = sumB / n / 255
    const mean = (meanR + meanG + meanB) / 3
    // Rec. 709 luma, so the EV readout describes perceived brightness rather
    // than a flat average that a saturated blue would drag down.
    const meanLuma = meanR * 0.2126 + meanG * 0.7152 + meanB * 0.0722

    // Exposure aims to place the average pixel near a pleasing midtone.
    const exposure = clamp(Math.log2(0.45 / Math.max(0.02, mean)), -3, 3)
    // White balance: push the strongest channel down, lift the weakest up.
    const temp = clamp((meanR - meanB) * 2.2, -1, 1)
    const tint = clamp((meanG - (meanR + meanB) / 2) * 2.4, -1, 1)
    // Contrast from the spread between the 2nd and 98th percentiles.
    const range = (white[1] - black[1]) / 255
    const contrast = clamp(range < 0.7 ? 1 + (0.7 - range) * 0.9 : 1, 0.8, 1.6)

    return {
        params: {
            exposure: Number(exposure.toFixed(2)),
            temperature: Number(temp.toFixed(2)),
            tint: Number(tint.toFixed(2)),
            contrast: Number(contrast.toFixed(2))
        },
        blacks: -clamp(black[1] / 255 * 1.4, 0, 1),
        whites: clamp((white[1] - 220) / 255 * 1.2, 0, 1),
        meanLuma
    }
}


// ── Recipe utilities ─────────────────────────────────────────────────────────

/** True when the recipe differs from a fresh default (drives the dirty dot). */
export function isRecipeDirty(recipe) {
    if (!recipe) return false
    const base = DEFAULT_RECIPE
    if (recipe.bw) return true
    if (JSON.stringify(recipe.params) !== JSON.stringify(base.params)) return true
    if (JSON.stringify(recipe.fx) !== JSON.stringify(base.fx)) return true
    const g = recipe.geometry || base.geometry
    if (g.rotate || g.flipH || g.flipV || (g.zoom ?? 1) !== 1) return true
    if (g.crop && (g.crop[0] || g.crop[1] || g.crop[2] !== 1 || g.crop[3] !== 1)) return true
    if (recipe.curves) {
        const flat = JSON.stringify(recipe.curves)
        if (flat !== JSON.stringify(base.curves)) return true
    }
    if (recipe.lut) return true
    return false
}

/** Backwards-compatible read of any legacy recipe field names. */
export function normaliseRecipe(input) {
    const recipe = createRecipe()
    if (!input) return recipe
    // Legacy layouts stored grade + fx in one params bag.
    const legacy = input.params || {}
    Object.keys(GRADE_DEFAULTS).forEach(k => {
        if (typeof legacy[k] === 'number') recipe.params[k] = legacy[k]
    })
    Object.keys(FX_DEFAULTS).forEach(k => {
        if (typeof legacy[k] === 'number') recipe.fx[k] = legacy[k]
    })
    if (input.params) Object.assign(recipe.params, pick(input.params, GRADE_DEFAULTS))
    if (input.fx) Object.assign(recipe.fx, pick(input.fx, FX_DEFAULTS))
    if (input.geometry) recipe.geometry = { ...recipe.geometry, ...input.geometry }
    if (input.curves) {
        if (Array.isArray(input.curves)) recipe.curves.rgb = input.curves
        else recipe.curves = { ...recipe.curves, ...input.curves }
    }
    if (typeof input.bw === 'boolean') recipe.bw = input.bw
    if (typeof input.lutStrength === 'number') recipe.lutStrength = input.lutStrength
    recipe.lut = input.lut || null
    return recipe
}

function pick(source, defaults) {
    const out = {}
    Object.keys(defaults).forEach(k => { if (typeof source[k] === 'number') out[k] = source[k] })
    return out
}

/** Flatten a recipe into the shape persisted on an asset. */
export function serialiseRecipe(recipe) {
    return JSON.parse(JSON.stringify({
        version: 2,
        params: recipe.params,
        fx: recipe.fx,
        geometry: recipe.geometry,
        curves: recipe.curves,
        lut: recipe.lut ? { name: recipe.lut.name, size: recipe.lut.size, data: recipe.lut.data } : null,
        lutStrength: recipe.lutStrength,
        bw: recipe.bw
    }))
}
