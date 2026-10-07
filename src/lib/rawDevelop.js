/*
 * Lib: rawDevelop
 * Full raw develop for Light Table. Decodes NEF/CR2/ARW/… through LibRaw
 * (WASM) with camera settings applied — exposure, white balance, demosaic
 * quality — instead of serving the baked-in JPEG preview.
 *
 * The decoded frame is returned as a JPEG data URL so the existing Light
 * Table pipeline (canvas, GPU renderer, analyseImage, renderRecipe export)
 * consumes it unchanged. Developed results are cached per asset+settings so
 * the Light Table never re-decodes 36 MB on every slider tick.
 */

import { getPhotoBlob } from './photoStore.js'

/**
 * Thin client for the LibRaw WASM worker. Vite 4's worker transform chokes
 * on the package's bundled `new Worker(new URL(...))`, so we serve the
 * (self-contained) worker straight from /public/libraw/ and speak its tiny
 * message protocol ourselves.
 */
class LibRawWorker {
    constructor() {
        this.worker = new Worker('/libraw/worker.js', { type: 'module' })
        this.pending = new Map()
        this.nextId = 0
        this.tail = Promise.resolve()
        this.disposed = false
        this.worker.onmessage = ({ data }) => {
            const entry = this.pending.get(data?.id)
            if (!entry) return
            this.pending.delete(data.id)
            data?.error ? entry.reject(new Error(data.error)) : entry.resolve(data?.out)
        }
    }
    dispose() {
        this.disposed = true
        this.worker.terminate()
        for (const { reject } of this.pending.values()) reject(new Error('LibRaw disposed'))
        this.pending.clear()
    }
    run(fn, ...args) {
        const next = () => new Promise((resolve, reject) => {
            if (this.disposed) return reject(new Error('LibRaw disposed'))
            const id = this.nextId++
            this.pending.set(id, { resolve, reject })
            const transfers = args
                .filter(a => ArrayBuffer.isView(a))
                .map(a => a.buffer)
            this.worker.postMessage({ id, fn, args }, transfers)
        })
        const result = this.tail.then(next, next)
        this.tail = result.then(() => {}, () => {})
        return result
    }
    open(bytes, settings) { return this.run('open', bytes, settings) }
    imageData() { return this.run('imageData') }
}

const createLibRaw = () => new LibRawWorker()

const RAW_FORMATS = new Set([
    'NEF', 'NRW', 'CR2', 'CR3', 'ARW', 'SRF', 'SR2', 'DNG', 'RAF', 'ORF',
    'RW2', 'PEF', 'SRW', '3FR', 'FFF', 'IIQ', 'RWL', 'X3F'
])

export const isRawAsset = (asset) => RAW_FORMATS.has(String(asset?.format || '').toUpperCase())

/**
 * Developed-image cache: assetId → { key, result }. Keyed by the full
 * settings object so a settings change (and only one) triggers a fresh
 * decode.
 */
const cache = new Map()

export const DEFAULT_DEVELOP = Object.freeze({
    expShift: 1.0,      // exposure multiplier (linear), 0.25–4
    useCameraWb: true,  // camera white balance vs auto
    halfSize: true,     // 1/2-size output — the Light Table preview default
    userQual: 3,        // demosaic quality 0–12 (3 ≈ AHD)
    userMul: null       // custom WB multipliers [r, g, b, g2] from a picked neutral
})

const normalise = (settings) => {
    const s = { ...DEFAULT_DEVELOP, ...(settings || {}) }
    if (s.userMul && !Array.isArray(s.userMul)) s.userMul = null
    return s
}

const settingsKey = (s) => JSON.stringify(s)

export const clearRawCache = (assetId) => {
    cache.delete(assetId + '|8')
    cache.delete(assetId + '|16')
}

const decodeRaw = async (blob, settings, bps) => {
    const raw = createLibRaw()
    try {
        const wbOverride = Boolean(settings.userMul)
        await raw.open(new Uint8Array(await blob.arrayBuffer()), {
            expCorrec: settings.expShift !== 1,
            expShift: settings.expShift,
            useCameraWb: !wbOverride && settings.useCameraWb,
            useAutoWb: !wbOverride && !settings.useCameraWb,
            userMul: wbOverride ? settings.userMul : null,
            halfSize: settings.halfSize,
            userQual: settings.userQual,
            outputColor: 1,   // sRGB
            outputBps: bps,
            userFlip: -1      // honour the camera's orientation tag
        })
        return await raw.imageData()
    } finally {
        raw.dispose()
    }
}

