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
    channelCurve,
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

// Pack 5 tone-curve points into the two vec4 uniforms the shader expects.
function packCurve(points) {
    const p = Array.isArray(points) && points.length >= 2 ? points : DEFAULT_RECIPE.curves.rgb
    const sorted = p.slice().sort((a, b) => a[0] - b[0])
    while (sorted.length < 5) sorted.push([sorted[sorted.length - 1][0] + 0.001, sorted[sorted.length - 1][1]])
    const first = sorted.slice(0, 5)
    return {
        x: new Float32Array([first[0][0], first[1][0], first[2][0], first[3][0]]),
        y: new Float32Array([first[0][1], first[1][1], first[2][1], first[3][1]])
    }
}

export class LtRenderer {
    constructor(canvas) {
        this.canvas = canvas
        this.gl = null
        this.program = null
        this.texture = null
        this.lutTexture = null
        this.uniforms = {}
        this.lutKey = null
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
        try {
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

            const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
            for (let i = 0; i < count; i++) {
                const info = gl.getActiveUniform(program, i)
                const name = info.name.replace(/\[0\]$/, '')
                this.uniforms[name] = gl.getUniformLocation(program, name)
            }

            gl.useProgram(program)
            gl.uniform1i(this.uniforms.uSource, 0)
            gl.uniform1i(this.uniforms.uLut, 1)
            this.mode = 'gpu'
            return true
        } catch (err) {
            console.warn('[LightTable] WebGL2 unavailable, using CPU render:', err.message)
            this.mode = 'cpu'
            return false
        }
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

        const rgb = packCurve(channelCurve(recipe, 'rgb'))
        gl.uniform4fv(u.uCurveX, rgb.x); gl.uniform4fv(u.uCurveY, rgb.y)
        const r = packCurve(channelCurve(recipe, 'r'))
        gl.uniform4fv(u.uCurveRX, r.x); gl.uniform4fv(u.uCurveRY, r.y)
        const g = packCurve(channelCurve(recipe, 'g'))
        gl.uniform4fv(u.uCurveGX, g.x); gl.uniform4fv(u.uCurveGY, g.y)
        const b = packCurve(channelCurve(recipe, 'b'))
        gl.uniform4fv(u.uCurveBX, b.x); gl.uniform4fv(u.uCurveBY, b.y)

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
        const gl = this.gl
        if (!gl) return
        gl.deleteTexture(this.texture)
        gl.deleteTexture(this.lutTexture)
        gl.deleteProgram(this.program)
        this.gl = null
        this.program = null
    }
}
