/*
 * Component: PlayableEmbed
 *
 * Renders a `playable` embed block from the pixozine manifest (format v1.1.0,
 * §8 "Playable embeds"). A playable is a PixoSpritz game bundle published to
 * SVRN and pinned to an exact player version.
 *
 * Trust model (sandbox-by-default):
 * - The bundle executes inside an <iframe> with `sandbox="allow-scripts"` ONLY.
 *   No `allow-same-origin` (the embed cannot touch host DOM, storage, or
 *   cookies), no `allow-top-navigation`, no `allow-forms`, no `allow-popups`.
 * - The embed never widens the host's granted capabilities: scripts inside the
 *   bundle run under the same execution boundary and trust policy as the host
 *   package (format §5, §8).
 * - Bundle integrity (`bundle.manifestHash`) is passed to the player, which
 *   verifies it before executing anything (format §8: "The runtime verifies
 *   before executing").
 *
 * Player resolution:
 * - `playable.playerBaseUrl` wins, then `window.SVRN_PLAYER_BASE_URL`, then
 *   the same-origin conventional mount `/svrn-player`.
 * - The iframe loads `{base}/v{playerVersion}/?bundle={uri}&manifestHash={hash}`.
 *   The player version is pinned — never "latest".
 */

import React, { useState, useCallback } from 'react'
import '../styles/playable-embed.css'

const DEFAULT_PLAYER_BASE = '/svrn-player'

function resolvePlayerBase(playable) {
    return (
        playable?.playerBaseUrl ||
        (typeof window !== 'undefined' && window.SVRN_PLAYER_BASE_URL) ||
        DEFAULT_PLAYER_BASE
    )
}

function buildPlayerUrl(playable) {
    const base = resolvePlayerBase(playable).replace(/\/+$/, '')
    const params = new URLSearchParams({
        bundle: playable.bundle.uri,
        manifestHash: playable.bundle.manifestHash,
    })
    return `${base}/v${playable.playerVersion}/?${params.toString()}`
}

function aspectStyle(playable) {
    const d = playable.dimensions || {}
    if (d.width && d.height) return { aspectRatio: `${d.width} / ${d.height}` }
    if (d.aspect) {
        const [w, h] = String(d.aspect).split(':').map(Number)
        if (w > 0 && h > 0) return { aspectRatio: `${w} / ${h}` }
    }
    return { aspectRatio: '16 / 9' }
}

function Fallback({ playable }) {
    const fb = playable.fallback || {}
    return (
        <div className="playable-fallback" role="note" aria-label="Playable content unavailable">
            {fb.image && (
                <img className="playable-fallback-image" src={fb.image} alt="" />
            )}
            <div className="playable-fallback-title">
                {fb.title || 'Playable content unavailable'}
            </div>
            {fb.body && (
                <div className="playable-fallback-body">{fb.body}</div>
            )}
            {!fb.title && !fb.body && (
                <div className="playable-fallback-body">
                    This playable {playable.title ? `“${playable.title}” ` : ''}could not be loaded.
                </div>
            )}
        </div>
    )
}

const PlayableEmbed = ({ playable, className = '' }) => {
    const [phase, setPhase] = useState('loading') // loading | ready | error
    const [started, setStarted] = useState(false)

    const hasBundle = Boolean(playable?.bundle?.uri && playable?.playerVersion)

    const handleIframeLoad = useCallback(() => {
        setPhase('ready')
    }, [])

    const handleIframeError = useCallback(() => {
        setPhase('error')
    }, [])

    const handleStart = useCallback(() => {
        setStarted(true)
    }, [])

    // No playable configured — editor empty state.
    if (!playable || !hasBundle) {
        return (
            <div className={`playable-embed playable-empty ${className}`} style={aspectStyle(playable || {})}>
                <div className="playable-empty-inner">
                    <div className="playable-empty-title">No playable configured</div>
                    <div className="playable-empty-hint">Publish a PixoSpritz bundle to SVRN, then link it here.</div>
                </div>
            </div>
        )
    }

    // Click-to-play: the poster is shown first; the sandboxed player only
    // loads after the reader explicitly starts it. This avoids auto-running
    // third-party code on page view and gives the poster/fallback a purpose.
    if (!started) {
        return (
            <div className={`playable-embed playable-poster ${className}`} style={aspectStyle(playable)}>
                {playable.poster ? (
                    <img className="playable-poster-image" src={playable.poster} alt={playable.title || 'Playable preview'} />
                ) : (
                    <div className="playable-poster-blank" aria-hidden="true" />
                )}
                <button
                    type="button"
                    className="playable-start"
                    onClick={handleStart}
                    aria-label={`Play ${playable.title || 'playable content'}`}
                >
                    <span className="playable-start-icon" aria-hidden="true">▶</span>
                    <span className="playable-start-label">{playable.title || 'Play'}</span>
                </button>
                {playable.description && (
                    <div className="playable-poster-desc">{playable.description}</div>
                )}
            </div>
        )
    }

    if (phase === 'error') {
        return (
            <div className={`playable-embed ${className}`} style={aspectStyle(playable)}>
                <Fallback playable={playable} />
            </div>
        )
    }

    return (
        <div className={`playable-embed ${className}`} style={aspectStyle(playable)}>
            {phase === 'loading' && (
                <div className="playable-loading" aria-busy="true" aria-label="Loading playable">
                    {playable.poster && (
                        <img className="playable-poster-image" src={playable.poster} alt="" aria-hidden="true" />
                    )}
                    <div className="playable-spinner" aria-hidden="true" />
                </div>
            )}
            <iframe
                title={playable.title || 'Playable content'}
                src={buildPlayerUrl(playable)}
                className="playable-frame"
                style={{ opacity: phase === 'ready' ? 1 : 0 }}
                // Sandbox-by-default: scripts only. Deliberately no
                // allow-same-origin (no host DOM/storage access), no
                // allow-top-navigation, no allow-forms, no allow-popups.
                sandbox="allow-scripts"
                allow="autoplay; fullscreen"
                loading="lazy"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
            />
        </div>
    )
}

export default PlayableEmbed
