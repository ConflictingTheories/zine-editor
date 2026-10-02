/*
 * Lib: rawDevelop
 * Full raw develop for Light Table. Decodes NEF/CR2/ARW/… through LibRaw
 * (WASM) with camera settings applied — exposure, white balance, demosaic
 * quality — instead of serving the baked-in JPEG preview.
 *
 * The decoded frame is returned as a JPEG data URL so the existing Light
 * Table pipeline (canvas, GPU renderer, analyseImage, renderRecipe export)
 * consumes it unchanged. Developed results are cached per asset+settings so
 * the light Table never re-decodes 36 MB on every slider tick.
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
 * Developed-image cache: assetId → { key, src }. Keyed by the develop
 * settings so a settings change (and only one) triggers a fresh decode.
 */
const cache = new Map()

export const DEFAULT_DEVELOP = Object.freeze({
    expShift: 1.0,      // exposure multiplier (linear), 0.25–4
    useCameraWb: true,  // camera white balance vs auto
    halfSize: true,     // 1/2-size output — the Light Table preview default
    userQual: 3         // demosaic quality 0–12 (3 ≈ AHD)
})

const settingsKey = (settings) => `${settings.expShift}|${settings.useCameraWb}|${settings.halfSize}|${settings.userQual}`

export const clearRawCache = (assetId) => cache.delete(assetId)

/**
 * Develop a raw asset. Returns a JPEG data URL of the developed frame, or
 * null when the raw bytes are unavailable (legacy record) or decode fails —
 * the caller should fall back to the embedded preview in that case.
 */
export const developRawAsset = async (asset, settings = DEFAULT_DEVELOP) => {
    if (!isRawAsset(asset)) return null
    const key = settingsKey(settings)
    const hit = cache.get(asset.id)
    if (hit?.key === key) return hit.src

    const blob = await getPhotoBlob(`raw:${asset.id}`)
    if (!blob) return null

    const raw = createLibRaw()
    try {
        await raw.open(new Uint8Array(await blob.arrayBuffer()), {
            expCorrec: settings.expShift !== 1,
            expShift: settings.expShift,
            useCameraWb: settings.useCameraWb,
            useAutoWb: !settings.useCameraWb,
            halfSize: settings.halfSize,
            userQual: settings.userQual,
            outputColor: 1,   // sRGB
            outputBps: 8,
            userFlip: -1      // honour the camera's orientation tag
        })
        const img = await raw.imageData()
        if (!img?.data || !img.width || !img.height) return null

        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        const imageData = ctx.createImageData(img.width, img.height)
        const src = img.data
        const channels = img.colors || 3
        for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += channels) {
            imageData.data[i] = src[j]
            imageData.data[i + 1] = channels > 1 ? src[j + 1] : src[j]
            imageData.data[i + 2] = channels > 2 ? src[j + 2] : src[j]
            imageData.data[i + 3] = 255
        }
        ctx.putImageData(imageData, 0, 0)
        const srcUrl = canvas.toDataURL('image/jpeg', 0.92)
        cache.set(asset.id, { key, src: srcUrl })
        return srcUrl
    } catch (err) {
        console.warn('[rawDevelop] decode failed:', err)
        return null
    } finally {
        raw.dispose()
    }
}
