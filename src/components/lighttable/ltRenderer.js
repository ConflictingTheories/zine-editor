/*
 * Module: ltRenderer
 * WebGL2 renderer for the Light Table preview. Owns the GL context, program,
 * textures and the uniform upload path, plus a CPU fallback for machines
 * without WebGL2. Nothing in here touches React.
 */

import {
    FRAGMENT_SOURCE,
    VERTEX_SOURCE,
    GRADE_DEFAULTS,
    FX_DEFAULTS,
    DEFAULT_RECIPE,
    bakeCurveLut,
    curveLutKey,
    curvesAreIdentity,
    renderRecipe
} from '../../lib/lightTableEngine.js'

function compileShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(`Light Table shader failed to compile: ${log}`)
    }
    return shader
}

export class LtRenderer {
    constructor(canvas) {
        this.canvas = canvas
        this.gl = null
        this.program = null
        this.texture = null
        this.lutTexture = null
        this.curveTexture = null
        this.uniforms = {}
        this.lutKey = null
        this.curveKey = null
        this.cpuCanvas = null
        this.mode = 'none'
    }

    get supported() {
        return this.mode === 'gpu'
    }

    init() {
        const gl = this.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })
        if (!gl) {
            this.mode = 'cpu'
            return false
        }
        // Probe before claiming the GPU. Headless Chrome ships WebGL2 but with
        // no GPU behind it, and asking for a context there can succeed and then
        // fail to compile or link. Whichever happens, the canvas has already
        // been bound to 'webgl2' and can never hand out a 2D context — so the
        // CPU fallback would get null and crash the view. Swapping in a canvas
        // that has only ever known 2D keeps the fallback honest.
        try {
            this.startGpu(gl)
        } catch (err) {
            console.warn('[LightTable] WebGL2 unavailable, using CPU render:', err.message)
            this.releaseGpu()
            this.adoptCpuCanvas()
            this.mode = 'cpu'
            return false
        }
        this.mode = 'gpu'
        return true
    }

    /** Build the program, buffers and textures. Throws on any GPU failure. */
    startGpu(gl) {
        const program = gl.createProgram()
            gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE))
            gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE))
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) || 'link failed')
            }
            this.gl = gl
            this.program = program

            // Full-screen triangle.
            const buffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
            const pos = gl.getAttribLocation(program, 'p')
            gl.enableVertexAttribArray(pos)
            gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

            this.texture = gl.createTexture()
            gl.bindTexture(gl.TEXTURE_2D, this.texture)
            for (const param of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) {
                gl.texParameteri(gl.TEXTURE_2D, param, gl.LINEAR)
            }
            for (const param of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) {
                gl.texParameteri(gl.TEXTURE_2D, param, gl.CLAMP_TO_EDGE)
            }

            this.lutTexture = gl.createTexture()
            gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
            for (const param of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) {
                gl.texParameteri(gl.TEXTURE_2D, param, gl.LINEAR)
            }
            for (const param of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) {
                gl.texParameteri(gl.TEXTURE_2D, param, gl.CLAMP_TO_EDGE)
            }

            this.curveTexture = gl.createTexture()
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, this.curveTexture)
            // A 1D curve needs NEAREST-independent linear filtering to hide the
            // sampling step, but CLAMP_TO_EDGE so 0 and 1 stay anchored.
            for (const param of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) {
                gl.texParameteri(gl.TEXTURE_2D, param, gl.LINEAR)
            }
            for (const param of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) {
                gl.texParameteri(gl.TEXTURE_2D, param, gl.CLAMP_TO_EDGE)
            }

            const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
            for (let i = 0; i < count; i++) {
                const info = gl.getActiveUniform(program, i)
                const name = info.name.replace(/\[0\]$/, '')
                this.uniforms[name] = gl.getUniformLocation(program, name)
            }

            gl.useProgram(program)
        gl.uniform1i(this.uniforms.uSource, 0)
        gl.uniform1i(this.uniforms.uLut, 1)
        gl.uniform1i(this.uniforms.uCurveLut, 2)
        this.programRef = program
        // Seed an identity curve so the first frame never samples garbage.
        this.uploadCurveLut({ curves: null })
    }

    /**
     * Replace the canvas with a 2D-only twin. React keeps its ref on the
     * original node, so the node is swapped in place — same tag, same
     * attributes, no attributes lost — and the ref is redirected to it.
     */
    adoptCpuCanvas() {
        const old = this.canvas
        if (!old || this.cpuCanvas) return
        if (old.getContext('2d')) return
        const fresh = document.createElement('canvas')
        for (const { name, value } of Array.from(old.attributes)) {
            try { fresh.setAttribute(name, value) } catch { /* skip */ }
        }
        old.replaceWith(fresh)
        this.canvas = fresh
        this.cpuCanvas = fresh
        this.onCanvasSwap?.(fresh)
    }

    releaseGpu() {
        const gl = this.gl
        this.gl = null
        this.program = null
        if (!gl) return
        try {
            if (this.texture) gl.deleteTexture(this.texture)
            if (this.lutTexture) gl.deleteTexture(this.lutTexture)
            if (this.curveTexture) gl.deleteTexture(this.curveTexture)
            if (this.programRef) gl.deleteProgram(this.programRef)
        } catch { /* context already lost */ }
        this.texture = null
        this.lutTexture = null
        this.curveTexture = null
        this.programRef = null
    }

    uploadImage(image) {
        const gl = this.gl
        if (!gl || !image?.naturalWidth) return
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    }

    uploadLut(lut) {
        const gl = this.gl
        if (!gl) return
        const key = lut ? `${lut.size}:${lut.data.length}` : null
        if (key === this.lutKey) return
        this.lutKey = key
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
        if (!lut || !lut.size || !lut.data?.length) return
        // Re-pack the linear LUT array into the 2D atlas the shader expects.
        const n = lut.size
        const data = new Uint8Array(n * n * n * 4)
        for (let b = 0; b < n; b++) {
            for (let g = 0; g < n; g++) {
                for (let r = 0; r < n; r++) {
                    const si = ((b * n + g) * n + r) * 3
                    const di = ((g * n) * n + r) * 4 + b * (n * n * 4)
                    data[di] = lut.data[si]
                    data[di + 1] = lut.data[si + 1]
                    data[di + 2] = lut.data[si + 2]
                    data[di + 3] = 255
                }
            }
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n * n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
        gl.activeTexture(gl.TEXTURE0)
    }

    /**
     * Upload the baked tone curve, but only when the curve actually changed.
     * A curve edit arrives as a React state change many times a second while a
     * point is being dragged, so keying on content keeps the GPU quiet.
     */
    uploadCurveLut(recipe) {
        const gl = this.gl
        if (!gl) return
        const key = curveLutKey(recipe)
        if (key === this.curveKey) return
        this.curveKey = key
        const { data, size } = bakeCurveLut(recipe)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, this.curveTexture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
        gl.activeTexture(gl.TEXTURE0)
    }

    /** Draw one frame. `time` drives the animated grain. */
    draw(recipe, time = 0) {
        if (this.mode !== 'gpu') return false
        const gl = this.gl, u = this.uniforms, c = this.canvas
        if (!gl || !c.width || !c.height) return false

        const p = { ...GRADE_DEFAULTS, ...(recipe?.params || {}) }
        const fx = { ...FX_DEFAULTS, ...(recipe?.fx || {}) }
        const geo = recipe?.geometry || DEFAULT_RECIPE.geometry
        const crop = geo.crop || [0, 0, 1, 1]

        gl.useProgram(this.program)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
        this.uploadLut(recipe?.lut)
        this.uploadCurveLut(recipe)

        gl.uniform2f(u.uResolution, c.width, c.height)
        gl.uniform1f(u.uTime, time / 1000)
        gl.uniform1f(u.uExposure, p.exposure)
        gl.uniform1f(u.uContrast, p.contrast)
        gl.uniform1f(u.uTemperature, p.temperature)
        gl.uniform1f(u.uTint, p.tint)
        gl.uniform1f(u.uHighlights, p.highlights)
        gl.uniform1f(u.uShadows, p.shadows)
        gl.uniform1f(u.uWhites, p.whites)
        gl.uniform1f(u.uBlacks, p.blacks)
        gl.uniform1f(u.uSaturation, p.saturation)
        gl.uniform1f(u.uVibrance, p.vibrance)
        gl.uniform1f(u.uClarity, p.clarity)
        gl.uniform1f(u.uDehaze, p.dehaze)
        gl.uniform1f(u.uFade, p.fade)
        gl.uniform1f(u.uGrain, fx.grain)
        gl.uniform1f(u.uVignette, fx.vignette)
        gl.uniform1f(u.uBloom, fx.bloom)
        gl.uniform1f(u.uHalation, fx.halation)
        gl.uniform1f(u.uChroma, fx.chroma)
        gl.uniform1f(u.uPosterize, fx.posterize)
        gl.uniform1f(u.uSplitTone, fx.splitTone)
        gl.uniform1f(u.uBw, recipe?.bw ? 1 : 0)
        gl.uniform1f(u.uZoom, geo.zoom ?? 1)
        gl.uniform1f(u.uRotate, geo.rotate || 0)
        gl.uniform2f(u.uFlip, geo.flipH ? -1 : 1, geo.flipV ? -1 : 1)
        gl.uniform4f(u.uCrop, crop[0], crop[1], crop[2], crop[3])
        gl.uniform1f(u.uLutSize, recipe?.lut?.size || 0)
        gl.uniform1f(u.uLutStrength, recipe?.lut ? (recipe.lutStrength ?? 1) : 0)

        // The curve pass is a texture fetch per pixel. When the curve is the
        // identity (the overwhelmingly common case) it is skipped entirely, so
        // a plain develop costs no more than it did before curves existed.
        gl.uniform1f(u.uCurveAmount, curvesAreIdentity(recipe) ? 0 : 1)

        gl.viewport(0, 0, c.width, c.height)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        return true
    }

    /** CPU fallback: render the recipe with the 2D pipeline instead. */
    drawCpu(image, recipe) {
        if (!image?.naturalWidth) return
        renderRecipe(image, this.canvas, recipe, { maxWidth: 1400, maxHeight: 1000 })
    }

    destroy() {
        try {
            this.releaseGpu()
        } catch { /* context already gone */ }
        this.mode = 'none'
    }
}
