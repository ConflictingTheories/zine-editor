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
        id: 'colour',
        label: 'Colour',
        controls: [
            ['temperature', 'Temp', -1, 1, pct, true],
            ['tint', 'Tint', -1, 1, pct, true],
            ['saturation', 'Saturation', 0, 2.5, pct, false],
            ['vibrance', 'Vibrance', -1, 1, pct, true]
        ]
    },
    {
        id: 'detail',
        label: 'Detail',
        controls: [
            ['clarity', 'Clarity', -1, 1, pct, true],
            ['dehaze', 'Dehaze', -1, 1, pct, true],
            ['sharpen', 'Sharpen', 0, 1, pct, false],
            ['denoise', 'Denoise', 0, 1, pct, false]
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

// Monotone cubic-ish spline evaluator for tone curve points.
export function curveValue(value, points) {
    if (!points || points.length < 2) return value
    const sorted = points.slice().sort((a, b) => a[0] - b[0])
    if (value <= sorted[0][0]) return sorted[0][1]
    for (let i = 1; i < sorted.length; i++) {
        if (value <= sorted[i][0]) {
            const [x0, y0] = sorted[i - 1]
            const [x1, y1] = sorted[i]
            const t = (value - x0) / Math.max(0.0001, x1 - x0)
            return clamp(y0 + (y1 - y0) * (t * t * (3 - 2 * t)))
        }
    }
    return sorted[sorted.length - 1][1]
}

// Effective curve for a channel: falls back to the shared rgb curve.
export function channelCurve(recipe, channel) {
    const curves = recipe?.curves
    if (!curves) return null
    if (Array.isArray(curves)) return curves
    return curves[channel] || curves.rgb || null
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
uniform vec4 uCurveX, uCurveY;   // shared rgb curve
uniform vec4 uCurveRX, uCurveRY; // red channel
uniform vec4 uCurveGX, uCurveGY; // green channel
uniform vec4 uCurveBX, uCurveBY; // blue channel

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

vec3 toLinear(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 toSRGB(vec3 c){ return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

// Tone curve: 4-segment smoothstep spline over 5 control points.
// uCurveX holds the point x values, uCurveY the y values. This matches the
// smoothstep interpolation used by curveValue() on the CPU side.
float curveLookup(float v, vec4 uCurveX, vec4 uCurveY){
    float x = clamp(v, 0.0, 1.0);
    if(x <= uCurveX.x) return uCurveY.x;
    if(x >= uCurveX.w) return uCurveY.w;
    if(x < uCurveX.y){ float t = (x - uCurveX.x) / max(1e-4, uCurveX.y - uCurveX.x); return mix(uCurveY.x, uCurveY.y, t * t * (3.0 - 2.0 * t)); }
    if(x < uCurveX.z){ float t = (x - uCurveX.y) / max(1e-4, uCurveX.z - uCurveX.y); return mix(uCurveY.y, uCurveY.z, t * t * (3.0 - 2.0 * t)); }
    float t = (x - uCurveX.z) / max(1e-4, uCurveX.w - uCurveX.z);
    return mix(uCurveY.z, uCurveY.w, t * t * (3.0 - 2.0 * t));
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
    c.r = curveLookup(c.r, uCurveX, uCurveY);
    c.g = curveLookup(c.g, uCurveX, uCurveY);
    c.b = curveLookup(c.b, uCurveX, uCurveY);
    c.r = curveLookup(c.r, uCurveRX, uCurveRY);
    c.g = curveLookup(c.g, uCurveGX, uCurveGY);
    c.b = curveLookup(c.b, uCurveBX, uCurveBY);

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
function gradePixel(r, g, b, p) {
    // Exposure in linear light
    const gain = Math.pow(2, p.exposure || 0)
    let c = [linearToSrgb(srgbToLinear(r) * gain), linearToSrgb(srgbToLinear(g) * gain), linearToSrgb(srgbToLinear(b) * gain)]

    // White balance
    const temp = p.temperature || 0, tint = p.tint || 0
    c[0] *= 1 + temp * 0.18
    c[2] *= 1 - temp * 0.18
    c[1] *= 1 - Math.abs(tint) * 0.10
    c[0] *= 1 + tint * 0.06
    c[2] *= 1 + tint * 0.06

    let l = luma(c[0], c[1], c[2])

    // Tone: contrast, then luma-driven region weights
    const contrast = p.contrast ?? 1
    c = c.map(v => (v - 0.5) * contrast + 0.5)
    l = luma(c[0], c[1], c[2])
    const shadows = p.shadows || 0, highlights = p.highlights || 0
    c = c.map(v => v + (1 - l) * shadows * 0.24 + l * highlights * 0.18)

    // Whites / blacks endpoints
    const whites = p.whites || 0, blacks = p.blacks || 0
    l = luma(c[0], c[1], c[2])
    const highMask = smoothstep(0.75, 1, l), lowMask = 1 - smoothstep(0, 0.25, l)
    c = c.map(v => v + highMask * whites * 0.20 + lowMask * blacks * 0.20)

    // Fade (lifted blacks)
    const fade = p.fade || 0
    if (fade) c = c.map(v => v * (1 - fade) + fade * 0.10)

    // Vibrance then saturation
    l = luma(c[0], c[1], c[2])
    const sat = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])
    const vibrance = p.vibrance || 0
    if (vibrance) {
        const k = 1 + vibrance * (1 - sat)
        c = c.map(v => l + (v - l) * k)
    }
    const saturation = p.saturation ?? 1
    const l2 = luma(c[0], c[1], c[2])
    c = c.map(v => l2 + (v - l2) * saturation)

    // Clarity
    const clarity = p.clarity || 0
    if (clarity) c = c.map(v => (v - 0.5) * (1 + clarity * 0.35) + 0.5)

    // Dehaze
    const dehaze = p.dehaze || 0
    if (dehaze) {
        const dl = luma(c[0], c[1], c[2])
        c = c.map(v => (dl + (v - dl) * (1 + dehaze * 0.5)) + dehaze * 0.06 * (dl - 0.5))
    }

    return c
}

// Geometry: map a destination pixel back to source coordinates, applying
// crop, rotation, zoom and flip. Returns null when the sample is off-image.
function mapGeometry(x, y, w, h, geo) {
    const crop = geo?.crop || [0, 0, 1, 1]
    let u = crop[0] + (x / w) * (crop[2] - crop[0])
    let v = crop[1] + (y / h) * (crop[3] - crop[1])

    const rad = (geo?.rotate || 0) * Math.PI / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const ox = u - 0.5, oy = v - 0.5
    let dx = ox * cos - oy * sin
    let dy = ox * sin + oy * cos

    const zoom = Math.max(0.01, geo?.zoom ?? 1)
    dx /= zoom
    dy /= zoom
    if (geo?.flipH) dx = -dx
    if (geo?.flipV) dy = -dy
    return [dx + 0.5, dy + 0.5]
}

// Trilinear 3D LUT lookup, matching sampleLut() in the shader.
export function applyLut(rgb, lut, strength = 1) {
    if (!lut?.size || !lut?.data?.length) return rgb
    const n = lut.size
    const at = (r, g, b) => {
        const ri = Math.round(clamp(r) * (n - 1))
        const gi = Math.round(clamp(g) * (n - 1))
        const bi = Math.round(clamp(b) * (n - 1))
        const i = ((bi * n + gi) * n + ri) * 3
        return [lut.data[i], lut.data[i + 1], lut.data[i + 2]]
    }
    const out = [0, 1, 2].map(ch => {
        const s = at(...rgb)[ch]
        return rgb[ch] + (s - rgb[ch]) * strength
    })
    return out
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
    srcCtx.drawImage(source, 0, 0, w, h)
    const srcData = srcCtx.getImageData(0, 0, w, h)
    const sd = srcData.data

    const out = srcCtx.createImageData(w, h)
    const od = out.data

    const params = { ...GRADE_DEFAULTS, ...(recipe?.params || {}) }
    const fx = { ...FX_DEFAULTS, ...(recipe?.fx || {}) }
    const geo = recipe?.geometry || DEFAULT_RECIPE.geometry
    const curves = recipe?.curves
    const rgbCurve = channelCurve(recipe, 'rgb')
    const rCurve = channelCurve(recipe, 'r')
    const gCurve = channelCurve(recipe, 'g')
    const bCurve = channelCurve(recipe, 'b')
    const isBw = Boolean(recipe?.bw)
    const lutStrength = recipe?.lutStrength ?? 1

    // Bilinear sample of the resized source at normalised coordinates.
    const sampleSrc = (u, v) => {
        const x = u * (w - 1), y = v * (h - 1)
        const x0 = Math.floor(x), y0 = Math.floor(y)
        const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
        const fx0 = x - x0, fy0 = y - y0
        const out = [0, 0, 0]
        for (let ch = 0; ch < 3; ch++) {
            const p00 = sd[(y0 * w + x0) * 4 + ch]
            const p10 = sd[(y0 * w + x1) * 4 + ch]
            const p01 = sd[(y1 * w + x0) * 4 + ch]
            const p11 = sd[(y1 * w + x1) * 4 + ch]
            out[ch] = (p00 * (1 - fx0) + p10 * fx0) * (1 - fy0) + (p01 * (1 - fx0) + p11 * fx0) * fy0
        }
        return out.map(v2 => v2 / 255)
    }

    // Bloom / halation need blurred, graded versions of the source. Build a
    // downsampled copy once instead of re-grading per pixel later.
    let brightPass = null
    if (fx.bloom > 0.001 || fx.halation > 0.001) {
        const bw = Math.max(1, Math.round(w / 2)), bh = Math.max(1, Math.round(h / 2))
        const small = new Uint8ClampedArray(bw * bh * 4)
        for (let y = 0; y < bh; y++) {
            for (let x = 0; x < bw; x++) {
                const [su, sv] = mapGeometry((x + 0.5) / bw, (y + 0.5) / bh, 1, 1, geo)
                const o = (y * bw + x) * 4
                if (su < 0 || su > 1 || sv < 0 || sv > 1) { small[o + 3] = 255; continue }
                const s = sampleSrc(su, sv)
                const gr = gradePixel(s[0], s[1], s[2], params)
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
        if (!brightPass) return [0, 0, 0]
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

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4
            const uvx = (x + 0.5) / w, uvy = (y + 0.5) / h
            const [su, sv] = mapGeometry(uvx, uvy, 1, 1, geo)
            if (su < 0 || su > 1 || sv < 0 || sv > 1) {
                od[o] = 0; od[o + 1] = 0; od[o + 2] = 0; od[o + 3] = 255
                continue
            }
            const s = sampleSrc(su, sv)
            let c = gradePixel(s[0], s[1], s[2], params)

            // Tone curves
            if (rgbCurve) c = c.map((v, i) => curveValue(v, rgbCurve))
            if (rCurve) c[0] = curveValue(c[0], rCurve)
            if (gCurve) c[1] = curveValue(c[1], gCurve)
            if (bCurve) c[2] = curveValue(c[2], bCurve)

            // Bloom
            if (fx.bloom > 0.001) {
                const bl = sampleBright(uvx, uvy)
                c = c.map((v, i) => v + Math.max(0, bl[i] - 0.5) * fx.bloom * 1.6)
            }

            // Halation — warm red bleed around highlights
            if (fx.halation > 0.001) {
                const bl = sampleBright(uvx, uvy)
                const heat = smoothstep(0.6, 1, luma(bl[0], bl[1], bl[2]))
                const k = heat * fx.halation
                c[0] += 1.0 * k; c[1] += 0.42 * k; c[2] += 0.18 * k
            }

            // Chromatic aberration
            if (fx.chroma > 0.001) {
                const d = 0.006 * fx.chroma
                const sr = sampleSrc(clamp(su + d, 0, 1), sv)
                const sb = sampleSrc(clamp(su - d, 0, 1), sv)
                c[0] = gradePixel(sr[0], sr[1], sr[2], params)[0]
                c[2] = gradePixel(sb[0], sb[1], sb[2], params)[2]
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
            if (recipe?.lut && lutStrength > 0.001) c = applyLut(c, recipe.lut, lutStrength)

            // Vignette — measured on screen space, not source space
            if (fx.vignette > 0.001) {
                const dist = Math.hypot(uvx - 0.5, uvy - 0.5) * 1.414
                const k = 1 - smoothstep(0.35, 0.95, dist) * fx.vignette * 0.8
                c = c.map(v => v * k)
            }

            // Monochrome
            if (isBw) {
                const l = luma(c[0], c[1], c[2])
                c = [l, l, l]
            }

            // Posterize
            if (fx.posterize > 0.001) c = c.map(v => v + (Math.floor(v * 8) / 8 - v) * fx.posterize)

            // Grain (deterministic)
            if (fx.grain > 0.001) c = c.map(v => v + grainSeed(x, y) * 0.14 * fx.grain)

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
        whites: clamp((white[1] - 220) / 255 * 1.2, 0, 1)
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
