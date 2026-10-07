/*
 * Component: StorageManager
 * A window onto where the work actually lives.
 *
 * This exists because the app's storage is genuinely split across two places —
 * the project and library metadata in localStorage, and the image and audio
 * bytes in IndexedDB — and neither is visible from anywhere else. "12 photos"
 * says nothing about whether those photos exist, how big they are, or whether
 * the quota is nearly gone. That invisibility is how a byte-loss bug survived,
 * and this panel is the thing that would have surfaced it.
 *
 * It answers three questions directly: how much space am I using, what is
 * taking it up, and what happens if I delete something.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { photoStoreUsage, storageEstimate } from '../lib/photoStore.js'

const MB = 1024 * 1024

/** Human-readable byte count. Bytes matter more than GB until they don't. */
function formatBytes(bytes) {
    if (bytes == null || Number.isNaN(bytes)) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`
    return `${(bytes / (1024 * MB)).toFixed(2)} GB`
}

/** How a collection is labelled in the list. */
const COLLECTIONS = [
    { key: 'imported', label: 'Photographs' },
    { key: 'audio', label: 'Audio' },
    { key: 'video', label: 'Video' }
]

function StorageManager({ onClose }) {
    const { vpState, removeLibraryAssets, toast } = useVP()
    const [usage, setUsage] = useState(null)
    const [estimate, setEstimate] = useState(null)
    const [busy, setBusy] = useState(false)
    const [selected, setSelected] = useState(() => new Set())
    const [confirming, setConfirming] = useState(false)

    const library = vpState.library || {}

    /**
     * Measure from the bytes, not the metadata. A record deliberately carries no
     * `src`, so `asset.bytes` is only what the file claimed at import; the
     * authoritative size is the blob actually on disk.
     */
    const refresh = useCallback(async () => {
        const [store, quota] = await Promise.all([photoStoreUsage(), storageEstimate()])
        setUsage(store)
        setEstimate(quota)
    }, [])

    useEffect(() => { refresh() }, [refresh, library])

    const rows = useMemo(() => {
        const byId = usage?.byId || {}
        return COLLECTIONS.flatMap(({ key, label }) =>
            (library[key] || []).map(asset => ({
                id: asset.id,
                name: asset.name || 'Untitled',
                collection: key,
                collectionLabel: label,
                kind: asset.kind || (key === 'audio' ? 'audio' : 'image'),
                // Bytes from disk, falling back to the recorded size for audio
                // whose blob was written by an older build.
                bytes: byId[asset.id] ?? asset.bytes ?? null,
                recoverable: byId[asset.id] != null,
                width: asset.width,
                height: asset.height,
                addedAt: asset.addedAt
            })))
    }, [library, usage])

    const totals = useMemo(() => {
        const perCollection = {}
        let assetBytes = 0
        let missing = 0
        for (const row of rows) {
            perCollection[row.collectionLabel] = (perCollection[row.collectionLabel] || 0) + (row.bytes || 0)
            assetBytes += row.bytes || 0
            if (!row.recoverable) missing++
        }
        return { perCollection, assetBytes, missing, count: rows.length }
    }, [rows])

    // localStorage holds the project JSON and the library metadata (including
    // inlined thumbnails), so it is a real consumer of the quota too.
    const [metaBytes, setMetaBytes] = useState(0)
    useEffect(() => {
        let total = 0
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith('vp_')) continue
            total += (localStorage.getItem(key) || '').length * 2 // UTF-16
        }
        setMetaBytes(total)
    }, [library, vpState.projects])

    const used = (estimate?.usage ?? null)
    const quota = (estimate?.quota ?? null)
    const percent = used != null && quota ? Math.min(100, (used / quota) * 100) : null
    const selectedRows = rows.filter(r => selected.has(r.id))
    const selectedBytes = selectedRows.reduce((n, r) => n + (r.bytes || 0), 0)

    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    })

    const doDelete = async () => {
        if (!selected.size) return
        setBusy(true)
        const n = selected.size
        try {
            await removeLibraryAssets([...selected])
            setSelected(new Set())
            setConfirming(false)
            await refresh()
            toast(`Deleted ${n} file${n === 1 ? '' : 's'}, freeing ${formatBytes(selectedBytes)}`, 'success')
        } catch (err) {
            toast(`Could not delete: ${err.message}`, 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="modal-overlay active" id="storageModal">
            <div className="modal-box storage-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
                <header className="storage-head">
                    <div>
                        <h2 className="modal-h2">Storage</h2>
                        <p>Where your work is kept, and how much of it there is.</p>
                    </div>
                </header>

                {/* ── Usage ─────────────────────────────────────────────── */}                <div className="storage-usage">
                    <div className="storage-figure">
                        <span className="storage-figure-value">{formatBytes(totals.assetBytes)}</span>
                        <span className="storage-figure-label">in {totals.count} file{totals.count === 1 ? '' : 's'}</span>
                    </div>
                    {percent != null ? (
                        <div className="storage-meter" role="img" aria-label={`${percent.toFixed(0)}% of browser storage used`}>
                            <div className="storage-meter-track">
                                <div
                                    className={`storage-meter-fill${percent > 90 ? ' warn' : percent > 70 ? ' mid' : ''}`}
                                    style={{ width: `${Math.max(1, percent)}%` }}
                                />
                            </div>
                            <p className="storage-meter-label">
                                {percent.toFixed(0)}% of this browser's storage
                                {' · '}
                                {formatBytes(Math.max(0, (quota || 0) - (used || 0)))} free
                            </p>
                        </div>
                    ) : (
                        <p className="storage-note">
                            This browser does not report a storage quota, so only the
                            measured file sizes are shown.
                        </p>
                    )}
                </div>

                <dl className="storage-breakdown">
                    {Object.entries(totals.perCollection).map(([label, bytes]) => (
                        <div key={label}>
                            <dt>{label}</dt>
                            <dd>{formatBytes(bytes)}</dd>
                        </div>
                    ))}
                    <div>
                        <dt>Projects &amp; metadata</dt>
                        <dd>{formatBytes(metaBytes)}</dd>
                    </div>
                </dl>

                {totals.missing > 0 && (
                    <p className="storage-warning" role="alert">
                        {totals.missing} file{totals.missing === 1 ? ' has' : 's have'} no recoverable
                        data and will not render. They can be deleted to clear the entry.
                    </p>
                )}

                {/* ── Files ─────────────────────────────────────────────── */}
                <div className="storage-list" role="list">
                    {rows.length === 0 && (
                        <p className="storage-empty">No files in the library yet.</p>
                    )}
                    {rows.map(row => (
                        <div
                            key={row.id}
                            className={`storage-row${selected.has(row.id) ? ' selected' : ''}${row.recoverable ? '' : ' lost'}`}
                            role="listitem"
                        >
                            <label className="storage-row-main">
                                <input
                                    type="checkbox"
                                    checked={selected.has(row.id)}
                                    onChange={() => toggle(row.id)}
                                    aria-label={`Select ${row.name}`}
                                />
                                <span className="storage-row-text">
                                    <span className="storage-row-name">{row.name}</span>
                                    <span className="storage-row-meta">
                                        {row.collectionLabel}
                                        {row.width ? ` · ${row.width}×${row.height}` : ''}
                                        {row.recoverable ? '' : ' · data missing'}
                                    </span>
                                </span>
                            </label>
                            <span className="storage-row-size">
                                {row.recoverable ? formatBytes(row.bytes) : '—'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* ── Actions ───────────────────────────────────────────── */}
                <footer className="storage-foot">
                    {selected.size > 0 && !confirming && (
                        <>
                            <span className="storage-selected">
                                {selected.size} selected · {formatBytes(selectedBytes)}
                            </span>
                            <button
                                type="button"
                                className="pf-btn danger"
                                onClick={() => setConfirming(true)}
                            >
                                Delete {selected.size} file{selected.size === 1 ? '' : 's'}
                            </button>
                            <button type="button" className="pf-btn ghost" onClick={() => setSelected(new Set())}>
                                Clear
                            </button>
                        </>
                    )}
                    {confirming && (
                        <>
                            <span className="storage-confirm">
                                Permanently delete {selected.size} file{selected.size === 1 ? '' : 's'}
                                {' '}({formatBytes(selectedBytes)})? This cannot be undone.
                            </span>
                            <button type="button" className="pf-btn danger" onClick={doDelete} disabled={busy}>
                                {busy ? 'Deleting…' : 'Yes, delete'}
                            </button>
                            <button type="button" className="pf-btn ghost" onClick={() => setConfirming(false)}>
                                Cancel
                            </button>
                        </>
                    )}
                    {!selected.size && (
                        <>
                            <span className="storage-selected">Select files to delete them.</span>
                            <button type="button" className="pf-btn ghost" onClick={refresh}>
                                Refresh
                            </button>
                        </>
                    )}
                </footer>
            </div>
        </div>
    )
}

export default StorageManager
