import React, { useEffect, useRef } from 'react'
import { useVP } from '../context/VPContext.jsx'
import { TokenRenderer } from '../lib/sovereign-sdk.js'

const styles = {
    container: {
        padding: '30px',
        background: 'var(--vp-surface)',
        minHeight: 'calc(100vh - 60px)',
        color: 'var(--vp-text)'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '40px',
        borderBottom: '1px solid var(--vp-border)',
        paddingBottom: '30px'
    },
    tokenWrap: {
        width: '180px',
        height: '180px',
        background: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '2px solid var(--vp-accent)',
        position: 'relative'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '20px'
    },
    statCard: {
        background: 'var(--vp-surface2)',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid var(--vp-border)'
    },
    statVal: {
        fontSize: '1.8em',
        fontWeight: 'bold',
        color: 'var(--vp-accent)',
        display: 'block'
    },
    statLabel: {
        fontSize: '0.8em',
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: '1px'
    }
}

function Profile() {
    const { vpState } = useVP()
    const { user } = vpState
    const canvasRef = useRef(null)
    const rendererRef = useRef(null)

    useEffect(() => {
        if (!canvasRef.current || !window._sovereign_identity) return

        const id = window._sovereign_identity
        const palette = [220, 240, 260] // Soft Indigo/Blue palette

        rendererRef.current = new TokenRenderer(canvasRef.current, id.seed, palette, 'unlocked')
        rendererRef.current.start()

        return () => {
            if (rendererRef.current) rendererRef.current.stop()
        }
    }, [window._sovereign_identity])

    if (!user) return <div className="profile-view" style={{ padding: '40px', color: 'var(--vp-text-dim)' }}>Please log in to view your profile.</div>

    return (
        <div className="profile-view" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '60px' }}>
                <div style={{
                    width: '160px',
                    height: '160px',
                    background: 'var(--vp-bg-input)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    border: '1px solid var(--vp-border)',
                    boxShadow: 'var(--shadow-md)'
                }}>
                    <canvas ref={canvasRef} width={128} height={128} style={{ width: '100%', height: '100%' }} />
                </div>
                <div>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '2.5rem', fontWeight: '800', color: 'var(--vp-text)' }}>{user.username}</h1>
                    <p style={{ opacity: 0.5, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>OID: {user.sovereign_id || 'NOT_LINKED'}</p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: user.is_premium ? 'var(--vp-accent)' : 'var(--vp-surface2)',
                            color: user.is_premium ? '#fff' : 'var(--vp-text-dim)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {user.is_premium ? 'Premium Agent' : 'Free Tier'}
                        </span>
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: 'var(--vp-surface2)',
                            color: 'var(--vp-text-dim)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>Verified</span>
                    </div>
                </div>
            </div>

            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--vp-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Economy & Metrics</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                    <div style={{ background: 'var(--vp-bg-input)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--vp-border)' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--vp-accent)', display: 'block', marginBottom: '4px' }}>{user.credits || 0}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--vp-text-dim)', textTransform: 'uppercase' }}>XRP Credits</span>
                    </div>
                    <div style={{ background: 'var(--vp-bg-input)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--vp-border)' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--vp-text)', display: 'block', marginBottom: '4px' }}>{vpState.projects.length}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--vp-text-dim)', textTransform: 'uppercase' }}>Total Zines</span>
                    </div>
                    <div style={{ background: 'var(--vp-bg-input)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--vp-border)' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--vp-text)', display: 'block', marginBottom: '4px' }}>{vpState.published.length}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--vp-text-dim)', textTransform: 'uppercase' }}>Published</span>
                    </div>
                    <div style={{ background: 'var(--vp-bg-input)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--vp-border)' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--vp-text)', display: 'block', marginBottom: '4px' }}>0</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--vp-text-dim)', textTransform: 'uppercase' }}>Subscribers</span>
                    </div>
                </div>
            </section>

            <section>
                <h2 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--vp-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Sovereign Data</h2>
                <div style={{
                    background: 'var(--vp-bg-input)',
                    padding: '24px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--vp-border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: 'var(--vp-text-dim)',
                    lineHeight: '1.6',
                    overflowX: 'auto'
                }}>
                    <pre style={{ margin: 0 }}>
                        {JSON.stringify(window._sovereign_identity?.claims || { error: 'Identity not mounted' }, null, 2)}
                    </pre>
                </div>
            </section>
        </div>
    )
}

export default Profile
