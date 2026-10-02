/*
 * Lib: tiff16
 * Minimal uncompressed baseline TIFF writer for 16-bit RGB frames coming out
 * of the raw develop's print path. Keeping it dependency-free means the print
 * export works fully offline in the browser.
 */

const TAG_IMAGE_WIDTH = 256
const TAG_IMAGE_LENGTH = 257
const TAG_BITS_PER_SAMPLE = 258
const TAG_COMPRESSION = 259
const TAG_PHOTOMETRIC = 262
const TAG_STRIP_OFFSETS = 273
const TAG_SAMPLES_PER_PIXEL = 277
const TAG_ROWS_PER_STRIP = 278
const TAG_STRIP_BYTE_COUNTS = 279
const TAG_X_RESOLUTION = 282
const TAG_Y_RESOLUTION = 283
const TAG_PLANAR = 284
const TAG_RESOLUTION_UNIT = 296

/**
 * Build an uncompressed TIFF Blob from 16-bit interleaved RGB samples.
 * @param {number} width
 * @param {number} height
 * @param {Uint16Array} data RGB, width*height*3 samples
 * @returns {Blob} image/tiff
 */
export const buildTiff16 = (width, height, data, { dpi = 300 } = {}) => {
    const samplesPerPixel = 3
    const bitsPerSample = [16, 16, 16]
    const rowsPerStrip = height
    const stripByteCount = width * height * samplesPerPixel * 2

    // IFD: count(2) + entries(12 each) + nextIFD(4)
    const entryCount = 13
    const ifdOffset = 8
    const ifdSize = 2 + entryCount * 12 + 4
    // Overflow area for values that don't fit inline in the 4-byte value slot.
    const overflow = []
    const bitsPos = ifdOffset + ifdSize
    const bits = new Uint16Array(bitsPerSample)
    overflow.push({ at: bitsPos, bytes: new Uint8Array(bits.buffer) })
    const resPos = bitsPos + 6
    const resBytes = new Uint8Array(4 + 4)
    const resView = new DataView(resBytes.buffer)
    resView.setUint32(0, dpi, true); resView.setUint32(4, 1, true)
    overflow.push({ at: resPos, bytes: resBytes })
    overflow.push({ at: resPos + 8, bytes: resBytes.slice(0) })
    const headerOffset = resPos + 16
    const totalSize = headerOffset + stripByteCount

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)

    // Header: II, 42, IFD offset
    view.setUint16(0, 0x4949, true)
    view.setUint16(2, 42, true)
    view.setUint32(4, ifdOffset, true)

    const entries = []
    const addEntry = (tag, type, count, value) => entries.push({ tag, type, count, value })
    addEntry(TAG_IMAGE_WIDTH, 4, 1, width)
    addEntry(TAG_IMAGE_LENGTH, 4, 1, height)
    addEntry(TAG_BITS_PER_SAMPLE, 3, 3, bitsPos)
    addEntry(TAG_COMPRESSION, 3, 1, 1)
    addEntry(TAG_PHOTOMETRIC, 3, 1, 2) // RGB
    addEntry(TAG_STRIP_OFFSETS, 4, 1, headerOffset)
    addEntry(TAG_SAMPLES_PER_PIXEL, 3, 1, samplesPerPixel)
    addEntry(TAG_ROWS_PER_STRIP, 4, 1, rowsPerStrip)
    addEntry(TAG_STRIP_BYTE_COUNTS, 4, 1, stripByteCount)
    addEntry(TAG_X_RESOLUTION, 5, 1, resPos)
    addEntry(TAG_Y_RESOLUTION, 5, 1, resPos + 8)
    addEntry(TAG_PLANAR, 3, 1, 1)
    addEntry(TAG_RESOLUTION_UNIT, 3, 1, 2) // inches

    view.setUint16(ifdOffset, entries.length, true)
    entries.forEach((entry, i) => {
        const at = ifdOffset + 2 + i * 12
        view.setUint16(at, entry.tag, true)
        view.setUint16(at + 2, entry.type, true)
        view.setUint32(at + 4, entry.count, true)
        const size = entry.type === 3 ? 2 : entry.type === 5 ? 8 : 4
        const inline = size * entry.count <= 4
        if (inline) {
            if (entry.type === 3) view.setUint16(at + 8, entry.value, true)
            else view.setUint32(at + 8, entry.value, true)
        } else {
            view.setUint32(at + 8, entry.value, true) // offset into file
        }
    })
    view.setUint32(ifdOffset + 2 + entries.length * 12, 0, true)

    for (const { at, bytes } of overflow) new Uint8Array(buffer, at).set(bytes)

    // Pixel data: byte-swap 16-bit little-endian
    const out = new Uint16Array(buffer, headerOffset, stripByteCount / 2)
    out.set(data)

    return new Blob([buffer], { type: 'image/tiff' })
}