const toJpegDataUrl = (img) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(img.width, img.height)
    const src = img.data
    const channels = img.colors || 3
    const max = img.bits === 16 ? 65535 : 255
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += channels) {
        imageData.data[i] = src[j] / max * 255
        imageData.data[i + 1] = (channels > 1 ? src[j + 1] : src[j]) / max * 255
        imageData.data[i + 2] = (channels > 2 ? src[j + 2] : src[j]) / max * 255
        imageData.data[i + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
}

/**
 * Develop a raw asset. Returns a JPEG data URL of the developed frame, or
 * null when the raw bytes are unavailable (legacy record) or decode fails —
 * the caller should fall back to the embedded preview in that case.
 */
export const developRawAsset = async (asset, settings = DEFAULT_DEVELOP) => {
    if (!isRawAsset(asset)) return null
    const s = normalise(settings)
    const key = settingsKey(s) + '|8'
    const hit = cache.get(asset.id + '|8')
    if (hit?.key === key) return hit.src

    const blob = await getPhotoBlob(`raw:${asset.id}`)
    if (!blob) return null

    try {
        const img = await decodeRaw(blob, s, 8)
        if (!img?.data || !img.width || !img.height) return null
        const src = toJpegDataUrl(img)
        cache.set(asset.id + '|8', { key, src })
        return src
    } catch (err) {
        console.warn('[rawDevelop] decode failed:', err)
        return null
    }
}

const crop16 = (data, channels, width, height, crop) => {
    if (!crop) return { data, width, height }
    const x0 = Math.min(Math.max(0, Math.round(crop[0] * width)), width - 1)
    const y0 = Math.min(Math.max(0, Math.round(crop[1] * height)), height - 1)
    const x1 = Math.min(Math.max(x0 + 1, Math.round(crop[2] * width)), width)
    const y1 = Math.min(Math.max(y0 + 1, Math.round(crop[3] * height)), height)
    const outW = x1 - x0, outH = y1 - y0
    const out = new Uint16Array(outW * outH * channels)
    for (let y = 0; y < outH; y++) {
        const srcStart = ((y0 + y) * width + x0) * channels
        out.set(data.subarray(srcStart, srcStart + outW * channels), y * outW * channels)
    }
    return { data: out, width: outW, height: outH }
}

/**
 * 16-bit develop for the print pipeline. Returns the raw decoded frame
 * (Uint16Array, sRGB, camera WB/exposure applied) alongside a JPEG preview
 * URL, or null on failure. Nothing is tone-mapped or requantised to 8-bit
 * inside — that stays with the print colour management downstream.
 *
 * `crop` ([x0,y0,x1,y1] normalised, from the Geometry panel) is applied to
 * the 16-bit frame so the print export matches the staged crop. The grading
 * recipe itself is not baked in — apply it on top of the TIFF downstream.
 */
export const developRawAsset16 = async (asset, settings = DEFAULT_DEVELOP, crop = null) => {
    if (!isRawAsset(asset)) return null
    const s = normalise(settings)
    const key = settingsKey(s) + '|16|' + (crop ? crop.join(',') : 'none')
    const hit = cache.get(asset.id + '|16')
    if (hit?.key === key) return hit.result

    const blob = await getPhotoBlob(`raw:${asset.id}`)
    if (!blob) return null

    try {
        const img = await decodeRaw(blob, { ...s, halfSize: false }, 16)
        if (!img?.data || !img.width || !img.height) return null
        const cropped = crop16(img.data, img.colors || 3, img.width, img.height, crop)
        const result = {
            width: cropped.width,
            height: cropped.height,
            channels: img.colors || 3,
            data: cropped.data,            // Uint16Array, RGB interleaved
            previewSrc: toJpegDataUrl({ ...img, data: cropped.data, width: cropped.width, height: cropped.height })
        }
        cache.set(asset.id + '|16', { key, result })
        return result
    } catch (err) {
        console.warn('[rawDevelop] 16-bit decode failed:', err)
        return null
    }
}

/**
 * Convert a picked-neutral patch average into LibRaw custom WB multipliers.
 * The patch is sampled from the *displayed* preview, so the user picks a
 * neutral tone that the current grade already shows — multipliers are the
 * grey-world scale that would neutralise it.
 */
export const wbMultipliersFromPatch = (r, g, b) => {
    const lum = (r + g + b) / 3 || 1
    return [lum / (r || 1), lum / (g || 1), lum / (b || 1), lum / (g || 1)]
}
