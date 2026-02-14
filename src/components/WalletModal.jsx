
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
        // In a full implementation, this would clear the wallet from state
        onClose()
    }

    return (
        <div className="wallet-modal-overlay" onClick={onClose}>
            <div className="wallet-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>🔗 Connect XRP Wallet</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {xrState.wallet?.xrp_address ? (
                    // Connected wallet view
                    <div className="wallet-connected">
                        <div className="wallet-status">
                            <span className="status-badge">✓ Connected</span>
                        </div>

                        <div className="wallet-info">
                            <div className="info-row">
                                <span className="label">XRP Address:</span>
                                <span className="value">{xrState.wallet.xrp_address}</span>
                            </div>
                            {xrState.wallet.payid && (
                                <div className="info-row">
                                    <span className="label">PayID:</span>
                                    <span className="value">{xrState.wallet.payid}</span>
                                </div>
                            )}
                        </div>

                        <button className="disconnect-btn" onClick={handleDisconnect}>
                            Disconnect Wallet
                        </button>
                    </div>
                ) : (
                    // Connect wallet view
                    <div className="wallet-connect">
                        <p className="description">
                            Connect your XRP wallet to enable token transactions,
                            subscriptions, and content monetization.
                        </p>

                        <div className="form-group">
                            <label>XRP Address (r...)</label>
                            <input
                                type="text"
                                value={xrpAddress}
                                onChange={(e) => setXrpAddress(e.target.value)}
                                placeholder="r..."
                            />
                        </div>

                        <div className="form-group">
                            <label>PayID (optional)</label>
                            <input
                                type="text"
                                value={payid}
                                onChange={(e) => setPayid(e.target.value)}
                                placeholder="$username.payid.xrp"
                            />
                        </div>

                        <button
                            className="connect-btn"
                            onClick={handleConnect}
                            disabled={isLoading || !xrpAddress}
                        >
                            {isLoading ? 'Connecting...' : 'Connect Wallet'}
                        </button>

                        <div className="generate-wallet">
                            <p className="divider-text">- OR -</p>
                            <button
                                className="generate-btn"
                                onClick={async () => {
                                    setIsLoading(true)
                                    setMessage(null)
                                    try {
                                        // Use connectWallet from context with no params for generation
                                        const res = await connectWallet()

                                        setXrpAddress(res.xrpAddress)
                                        setMessage({
                                            type: 'success',
                                            text: `Wallet Created! Address: ${res.xrpAddress}`
                                        })

                                        setTimeout(() => {
                                            onClose()
                                        }, 1500)

                                    } catch (err) {
                                        console.error(err)
                                        setMessage({ type: 'error', text: err.message })
                                    } finally {
                                        setIsLoading(false)
                                    }
                                }}
                                disabled={isLoading}
                            >
                                🎲 Create New XRP Wallet
                            </button>
                        </div>

                        {message && (
                            <div className={`message ${message.type}`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                )}

                <style>{`
                    .wallet-modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    .wallet-modal {
                        background: var(--ed-white, #fdfaf1);
                        border-radius: 12px;
                        width: 90%;
                        max-width: 420px;
                        padding: 24px;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    .modal-header h3 {
                        margin: 0;
                        color: var(--ed-black, #1a1a1a);
                    }
                    .close-btn {
                        background: none;
                        border: none;
                        font-size: 28px;
                        cursor: pointer;
                        color: var(--ed-gray, #34495e);
                        line-height: 1;
                    }
                    .description {
                        color: #666;
                        margin-bottom: 20px;
                        line-height: 1.5;
                    }
                    .form-group {
                        margin-bottom: 16px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 6px;
                        font-weight: bold;
                        color: var(--ed-black, #1a1a1a);
                        font-size: 14px;
                    }
                    .form-group input {
                        width: 100%;
                        padding: 12px;
                        border: 2px solid var(--ed-gray, #34495e);
                        border-radius: 6px;
                        font-size: 14px;
                        box-sizing: border-box;
                    }
                    .form-group input:focus {
                        outline: none;
                        border-color: var(--ed-purple, #4b2c5e);
                    }
                    .connect-btn {
                        width: 100%;
                        padding: 14px;
                        background: linear-gradient(135deg, var(--ed-purple, #4b2c5e), var(--ed-crimson, #5c0a0a));
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        margin-top: 8px;
                    }
                    .connect-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .help-text {
                        font-size: 13px;
                        color: #666;
                        text-align: center;
                        margin-top: 16px;
                    }
                    .help-text a {
                        color: var(--ed-purple, #4b2c5e);
                    }
                    .generate-wallet {
                        margin-top: 16px;
                        text-align: center;
                    }
                    .divider-text {
                        color: #999;
                        margin: 12px 0;
                    }
                    .generate-btn {
                        width: 100%;
                        padding: 14px;
                        background: linear-gradient(135deg, var(--ed-gold, #d4af37), #b8962e);
                        color: var(--ed-black, #1a1a1a);
                        border: none;
                        border-radius: 6px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                    }
                    .generate-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .wallet-connected {
                        text-align: center;
                    }
                    .wallet-status {
                        margin-bottom: 20px;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 8px 16px;
                        background: #28a745;
                        color: white;
                        border-radius: 20px;
                        font-weight: bold;
                    }
                    .wallet-info {
                        background: white;
                        padding: 16px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        text-align: left;
                    }
                    .info-row {
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 12px;
                    }
                    .info-row:last-child {
                        margin-bottom: 0;
                    }
                    .info-row .label {
                        font-size: 12px;
                        color: #666;
                        text-transform: uppercase;
                    }
                    .info-row .value {
                        font-family: monospace;
                        font-size: 13px;
                        word-break: break-all;
                        color: var(--ed-black, #1a1a1a);
                    }
                    .disconnect-btn {
                        width: 100%;
                        padding: 12px;
                        background: var(--ed-crimson, #5c0a0a);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    .message {
                        margin-top: 16px;
                        padding: 12px;
                        border-radius: 6px;
                        text-align: center;
                    }
                    .message.success {
                        background: #d4edda;
                        color: #155724;
                    }
                    .message.error {
                        background: #f8d7da;
                        color: #721c24;
                    }
                `}</style>
            </div>
        </div>
    )
}

export default WalletModal

