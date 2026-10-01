/*
 * Tests: photoLibrary
 * The photography workflow's core logic — sorting, filtering, usage tracking
 * and frame geometry — is pure, so it is worth locking down. These are the
 * guarantees the UX promises: place without losing position, filter as a
 * library grows, and never overlap a new frame onto an existing one.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    selectPhotos,
    buildUsageIndex,
    assetOrientation,
    assetDimensionsLabel,
    createPhotoFrame,
    replaceFrameImage,
    findFreeSlot,
    fitAssetToBox,
    isEmptyFrame,
    getFramePreset,
    FRAME_PRESETS,
    alignToPage,
    fillPage,
    setFrameAspect
} from '../../../src/lib/photoLibrary.js'

const photo = (id, overrides = {}) => ({
    id,
    name: `${id}.jpg`,
    src: `data:image/jpeg;base64,${id}`,
    kind: 'image',
    addedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
})

test('sorts by recency, newest first, by default', () => {
    const assets = [
        photo('old', { addedAt: '2023-01-01T00:00:00.000Z' }),
        photo('new', { addedAt: '2025-01-01T00:00:00.000Z' })
    ]
    assert.deepEqual(selectPhotos(assets).map(a => a.id), ['new', 'old'])
    assert.deepEqual(selectPhotos(assets, { sort: 'oldest' }).map(a => a.id), ['old', 'new'])
})

test('searches filenames and tags', () => {
    const assets = [photo('a', { name: 'Harbour Dawn' }), photo('b', { name: 'Studio', tags: ['portrait'] })]
    assert.deepEqual(selectPhotos(assets, { query: 'harbour' }).map(a => a.id), ['a'])
    assert.deepEqual(selectPhotos(assets, { query: 'portrait' }).map(a => a.id), ['b'])
})

test('classifies orientation from intrinsic dimensions', () => {
    assert.equal(assetOrientation(photo('l', { width: 4000, height: 3000 })), 'landscape')
    assert.equal(assetOrientation(photo('p', { width: 3000, height: 4000 })), 'portrait')
    assert.equal(assetOrientation(photo('s', { width: 3000, height: 3000 })), 'square')
    assert.equal(assetOrientation(photo('u')), 'unknown')
})

test('reports megapixels alongside dimensions for large files', () => {
    const label = assetDimensionsLabel(photo('l', { width: 6000, height: 4000 }))
    assert.match(label, /6000 × 4000/)
    assert.match(label, /24\.0 MP/)
})

test('counts placements by asset id and by source for legacy elements', () => {
    const asset = photo('a1')
    const project = {
        pages: [
            { elements: [{ id: 'e1', type: 'photo-frame', assetId: 'a1', src: asset.src }] },
            { elements: [{ id: 'e2', type: 'photo-frame', src: asset.src }] }, // placed before linking
            { elements: [{ id: 'e3', type: 'image', src: 'data:image/jpeg;base64,other' }] }
        ]
    }
    const { usage } = buildUsageIndex(project, [asset, photo('a2')])
    assert.equal(usage.a1.count, 2)
    assert.equal(usage.a1.placements.length, 2)
    assert.equal(usage.a2, undefined)
})

test('filters to photographs not yet placed in the book', () => {
    const placed = photo('a1')
    const loose = photo('a2')
    const project = { pages: [{ elements: [{ id: 'e1', type: 'photo-frame', assetId: 'a1', src: placed.src }] }] }
    const usageIndex = buildUsageIndex(project, [placed, loose])

    const unused = selectPhotos([placed, loose], { filter: 'unused', usageIndex })
    assert.deepEqual(unused.map(a => a.id), ['a2'])

    const used = selectPhotos([placed, loose], { filter: 'used', usageIndex })
    assert.deepEqual(used.map(a => a.id), ['a1'])
})

test('flags favourites and portraits as first-class filters', () => {
    const assets = [
        photo('fav', { favorite: true }),
        photo('flag', { flagged: true }),
        photo('p', { width: 2000, height: 3000 })
    ]
    assert.deepEqual(selectPhotos(assets, { filter: 'favorites' }).map(a => a.id), ['fav'])
    assert.deepEqual(selectPhotos(assets, { filter: 'flagged' }).map(a => a.id), ['flag'])
    assert.deepEqual(selectPhotos(assets, { filter: 'portrait' }).map(a => a.id), ['p'])
})

test('sorts by most used when a usage index is supplied', () => {
    const a = photo('a1')
    const b = photo('a2')
    const project = {
        pages: [{
            elements: [
                { id: 'e1', type: 'photo-frame', assetId: 'a1', src: a.src },
                { id: 'e2', type: 'photo-frame', assetId: 'a1', src: a.src }
            ]
        }]
    }
    const usageIndex = buildUsageIndex(project, [a, b])
    assert.deepEqual(selectPhotos([a, b], { sort: 'used', usageIndex }).map(x => x.id), ['a1', 'a2'])
})

test('excludes audio from the photo library', () => {
    const assets = [photo('img'), { id: 'snd', kind: 'audio', src: 'data:audio/wav;base64,x' }]
    assert.deepEqual(selectPhotos(assets).map(a => a.id), ['img'])
})

test('fits an image to a box, cropping the long axis when filling', () => {
    const landscape = photo('l', { width: 4000, height: 2000 }) // 2:1
    const cover = fitAssetToBox(landscape, 200, 200, 'cover')
    assert.equal(cover.height, 200)
    assert.equal(cover.width, 400) // overflows horizontally to fill

    const contain = fitAssetToBox(landscape, 200, 200, 'contain')
    assert.equal(contain.width, 200)
    assert.equal(contain.height, 100)
})

test('returns null sizing when the asset dimensions are unknown', () => {
    assert.equal(fitAssetToBox(photo('u'), 200, 200, 'cover'), null)
})

test('creates a frame carrying the asset link and preset styling', () => {
    const asset = photo('a1')
    const frame = createPhotoFrame({ asset, x: 10, y: 20, width: 300, height: 300, presetId: 'black-mat' })

    assert.equal(frame.type, 'photo-frame')
    assert.equal(frame.src, asset.src)
    assert.equal(frame.assetId, 'a1')
    assert.equal(frame.framePreset, 'black-mat')
    assert.equal(frame.frameColor, getFramePreset('black-mat').style.frameColor)
    assert.equal(isEmptyFrame(frame), false)
})

test('an empty frame is recognised so it can be filled or clicked', () => {
    const frame = createPhotoFrame({ width: 200, height: 200 })
    assert.equal(frame.src, undefined)
    assert.equal(isEmptyFrame(frame), true)
})

test('replacing an image preserves every frame property', () => {
    const original = createPhotoFrame({
        asset: photo('a1'),
        width: 300,
        height: 400,
        presetId: 'mat-asymmetric',
        caption: 'First'
    })
    const swapped = replaceFrameImage(original, photo('a2'))

    assert.equal(swapped.src, 'data:image/jpeg;base64,a2')
    assert.equal(swapped.assetId, 'a2')
    // Position, size, mat and caption must survive — this is the guarantee
    // behind "replace the image without redoing the layout".
    assert.equal(swapped.x, original.x)
    assert.equal(swapped.y, original.y)
    assert.equal(swapped.width, original.width)
    assert.equal(swapped.height, original.height)
    assert.equal(swapped.frameWidth, original.frameWidth)
    assert.equal(swapped.frameWidthBottom, original.frameWidthBottom)
    assert.equal(swapped.frameColor, original.frameColor)
    assert.equal(swapped.caption, 'First')
})

test('finds an empty slot rather than stacking on an occupied cell', () => {
    const first = findFreeSlot([], { pageWidth: 528, pageHeight: 816 })
    const second = findFreeSlot([{ x: first.x, y: first.y, width: first.width, height: first.height }],
        { pageWidth: 528, pageHeight: 816 })

    assert.notDeepEqual([second.x, second.y], [first.x, first.y])
    // Must sit inside the page with the margin respected.
    assert.ok(second.x >= 0 && second.y >= 0)
    assert.ok(second.x + second.width <= 528)
    assert.ok(second.y + second.height <= 816)
})

test('a full page falls back to a staggered slot below the content', () => {
    const covering = [{ x: 0, y: 0, width: 528, height: 816 }]
    const slot = findFreeSlot(covering, { pageWidth: 528, pageHeight: 816 })
    assert.ok(Number.isFinite(slot.x) && Number.isFinite(slot.y))
    assert.ok(slot.width > 0 && slot.height > 0)
    // The scan must terminate — the fallback sits below the existing content.
    assert.ok(slot.y >= 816)
})

test('narrows to a single shoot and matches shoot names in the search', () => {
    const assets = [
        photo('a', { shoot: '2024-05-Paris' }),
        photo('b', { shoot: '2024-06-Berlin' }),
        photo('c', { shoot: '2024-05-Paris' })
    ]
    assert.deepEqual(selectPhotos(assets, { shoot: '2024-05-Paris' }).map(a => a.id).sort(), ['a', 'c'])
    // A photographer should be able to type the shoot to find the frame.
    assert.deepEqual(selectPhotos(assets, { query: 'berlin' }).map(a => a.id), ['b'])
})

test('separates final selects and rejects from the rest of the library', () => {
    const assets = [
        photo('picks', { rating: 3 }),
        photo('no', { rating: 1 }),
        photo('unrated')
    ]
    assert.deepEqual(selectPhotos(assets, { filter: 'picks' }).map(a => a.id), ['picks'])
    assert.deepEqual(selectPhotos(assets, { filter: 'rejected' }).map(a => a.id), ['no'])
})

test('identifies developed photographs without opening them', () => {
    const assets = [photo('graded', { recipe: { exposure: 0.2 } }), photo('raw')]
    assert.deepEqual(selectPhotos(assets, { filter: 'developed' }).map(a => a.id), ['graded'])
})

test('aligning a frame to a page edge never changes its size', () => {
    const frame = { x: 10, y: 20, width: 300, height: 200 }
    const right = alignToPage(frame, { pageWidth: 1000, pageHeight: 800 }, 'right')
    assert.equal(right.x, 700)
    assert.equal(right.width, 300)
    assert.equal(right.y, 20)

    const bottom = alignToPage(frame, { pageWidth: 1000, pageHeight: 800 }, 'bottom')
    assert.equal(bottom.y, 600)
    assert.equal(bottom.height, 200)
})

test('centring a frame puts it in the middle of the page', () => {
    const centre = alignToPage({ x: 0, y: 0, width: 200, height: 400 }, { pageWidth: 1000, pageHeight: 800 }, 'center-h')
    assert.equal(centre.x, 400)
})

test('filling the page bleeds an element to all four edges', () => {
    const full = fillPage({ x: 5, y: 5, width: 100, height: 100 }, { pageWidth: 1000, pageHeight: 800 })
    assert.deepEqual([full.x, full.y, full.width, full.height], [0, 0, 1000, 800])
})

test('cropping to a shape shrinks only the axis that is too long', () => {
    const frame = { x: 0, y: 0, width: 400, height: 200 }
    // A 2:1 box forced square keeps its height and narrows — the crop takes
    // from the long axis, so the frame never grows past what was placed.
    const square = setFrameAspect(frame, 1)
    assert.equal(square.width, 200)
    assert.equal(square.height, 200)

    // Forcing it taller than it is wide does the same to the other axis.
    const tall = setFrameAspect(frame, 1 / 2)
    assert.equal(tall.width, 100)
    assert.equal(tall.height, 200)
})

test('a malformed aspect ratio leaves the frame untouched', () => {
    const frame = { x: 0, y: 0, width: 400, height: 200 }
    assert.equal(setFrameAspect(frame, 0), frame)
    assert.equal(setFrameAspect(null, 1), null)
})

test('every mount preset is complete enough to restore a saved project', () => {
    assert.ok(FRAME_PRESETS.length >= 10)
    FRAME_PRESETS.forEach(preset => {
        assert.ok(preset.id && preset.name && preset.hint, `preset ${preset.id} needs id/name/hint`)
        assert.ok(preset.style.frameStyle, `preset ${preset.id} needs a frameStyle`)
        assert.equal(typeof preset.style.frameColor, 'string')
        assert.equal(typeof preset.style.frameBorderWidth, 'number')
        // A preset the user picks must survive a save/load round trip, so its
        // keys are plain data rather than anything non-serialisable.
        JSON.parse(JSON.stringify(preset))
    })
})

test('getFramePreset falls back to a usable preset for an unknown id', () => {
    const fallback = getFramePreset('does-not-exist')
    assert.ok(fallback && fallback.id && fallback.style)
})
