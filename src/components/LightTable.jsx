import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { cubeText, downloadText, parseCube } from '../lib/lightTable.js'
import { renderLightTable } from '../lib/lightTablePipeline.js'

// ─── GLSL 300 es — WebGL2 only ───────────────────────────────────────────────
const VERT_SRC = `#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

const FRAG_SRC = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime,uExposure,uContrast,uSaturation,uTemperature,uTint,uShadows,uHighlights,uCurve,uGrain,uVignette,uBloom,uChroma,uPosterize,uEffectStrength;
out vec4 outColor;

float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 grade(vec3 c){
  c*=exp2(uExposure);
  c=(c-.5)*max(uContrast,0.)+.5;
  float l=dot(c,vec3(.2126,.7152,.0722));
  c=mix(vec3(l),c,uSaturation);
  c+=vec3(uTemperature*.1,uTint*.055,-uTemperature*.1);
  c+=(1.-l)*uShadows*.24+l*uHighlights*.18;
  return pow(max(c,0.),vec3(max(.18,uCurve)));
}

void main(){
  vec2 uv=gl_FragCoord.xy/uResolution;
  uv.y=1.-uv.y;
  vec2 s=uv;

  // Bloom / glow pass
  vec3 bloom=vec3(0.);
  if(uBloom>0.001){
    for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++)
      bloom+=texture(uSource,clamp(uv+vec2(float(i),float(j))*.004,.001,.999)).rgb;
    bloom/=25.;
  }

  vec3 c=grade(texture(uSource,clamp(s,.001,.999)).rgb);

  // Bloom composite
  if(uBloom>0.001) c+=max(grade(bloom)-c,0.)*uBloom*1.4;

  // Film grain
  if(uGrain>0.001) c+=(noise(uv*uResolution+uTime)-.5)*.12*uGrain;

  // Chromatic aberration
  if(uChroma>0.001){
    float d=.006*uChroma;
    c.r=grade(texture(uSource,clamp(uv+vec2(d,0.),.001,.999)).rgb).r;
    c.b=grade(texture(uSource,clamp(uv-vec2(d,0.),.001,.999)).rgb).b;
  }

  // Vignette
  if(uVignette>0.001) c*=1.-smoothstep(.35,.9,length(uv-.5)*1.414)*uVignette*.75;

  // Posterize
  if(uPosterize>0.001) c=mix(c,floor(c*8.)/8.,uPosterize);

  outColor=vec4(clamp(c,0.,1.),1.);
}`

// ─── GL helper ───────────────────────────────────────────────────────────────
function buildGLProgram(gl, vert, frag) {
    const compile = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null }
        return s
    }
    const v = compile(gl.VERTEX_SHADER, vert), f = compile(gl.FRAGMENT_SHADER, frag)
    if (!v || !f) return null
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null }
    return p
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULTS = { exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0, shadows: 0, highlights: 0, curve: 1, lutStrength: 1 }
const BASIC_CONTROLS = [
    ['exposure', 'Exposure', -3, 3, .05],
    ['contrast', 'Contrast', 0, 2.5, .05],
    ['saturation', 'Saturation', 0, 2.5, .05],
    ['temperature', 'Temperature', -1, 1, .05],
    ['tint', 'Tint', -1, 1, .05],
    ['shadows', 'Shadows', -1, 1, .05],
    ['highlights', 'Highlights', -1, 1, .05],
    ['curve', 'Tone Curve', .45, 1.8, .02],
]
const FX_CONTROLS = [
    ['grain', 'Film Grain', 0, 1, .01],
    ['vignette', 'Vignette', 0, 1, .01],
    ['bloom', 'Mist Bloom', 0, 1, .01],
    ['chroma', 'Chroma Shift', 0, 1, .01],
    ['posterize', 'Posterize', 0, 1, .01],
]
const EFFECT_PRESETS = [
    { id: 'none', label: 'Clean', params: {} },
    { id: 'fogwater', label: 'Fog on Water', params: { bloom: .55, grain: .28, vignette: .38, temperature: -.08 } },
    { id: 'edgemist', label: 'Edge Mist', params: { bloom: .72, vignette: .62, grain: .18 } },
    { id: 'heatwave', label: 'Heat Haze', params: { chroma: .42, grain: .2, temperature: .18 } },
    { id: 'colbloom', label: 'Colour Bloom', params: { bloom: .88, saturation: 1.55, grain: .12 } },
    { id: 'polaroid', label: 'Polaroid', params: { contrast: 1.12, temperature: .07, vignette: .28, grain: .22 } },
    { id: 'bleachby', label: 'Bleach Bypass', params: { contrast: 1.35, saturation: .62, vignette: .32 } },
    { id: 'noir', label: 'Film Noir', params: { saturation: 0, contrast: 1.28, vignette: .52, grain: .3 } },
]
const INITIAL_FX = { grain: 0, vignette: 0, bloom: 0, chroma: 0, posterize: 0 }
const INITIAL_CURVES = [[0, 0], [.25, .25], [.5, .5], [.75, .75], [1, 1]]

