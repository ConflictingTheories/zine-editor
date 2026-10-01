/*
 * Component: PhotoLibrary
 * The photographer's main tool for working through a shoot. A sortable,
 * filterable grid of library photos with multi-select, quick actions and
 * drag-and-drop straight onto a spread or an existing frame.
 *
 * Three rules shape this component, all of them learned from working with
 * libraries of hundreds to thousands of files:
 *
 *   1. Importing never obliges you to place. Photos land in the library and
 *      stay there; composition is a separate, later act.
 *   2. Rendering is bounded. The grid only mounts a window of thumbnails, so a
 *      2000-photo library scrolls as smoothly as a 20-photo one.
 *   3. Sorting and filtering are the primary controls, not secondary ones, so
 *      they sit above the grid and stay put.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVP } from '../../context/VPContext.jsx'
import {
    SORT_OPTIONS,
    FILTER_OPTIONS,
    selectPhotos,
    buildUsageIndex,
    assetDimensionsLabel,
    assetLabel,
    createPhotoFrame,
    findFreeSlot,
    fitAssetToBox
} from '../../lib/photoLibrary.js'
import { filesToAssets, commitAssets } from '../../utils/photoImport.js'
import { PAGE_W, PAGE_H } from '../../constants.js'

/**
 * How many thumbnails to mount per batch. The grid grows this as the user
 * scrolls toward the end, so opening a large library is O(batch) rather than
 * O(library).
 */
const BATCH_SIZE = 60

/**
 * Thumb density. Reviewing a large shoot is a scanning task, so the user
 * chooses the trade-off between "enough photos per screen to see the rhythm"
 * and "big enough to judge a frame". Compact is the default because a
 * photographer with 2000 images rarely needs 150px of each one.
 */
const DENSITIES = [
    { id: 'comfortable', label: 'Large', min: 150 },
    { id: 'default', label: 'Medium', min: 118 },
    { id: 'compact', label: 'Small', min: 84 }
]

