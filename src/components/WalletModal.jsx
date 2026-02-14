import React, { useState } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'

const WalletModal = ({ isOpen, onClose }) => {
    const { xrState, connectWallet } = useXRPayID()
    const [xrpAddress, setXrpAddress] = useState('')
    const [payid, setPayid] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)

    if (!isOpen) return null

    const handleConnect = async () => {
        if (!xrpAddress) {
            setMessage({ type: 'error', text: 'XRP Address is required' })
            return
        }

        setIsLoading(true)
        setMessage(null)

        try {
            await connectWallet(xrpAddress, payid)
            setMessage({ type: 'success', text: 'Wallet connected successfully!' })
            setTimeout(() => {
                onClose()
                setXrpAddress('')
                setPayid('')
            }, 1500)
        } catch (err) {
            setMessage({ type: 'error', text: err.message })
        }

        setIsLoading(false)
    }

    const handleDisconnect = () => {
        onClose()
    }

    return (
        <div className="premium-modal-overlay active" onClick={onClose}>
            <div className="premium-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <button className="premium-modal-close" onClick={onClose}>✕</button>
                <h2 className="premium-modal-h2">🔗 Connect XRP Wallet</h2>

                {xrState.wallet?.xrp_address ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <span style={{ background: '#28a745', color: 'white', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 700 }}>✓ Connected</span>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', textAlign: 'left', marginBottom: '1.5rem' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--vp-text-dim)', textTransform: 'uppercase' }}>XRP Address</label>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{xrState.wallet.xrp_address}</span>
                            </div>
                            {xrState.wallet.payid && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--vp-text-dim)', textTransform: 'uppercase' }}>PayID</label>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{xrState.wallet.payid}</span>
                                </div>
                            )}
                        </div>

                        <button className="filter-tag" onClick={handleDisconnect} style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>
                            Disconnect Wallet
                        </button>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: 'var(--vp-text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Connect your XRP wallet to enable token transactions,
                            subscriptions, and content monetization.
                        </p>

                        <div className="form-row">
                            <label>XRP Address (r...)</label>
                            <input
                                type="text"
                                value={xrpAddress}
                                onChange={(e) => setXrpAddress(e.target.value)}
                                placeholder="r..."
                            />
                        </div>

                        <div className="form-row">
                            <label>PayID (optional)</label>
                            <input
                                type="text"
                                value={payid}
                                onChange={(e) => setPayid(e.target.value)}
                                placeholder="$username.payid.xrp"
                            />
                        </div>

                        <button
                            className="btn-premium"
                            onClick={handleConnect}
                            disabled={isLoading || !xrpAddress}
                            style={{ width: '100%', marginTop: '0.5rem' }}
                        >
                            {isLoading ? 'Connecting...' : 'Connect Wallet'}
                        </button>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <p style={{ color: 'var(--vp-text-dim)', margin: '1rem 0', fontSize: '0.8rem' }}>OR CREATE NEW</p>
                            <button
                                className="filter-tag"
                                onClick={async () => {
                                    setIsLoading(true);
                                    setMessage(null);
                                    try {
                                        const res = await connectWallet();
                                        setXrpAddress(res.xrpAddress);
                                        setMessage({ type: 'success', text: `Wallet Created! Address: ${res.xrpAddress}` });
                                        setTimeout(() => onClose(), 1500);
                                    } catch (err) {
                                        setMessage({ type: 'error', text: err.message });
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                                style={{ width: '100%', background: 'var(--vp-surface)', border: '1px solid var(--vp-border)' }}
                            >
                                🎲 Generate New Vault
                            </button>
                        </div>

                        {message && (
                            <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', textAlign: 'center', background: message.type === 'success' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#28a745' : '#ef4444', border: `1px solid ${message.type === 'success' ? '#28a745' : '#ef4444'}` }}>
                                {message.text}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default WalletModal