// ─── Sub-components ──────────────────────────────────────────────────────────
function Histogram({ src }) {
    const ref = useRef(null)
    useEffect(() => {
        if (!src || !ref.current) return
        const img = new Image()
        img.onload = () => {
            const c = ref.current, ctx = c.getContext('2d')
            c.width = 256; c.height = 76
            const sc = document.createElement('canvas'); sc.width = 96; sc.height = 96
            const s = sc.getContext('2d', { willReadFrequently: true })
            s.drawImage(img, 0, 0, 96, 96)
            const bins = [new Uint16Array(256), new Uint16Array(256), new Uint16Array(256)]
            const d = s.getImageData(0, 0, 96, 96).data
            for (let i = 0; i < d.length; i += 4) { bins[0][d[i]]++; bins[1][d[i + 1]]++; bins[2][d[i + 2]]++ }
            const max = Math.max(...bins.flatMap(b => Array.from(b)))
            ctx.clearRect(0, 0, 256, 76)
                ;[['#ef6b73', 0], ['#70cb91', 1], ['#6f9cff', 2]].forEach(([color, idx]) => {
                    ctx.beginPath()
                    for (let x = 0; x < 256; x++) { const y = 75 - (bins[idx][x] / max) * 72; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
                    ctx.strokeStyle = color; ctx.globalAlpha = .72; ctx.stroke()
                })
            ctx.globalAlpha = 1
        }
        img.src = src
    }, [src])
    return <canvas className="lt-histogram" ref={ref} aria-label="RGB histogram" />
}

function ToneCurve({ points, onChange }) {
    const [active, setActive] = useState(null)
    const update = e => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = Math.max(.02, Math.min(.98, (e.clientX - r.left) / r.width))
        const y = Math.max(.02, Math.min(.98, 1 - (e.clientY - r.top) / r.height))
        const idx = active ?? points.reduce((best, p, i) => Math.abs(p[0] - x) < Math.abs(points[best][0] - x) ? i : best, 0)
        const next = points.map((p, i) => i !== idx ? p : [
            i === 0 ? 0 : i === points.length - 1 ? 1 : Math.max(points[i - 1][0] + .02, Math.min(points[i + 1]?.[0] - .02 || .98, x)),
            i === 0 ? 0 : i === points.length - 1 ? 1 : y
        ])
        onChange(next)
    }
    const stop = () => setActive(null)
    const d = points.map((p, i) => `${i ? 'L' : 'M'} ${p[0] * 220} ${(1 - p[1]) * 140}`).join(' ')
    return (
        <svg className="lt-curve" viewBox="0 0 220 140"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setActive(points.reduce((b, p, i) => Math.abs(p[0] - e.nativeEvent.offsetX / 220) < Math.abs(points[b][0] - e.nativeEvent.offsetX / 220) ? i : b, 0)); update(e) }}
            onPointerMove={e => active !== null && update(e)}
            onPointerUp={stop} onPointerCancel={stop}>
            <path className="lt-curve-grid" d="M55 0V140M110 0V140M165 0V140M0 35H220M0 70H220M0 105H220" />
            <path className="lt-curve-line" d={d} />
            {points.map((p, i) => <circle key={i} cx={p[0] * 220} cy={(1 - p[1]) * 140} r={active === i ? 6 : 4} />)}
        </svg>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LightTable() {
    const { vpState, updateVpState, addImportedAssets, addElement, toast } = useVP()

    // Core state
    const [selected, setSelected] = useState(vpState.lightTableAsset || vpState.library?.imported?.[0] || null)
    const [params, setParams] = useState({ ...DEFAULTS })
    const [fx, setFx] = useState({ ...INITIAL_FX })
    const [curves, setCurves] = useState(INITIAL_CURVES)
    const [lut, setLut] = useState(null)
    const [tab, setTab] = useState('basic')
    const [activePreset, setActivePreset] = useState('none')

    // GPU / loop refs — NEVER call renderLightTable inside rAF
    const canvas = useRef(null)
    const image = useRef(new Image())
    const glRef = useRef(null)
    const progRef = useRef(null)
    const texRef = useRef(null)
    const frame = useRef(0)
    const needsAnimate = fx.bloom > 0 || fx.grain > 0  // only animate when animated fx are active

    // ── Build/rebuild GL context when canvas mounts ──
    const initGL = useCallback(() => {
        const c = canvas.current
        if (!c) return false
        const gl = c.getContext('webgl2')
        if (!gl) return false
        const prog = buildGLProgram(gl, VERT_SRC, FRAG_SRC)
        if (!prog) return false
        glRef.current = gl
        progRef.current = prog
        // Geometry
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        const pos = gl.getAttribLocation(prog, 'p')
        gl.enableVertexAttribArray(pos)
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
        // Texture
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
            ;[gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR))
            ;[gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE))
        texRef.current = tex
        return true
    }, [])

    // ── Upload image to GPU ──
    const uploadImage = useCallback(img => {
        const gl = glRef.current
        if (!gl || !img.naturalWidth) return
        gl.bindTexture(gl.TEXTURE_2D, texRef.current)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    }, [])

    // ── Draw one GPU frame ──
    const drawGPU = useCallback((time) => {
        const gl = glRef.current, prog = progRef.current, c = canvas.current, img = image.current
        if (!gl || !prog || !c || !img.naturalWidth) return
        const u = (n, v) => { const l = gl.getUniformLocation(prog, n); if (l !== null) gl.uniform1f(l, v) }
        gl.useProgram(prog)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texRef.current)
        gl.uniform1i(gl.getUniformLocation(prog, 'uSource'), 0)
        gl.uniform2f(gl.getUniformLocation(prog, 'uResolution'), c.width, c.height)
        gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), time / 1000)
        u('uExposure', params.exposure)
        u('uContrast', params.contrast)
        u('uSaturation', params.saturation)
        u('uTemperature', params.temperature)
        u('uTint', params.tint)
        u('uShadows', params.shadows)
        u('uHighlights', params.highlights)
        u('uCurve', params.curve)
        u('uGrain', fx.grain)
        u('uVignette', fx.vignette)
        u('uBloom', fx.bloom)
        u('uChroma', fx.chroma)
        u('uPosterize', fx.posterize)
        u('uEffectStrength', 1.0)
        gl.viewport(0, 0, c.width, c.height)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }, [params, fx])

    // ── Resize canvas and redraw ──
    const render = useCallback((time = 0) => {
        const c = canvas.current, img = image.current
        if (!c || !img.naturalWidth) return
        const scale = Math.min(1, 1400 / img.naturalWidth, 900 / img.naturalHeight)
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
        if (glRef.current && progRef.current) {
            drawGPU(time)
        } else {
            // CPU 2d fallback — only for the static draw, NEVER in an animation loop
            const ctx = c.getContext('2d')
            if (ctx) ctx.drawImage(img, 0, 0, w, h)
        }
    }, [drawGPU])

    // ── Animation loop — only runs when animated fx are active ──
    useEffect(() => {
        if (!needsAnimate) {
            cancelAnimationFrame(frame.current)
            return
        }
        const tick = (t) => { render(t); frame.current = requestAnimationFrame(tick) }
        frame.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame.current)
    }, [needsAnimate, render])

    // ── Static redraw on param change — CPU path only; NEVER in rAF ──
    useEffect(() => {
        if (!needsAnimate) render(performance.now())
    }, [params, fx, curves, lut, needsAnimate])

    // ── Image load ──
    useEffect(() => {
        if (!selected) return
        const img = image.current
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            if (!glRef.current) initGL()
            uploadImage(img)
            render(performance.now())
        }
        img.src = selected.src
    }, [selected, initGL, uploadImage, render])

    // ── Mount: init GL once canvas exists ──
    useEffect(() => { initGL() }, [initGL])

    // ─── Recipe for export / CPU render ──────────────────────────────────────
    const recipe = {
        params: { ...params, ...fx },
        curves,
        effects: Object.entries(fx).filter(([, v]) => v > 0).map(([id, strength]) => ({ id, strength, channel: 'all', mask: { low: 0, high: 1, feather: .1 } })),
        luts: lut ? [{ name: lut.name, size: lut.size, data: lut.data, strength: params.lutStrength }] : []
    }

    // ─── Actions ─────────────────────────────────────────────────────────────
    const pick = () => {
        const input = document.createElement('input')
        input.type = 'file'; input.multiple = true; input.accept = 'image/*'
        input.onchange = e => Promise.all([...e.target.files].map(file => new Promise(done => {
            const r = new FileReader()
            r.onload = x => done({ id: `imported-${Date.now()}-${file.name}`, name: file.name, src: x.target.result, kind: 'image', addedAt: new Date().toISOString() })
            r.readAsDataURL(file)
        }))).then(assets => { addImportedAssets(assets); setSelected(assets[0] || null); toast(`${assets.length} image${assets.length === 1 ? '' : 's'} added to library`, 'success') })
        input.click()
    }

    const applyPreset = (presetId) => {
        setActivePreset(presetId)
        const preset = EFFECT_PRESETS.find(p => p.id === presetId)
        if (!preset) return
        if (presetId === 'none') { setFx({ ...INITIAL_FX }); return }
        setFx(prev => ({ ...INITIAL_FX, ...preset.params }))
    }

    const save = () => {
        const c = canvas.current, img = image.current
        if (!c || !selected) return
        // CPU render for deterministic export
        const exportCanvas = document.createElement('canvas')
        renderLightTable(img, exportCanvas, recipe)
        const asset = {
            id: `lighttable-${Date.now()}`,
            name: `${selected.name || 'image'} — edited`,
            src: exportCanvas.toDataURL('image/jpeg', .94),
            kind: 'image',
            addedAt: new Date().toISOString(),
            recipe
        }
        addImportedAssets([asset])
        updateVpState({ lightTableAsset: asset })
        toast('Edited image saved to shared library', 'success')
    }

    const addLive = () => {
        if (!selected || !vpState.currentProject) return
        addElement(vpState.selection?.pageIdx || 0, { type: 'image', src: selected.src, x: 80, y: 80, width: 300, height: 220, objectFit: 'cover', lightTableRecipe: recipe })
        toast('Live Light Table recipe added to this spread', 'success')
    }

    const importLut = e => {
        const file = e.target.files?.[0]; if (!file) return
        const reader = new FileReader()
        reader.onload = () => { try { setLut(parseCube(reader.result, file.name)); toast('LUT imported', 'success') } catch (err) { toast(err.message, 'error') } }
        reader.readAsText(file)
    }
    const exportLut = () => { if (lut) downloadText(`${lut.name.replace(/\.cube$/i, '')}.cube`, cubeText(lut), 'text/plain') }
    const exportRecipe = () => downloadText(`${selected?.name || 'light-table'}-recipe.json`, JSON.stringify(recipe, null, 2), 'application/json')

    const back = () => updateVpState({ currentView: vpState.lightTableReturnView || 'dashboard', lightTableAsset: null, lightTableReturnView: null })

    const filmstrip = vpState.library?.imported || []

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="light-table lt-workspace">
            {/* Header */}
            <header className="lt-header">
                <button className="ed-tool" onClick={back}>← Library</button>
                <div className="lt-title">
                    <strong>Light Table</strong>
                    <span>Develop · grade · publish</span>
                </div>
                <div className="lt-header-actions">
                    <button className="ed-tool" onClick={pick}>Import</button>
                    {vpState.currentProject && <button className="ed-tool" disabled={!selected} onClick={addLive}>Place live</button>}
                    <button className="ed-tool primary" disabled={!selected} onClick={save}>Export snapshot</button>
                </div>
            </header>

            {/* Filmstrip */}
            <aside className="lt-library">
                <div className="lt-section-head"><span>Filmstrip</span><button onClick={pick}>+</button></div>
                <div className="lt-thumbs">
                    {filmstrip.map(a => (
                        <button key={a.id} className={selected?.id === a.id ? 'active' : ''} onClick={() => setSelected(a)}>
                            <img src={a.src} alt={a.name || ''} />
                        </button>
                    ))}
                </div>
                {!filmstrip.length && <p style={{ color: 'var(--vp-text-dim)', fontSize: '.75rem', marginTop: 8 }}>Import images to begin.</p>}
            </aside>

            {/* Canvas Stage */}
            <main className="lt-stage">
                <div className="lt-stage-toolbar">
                    <span>{selected?.name || 'No image selected'}</span>
                    <span>{selected ? `${image.current?.naturalWidth || 0}×${image.current?.naturalHeight || 0}` : ''} · RGB</span>
                </div>
                {selected
                    ? <canvas ref={canvas} />
                    : <div className="lt-empty">
                        <h2>Start with a photograph</h2>
                        <button className="ed-tool primary" style={{ marginTop: 12 }} onClick={pick}>Import images</button>
                    </div>
                }
            </main>

            {/* Controls panel */}
            <aside className="lt-controls">
                {/* Histogram */}
                <section className="lt-inspector">
                    <div className="lt-section-head"><span>Histogram</span><button onClick={() => { setParams({ ...DEFAULTS }); setFx({ ...INITIAL_FX }); setCurves(INITIAL_CURVES); setActivePreset('none') }}>Reset all</button></div>
                    <Histogram src={selected?.src} />
                </section>

                {/* Tab bar */}
                <section className="lt-inspector" style={{ paddingBottom: 0 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                        {[['basic', 'Basic'], ['fx', 'Effects'], ['curves', 'Curves'], ['lut', 'LUT']].map(([id, label]) => (
                            <button key={id} className={`ed-tool${tab === id ? ' active' : ''}`} style={{ flex: 1, padding: '5px 4px', fontSize: '.7rem' }} onClick={() => setTab(id)}>{label}</button>
                        ))}
                    </div>
                </section>

                {/* BASIC TAB */}
                {tab === 'basic' && <section className="lt-inspector">
                    <div className="lt-section-head"><span>Grade</span></div>
                    {BASIC_CONTROLS.map(([key, label, min, max, step]) => (
                        <label className="lt-control" key={key}>
                            <span>{label}<b>{Number(params[key]).toFixed(2)}</b></span>
                            <input type="range" min={min} max={max} step={step} value={params[key]}
                                onChange={e => setParams(o => ({ ...o, [key]: Number(e.target.value) }))} />
                        </label>
                    ))}
                </section>}

                {/* FX TAB */}
                {tab === 'fx' && <section className="lt-inspector">
                    <div className="lt-section-head"><span>Ethereal Presets</span></div>
                    <div className="lt-effects" style={{ marginBottom: 14 }}>
                        {EFFECT_PRESETS.map(p => (
                            <button key={p.id} className={activePreset === p.id ? 'active' : ''} onClick={() => applyPreset(p.id)}>{p.label}</button>
                        ))}
                    </div>
                    <div className="lt-section-head" style={{ marginTop: 8 }}><span>Effect Layers</span></div>
                    {FX_CONTROLS.map(([key, label, min, max, step]) => (
                        <label className="lt-control" key={key}>
                            <span>{label}<b>{Number(fx[key]).toFixed(2)}</b></span>
                            <input type="range" min={min} max={max} step={step} value={fx[key]}
                                onChange={e => setFx(o => ({ ...o, [key]: Number(e.target.value) }))} />
                        </label>
                    ))}
                </section>}

                {/* CURVES TAB */}
                {tab === 'curves' && <section className="lt-inspector">
                    <div className="lt-section-head"><span>Tone Curve</span><span>RGB</span></div>
                    <ToneCurve points={curves} onChange={setCurves} />
                    <p className="lt-help">Drag the curve nodes to shape tones.</p>
                </section>}

                {/* LUT TAB */}
                {tab === 'lut' && <section className="lt-inspector">
                    <div className="lt-section-head"><span>LUT</span><button onClick={exportLut} disabled={!lut}>Export .cube</button></div>
                    <label className="ed-tool file-btn" style={{ display: 'block', marginBottom: 8 }}>
                        {lut ? lut.name : 'Import .cube LUT'}
                        <input type="file" accept=".cube,text/plain" onChange={importLut} style={{ display: 'none' }} />
                    </label>
                    {lut && <label className="lt-control">
                        <span>LUT strength<b>{params.lutStrength.toFixed(2)}</b></span>
                        <input type="range" min="0" max="1" step=".01" value={params.lutStrength}
                            onChange={e => setParams(o => ({ ...o, lutStrength: Number(e.target.value) }))} />
                    </label>}
                    <button className="ed-tool" style={{ width: '100%', marginTop: 8 }} onClick={exportRecipe}>Export recipe JSON</button>
                </section>}
            </aside>
        </div>
    )
}