function PhotoLibrary({ page, pageIdx, selectedElement, compact = false }) {
    const {
        vpState,
        addImportedAssetsWithRoom,
        toggleAssetFlag,
        updateImportedAsset,
        removeImportedAssets,
        addElement,
        replaceElementImage,
        openLightTableFor,
        toast
    } = useVP()

    const assets = vpState.library?.imported || []
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('all')
    const [sort, setSort] = useState('recent')
    const [shoot, setShoot] = useState('all')
    const [selected, setSelected] = useState(() => new Set())
    const [importing, setImporting] = useState(0)
    const [activeDrop, setActiveDrop] = useState(false)
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
    const [density, setDensity] = useState('compact')
    const [cursor, setCursor] = useState(-1)
    const inputRef = useRef(null)
    const folderRef = useRef(null)
    const gridRef = useRef(null)

    const usageIndex = useMemo(() => buildUsageIndex(vpState.currentProject, assets), [vpState.currentProject, assets])
    const photos = useMemo(
        () => selectPhotos(assets, { query, filter, sort, shoot, usageIndex }),
        [assets, query, filter, sort, shoot, usageIndex]
    )
    const shown = useMemo(() => photos.slice(0, visibleCount), [photos, visibleCount])

    // Every shoot found in the library. `shootFromFile` captures the
    // containing folder, so a photographer's shoots separate themselves
    // without any manual filing.
    const shoots = useMemo(() => {
        const names = []
        assets.forEach(asset => {
            const name = asset?.shoot
            if (name && !names.includes(name)) names.push(name)
        })
        return names.sort()
    }, [assets])

    // A new import or a filter change invalidates how much is on screen, so
    // start from the first batch again rather than showing a stale window.
    useEffect(() => { setVisibleCount(BATCH_SIZE) }, [query, filter, sort, shoot, photos.length])

    const densityMin = DENSITIES.find(d => d.id === density)?.min || 118

    // ── Import ──────────────────────────────────────────────────────────────
    /**
     * Import straight into the library without placing anything. A shoot can
     * be hundreds of files, so the photos appear immediately and the pixel
     * work (blob store + thumbnail) happens off the critical path — the user
     * can start arranging before every import has settled.
     */
    const importPhotos = useCallback(async (files) => {
        const list = Array.from(files || []).filter(file => file?.type?.startsWith('image/'))
        if (!list.length) return
        setImporting(list.length)
        try {
            const created = await filesToAssets(list)
            if (!created.length) return
            // Show them at once (still data URLs) so the grid is never empty
            // mid-import, then swap in object URLs once they are on disk.
            addImportedAssetsWithRoom(created)
            toast(`${created.length} photo${created.length === 1 ? '' : 's'} in the library — place them when ready`, 'success')
            const settled = await commitAssets(created)
            addImportedAssetsWithRoom(settled)
        } catch {
            toast('Some photographs could not be imported', 'error')
        } finally {
            setImporting(0)
        }
    }, [addImportedAssetsWithRoom, toast])

    // ── Placement ───────────────────────────────────────────────────────────
    /**
     * Place photos onto the spread. When a frame is selected the first photo
     * replaces its image in place (keeping position, mat and caption) and the
     * rest are laid out around it.
     */
    const placePhotos = useCallback((list, { targetFrame = null } = {}) => {
        if (!list.length || pageIdx == null) return
        const landscape = page?.orientation === 'landscape'
        const w = landscape ? PAGE_H : PAGE_W
        const h = landscape ? PAGE_W : PAGE_H

        const first = list[0]
        if (targetFrame) {
            replaceElementImage(pageIdx, targetFrame.id, first)
            if (list.length === 1) {
                toast('Image replaced — frame, mat and position kept', 'success')
                return
            }
        }

        const rest = targetFrame ? list.slice(1) : list
        const elements = []
        // Work on a running copy so multiple photos tile instead of stacking.
        const working = [...(page?.elements || [])]
        rest.forEach((asset, index) => {
            const slot = findFreeSlot(working, { pageWidth: w, pageHeight: h, columns: 2 })
            const sized = fitAssetToBox(asset, slot.width, slot.height, 'cover') || slot
            const element = createPhotoFrame({
                asset,
                x: slot.x,
                y: slot.y,
                width: sized.width,
                height: sized.height,
                presetId: 'mat',
                zIndex: (page?.elements?.length || 0) + index
            })
            working.push(element)
            elements.push(element)
        })
        if (elements.length) addElement(pageIdx, elements.length > 1 ? elements : elements[0])
        toast(elements.length
            ? `${elements.length} photo${elements.length === 1 ? '' : 's'} placed`
            : 'Image replaced', 'success')
    }, [page, pageIdx, addElement, replaceElementImage, toast])

    const selectedTarget = selectedElement?.type === 'photo-frame' ? selectedElement : null

    const placeOne = (asset) => placePhotos([asset], { targetFrame: selectedTarget })
    const placeSelected = () => {
        // Preserve the current sort order when placing, so "select 5, place"
        // puts them on the spread in the sequence the photographer is looking at.
        const list = photos.filter(asset => selected.has(asset.id))
        if (!list.length) {
            toast('Select some photos first', 'info')
            return
        }
        placePhotos(list, { targetFrame: selectedTarget })
        setSelected(new Set())
    }

    // ── Drag & drop ─────────────────────────────────────────────────────────
    const handleDragStart = (event, asset) => {
        event.dataTransfer.setData('application/x-svrn-asset', asset.id)
        event.dataTransfer.setData('text/plain', asset.src)
        event.dataTransfer.effectAllowed = 'copy'
    }

    const handleDropOnTray = (event) => {
        event.preventDefault()
        setActiveDrop(false)
        const files = event.dataTransfer.files
        if (files?.length) { importPhotos(files); return }
        const assetId = event.dataTransfer.getData('application/x-svrn-asset')
        if (assetId) {
            const asset = assets.find(item => item.id === assetId)
            if (asset) placeOne(asset)
        }
    }

    // ── Selection helpers ───────────────────────────────────────────────────
    const toggleSelected = (assetId, { range = false } = {}) => {
        setSelected(prev => {
            const next = new Set(prev)
            const index = photos.findIndex(asset => asset.id === assetId)
            if (range && cursor >= 0 && index >= 0) {
                // Shift-click selects the run between the last click and here,
                // which is how you grab a stretch of a contact sheet.
                const [from, to] = cursor < index ? [cursor, index] : [index, cursor]
                photos.slice(from, to + 1).forEach(asset => next.add(asset.id))
            } else if (next.has(assetId)) next.delete(assetId)
            else next.add(assetId)
            return next
        })
        setCursor(photos.findIndex(asset => asset.id === assetId))
    }

    const selectAllVisible = () => setSelected(new Set(photos.map(asset => asset.id)))
    const clearSelected = () => setSelected(new Set())

    const quickFlag = (asset, event) => {
        event.stopPropagation()
        if (event.shiftKey) toggleAssetFlag(asset.id, 'flagged')
        else toggleAssetFlag(asset.id, 'favorite')
    }

    const rateAsset = (asset, rating) => updateImportedAsset(asset.id, { rating })

    const gradeAsset = (asset, event) => {
        event?.stopPropagation?.()
        openLightTableFor({ assetId: asset.id, name: asset.name })
    }

    // ── Combing through a shoot ─────────────────────────────────────────────
    /**
     * Light-table style keyboard review: arrows move a focus cursor, space
     * toggles selection, Enter places, D develops. Reviewing 800 frames by
     * clicking each one is the thing this whole workspace exists to avoid.
     */
    const onGridKeyDown = (event) => {
        if (!photos.length) return
        const columns = Math.max(1, Math.floor((gridRef.current?.clientWidth || 300) / (densityMin + 8)))
        const move = (delta) => {
            event.preventDefault()
            setCursor(prev => {
                const next = Math.min(Math.max((prev < 0 ? -1 : prev) + delta, 0), photos.length - 1)
                gridRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
                return next
            })
        }
        switch (event.key) {
            case 'ArrowRight': move(1); break
            case 'ArrowLeft': move(-1); break
            case 'ArrowDown': move(columns); break
            case 'ArrowUp': move(-columns); break
            case ' ':
                event.preventDefault()
                if (cursor >= 0) toggleSelected(photos[cursor].id)
                break
            case 'Enter':
                event.preventDefault()
                if (cursor >= 0) placeOne(photos[cursor])
                break
            case 'd':
            case 'D':
                if (cursor >= 0) { event.preventDefault(); gradeAsset(photos[cursor]) }
                break
            case 'a':
            case 'A':
                event.preventDefault()
                selectAllVisible()
                break
            case 'Escape':
                clearSelected()
                break
            default: break
        }
    }

    // Grow the mounted window as the user reaches the end of the grid.
    const onGridScroll = (event) => {
        const el = event.currentTarget
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 400) return
        setVisibleCount(count => (count >= photos.length ? count : count + BATCH_SIZE))
    }

    const countLabel = importing
        ? `importing ${importing}…`
        : `${photos.length} of ${assets.length}`

    return (
        <div
            className={`pf-library ${compact ? 'compact' : ''} ${activeDrop ? 'drop-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setActiveDrop(true) }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setActiveDrop(false) }}
            onDrop={handleDropOnTray}
        >
            <div className="pf-library-head">
                <div className="pf-library-title">
                    <h4>Library</h4>
                    <span className="pf-library-count">{countLabel}</span>
                </div>
                <input
                    className="pf-library-search"
                    type="search"
                    value={query}
                    placeholder="Search filenames, shoots or tags…"
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            <div className="pf-library-controls">
                <label className="pf-select">
                    <span>Show</span>
                    <select value={filter} onChange={e => setFilter(e.target.value)}>
                        {FILTER_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                </label>
                <label className="pf-select">
                    <span>Order</span>
                    <select value={sort} onChange={e => setSort(e.target.value)}>
                        {SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                </label>
                {shoots.length > 1 && (
                    <label className="pf-select">
                        <span>Shoot</span>
                        <select value={shoot} onChange={e => setShoot(e.target.value)}>
                            <option value="all">All shoots</option>
                            {shoots.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </label>
                )}
                <div className="pf-density" role="group" aria-label="Thumbnail size">
                    {DENSITIES.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            title={`${option.label} thumbnails`}
                            aria-pressed={density === option.id}
                            className={`pf-density-btn ${density === option.id ? 'active' : ''}`}
                            onClick={() => setDensity(option.id)}
                        >
                            <span className={`pf-density-glyph is-${option.id}`} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="pf-library-actions">
                <button type="button" className="pf-btn" onClick={() => (inputRef.current?.click())}>+ Import</button>
                <button type="button" className="pf-btn" onClick={() => (folderRef.current?.click())} title="Choose a folder of photographs">Folder…</button>
                <span className="pf-spacer" />
                <button type="button" className="pf-btn ghost" onClick={selectAllVisible} disabled={!photos.length}>Select all</button>
                {selected.size > 0 && <button type="button" className="pf-btn ghost" onClick={clearSelected}>Clear</button>}
                <button type="button" className="pf-btn primary" onClick={placeSelected} disabled={!selected.size}>
                    {selectedTarget ? `Replace + place ${selected.size}` : `Place ${selected.size}`}
                </button>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => { importPhotos(e.target.files); e.target.value = '' }}
            />
            <input
                ref={folderRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                webkitdirectory=""
                directory=""
                onChange={e => { importPhotos(e.target.files); e.target.value = '' }}
            />

            {selectedTarget && (
                <p className="pf-library-hint">
                    Placing replaces the image in your selected frame and keeps its size, mat and position.
                </p>
            )}

            <div
                className="pf-library-grid"
                style={{ '--thumb-min': `${densityMin}px` }}
                ref={gridRef}
                tabIndex={0}
                role="listbox"
                aria-label="Photo library"
                aria-activedescendant={cursor >= 0 && photos[cursor] ? `pf-photo-${photos[cursor].id}` : undefined}
                onKeyDown={onGridKeyDown}
                onScroll={onGridScroll}
            >
                {shown.map(asset => {
                    const use = usageIndex.usage[asset.id]?.count || 0
                    const index = photos.indexOf(asset)
                    const isSelected = selected.has(asset.id)
                    return (
                        <div
                            key={asset.id}
                            id={`pf-photo-${asset.id}`}
                            role="option"
                            aria-selected={isSelected}
                            className={`pf-thumb ${isSelected ? 'selected' : ''} ${index === cursor ? 'cursor' : ''}`}
                            draggable
                            onDragStart={e => handleDragStart(e, asset)}
                            onClick={e => toggleSelected(asset.id, { range: e.shiftKey })}
                            onDoubleClick={() => placeOne(asset)}
                            title={`${assetLabel(asset)}\n${assetDimensionsLabel(asset)}\nClick to select · double-click to place`}
                        >
                            {/* The thumbnail is what a grid of a thousand photos
                                should draw; the full file loads on demand. */}
                            <img src={asset.thumb || asset.src} alt={assetLabel(asset)} loading="lazy" decoding="async" />
                            <div className="pf-thumb-meta">
                                <span className="pf-thumb-name">{assetLabel(asset)}</span>
                                <span className="pf-thumb-dims">{assetDimensionsLabel(asset)}</span>
                            </div>
                            <div className="pf-thumb-badges">
                                {asset.rating === 3 && <span className="pf-pick-badge" title="Final select">★</span>}
                                {asset.rating === 1 && <span className="pf-reject-badge" title="Rejected">⊘</span>}
                                {asset.favorite && <span title="Favourite">♥</span>}
                                {asset.flagged && <span title="Needs work">⚑</span>}
                                {asset.recipe && <span title="Developed">◐</span>}
                                {use > 0 && <span className="pf-used" title={`Placed ${use}×`}>{use}×</span>}
                            </div>
                            <div className="pf-thumb-tools">
                                <button
                                    type="button"
                                    title="Final select (1) · reject (2)"
                                    className="pf-rate"
                                    onClick={e => {
                                        e.stopPropagation()
                                        rateAsset(asset, asset.rating === 1 ? 0 : 1)
                                    }}
                                >
                                    {asset.rating === 1 ? '⊘' : '✕'}
                                </button>
                                <button
                                    type="button"
                                    title="Final select (3)"
                                    className={`pf-rate ${asset.rating === 3 ? 'is-pick' : ''}`}
                                    onClick={e => {
                                        e.stopPropagation()
                                        rateAsset(asset, asset.rating === 3 ? 0 : 3)
                                    }}
                                >
                                    ★
                                </button>
                                <button type="button" title="Favourite" onClick={e => quickFlag(asset, e)}>♥</button>
                                <button type="button" title="Needs work" onClick={e => quickFlag(asset, e)}>⚑</button>
                                <button type="button" title="Develop in Light Table" onClick={e => gradeAsset(asset, e)}>◐</button>
                            </div>
                        </div>
                    )
                })}

                {photos.length > shown.length && (
                    <div className="pf-library-more">
                        Showing {shown.length} of {photos.length} — scroll for more
                    </div>
                )}

                {!photos.length && (
                    <div className="pf-library-empty">
                        {assets.length
                            ? 'No photos match these filters.'
                            : 'Import a shoot to begin. Drop a folder of photographs anywhere in this panel.'}
                    </div>
                )}
            </div>

            <p className="pf-library-legend">
                Arrows move · Space selects · Enter places · D develops
            </p>
        </div>
    )
}

export default PhotoLibrary
