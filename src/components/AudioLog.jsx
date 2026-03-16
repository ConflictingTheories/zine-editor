import React from 'react'
import { TokenRenderer } from '../lib/sovereign-sdk.js'

function AudioLog({ element }) {
    if (!element) return null

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--vp-surface2)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--vp-border)',
            overflow: 'hidden',
            position: 'relative',
            padding: '24px'
        }}>
            <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                fontSize: '10px',
                fontWeight: '600',
                color: 'var(--vp-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                Audio Stream
            </div>

            <div style={{ width: '100px', height: '100px', marginBottom: '16px' }}>
                <TokenRenderer
                    state="idle"
                    size={100}
                    color="var(--vp-accent)"
                />
            </div>

            <div style={{
                fontSize: '14px',
                color: 'var(--vp-text)',
                fontWeight: '600',
                textAlign: 'center'
            }}>
                {element.label || 'Unnamed Track'}
            </div>

            <div style={{
                fontSize: '11px',
                color: 'var(--vp-text-dim)',
                marginTop: '4px'
            }}>
                00:00 / 00:00
            </div>

            <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                width: '100%',
                height: '4px',
                background: 'var(--vp-border)'
            }}>
                <div style={{
                    width: '30%',
                    height: '100%',
                    background: 'var(--vp-accent)',
                    transition: 'width 0.3s ease'
                }} />
            </div>
        </div>
    )
}

export default AudioLog
