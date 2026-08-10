/*
 * Component: ContentGate
 * Protects gated content behind token ownership or access rights.
 */

import { useState, useEffect } from 'react';
import { getGateInfo, unlockContent, checkZineAccess } from '../api/index.js';

/**
 * ContentGate - Component for displaying gated content
 * 
 * Features:
 * - Shows lock UI when content is gated
 * - Supports token-based unlocking
 * - Shows funding progress for crowdfunded content
 * - Handles different gate types (token, subscription, credit, free)
 */
export default function ContentGate({
    zine,
    onUnlocked,
    showFunding = true
}) {
    const [gateInfo, setGateInfo] = useState(null);
    const [accessInfo, setAccessInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [unlocking, setUnlocking] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        if (zine) {
            checkAccess();
        }
    }, [zine]);

    const checkAccess = async () => {
        if (!zine?.gate_id) {
            setLoading(false);
            return;
        }

        try {
            // Get gate info
            const gateResult = await getGateInfo(zine.gate_id);
            if (gateResult.success) {
                setGateInfo(gateResult.gate);
            }

            // Check if user has access
            const accessResult = await checkZineAccess(zine.id);
            setAccessInfo(accessResult);
        } catch (err) {
            console.error('Failed to check access:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnlock = async (e) => {
        e.preventDefault();
        if (!tokenInput.trim()) {
            setError('Please enter your token data');
            return;
        }

        setUnlocking(true);
        setError(null);

        try {
            const result = await unlockContent(zine.gate_id, tokenInput);
            if (result.success) {
                setSuccess('Content unlocked successfully!');
                if (onUnlocked) {
                    onUnlocked(result.content);
                }
            } else {
                setError(result.error || 'Failed to unlock content');
            }
        } catch (err) {
            setError(err.message || 'Failed to unlock content');
        } finally {
            setUnlocking(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Checking access...</div>
            </div>
        );
    }

    // No gate - content is free
    if (!zine?.gate_id && (!zine?.funding_goal || zine?.is_funded)) {
        return null;
    }

    // Access granted
    if (accessInfo?.hasAccess) {
        return null;
    }

    // Calculate funding progress
    const fundingGoal = zine?.funding_goal || 0;
    const amountRaised = zine?.amount_raised || 0;
    const progress = fundingGoal > 0 ? (amountRaised / fundingGoal) * 100 : 0;
    const remaining = fundingGoal - amountRaised;

    return (
        <div style={styles.container}>
            {/* Lock Header */}
            <div style={styles.lockHeader}>
                <div style={styles.lockIcon}>🔒</div>
                <h3 style={styles.lockTitle}>
                    {zine?.monetization_type === 'crowdfund' ? 'Funding Goal Not Met' : 'Premium Content'}
                </h3>
            </div>

            {/* Funding Progress */}
            {showFunding && zine?.monetization_type === 'crowdfund' && fundingGoal > 0 && (
                <div style={styles.fundingSection}>
                    <div style={styles.progressBar}>
                        <div style={{ ...styles.progressFill, width: `${Math.min(100, progress)}%` }} />
                    </div>
                    <div style={styles.fundingStats}>
                        <span>${amountRaised.toFixed(2)} raised</span>
                        <span>${remaining.toFixed(2)} to go</span>
                    </div>
                    {progress >= 100 ? (
                        <div style={styles.fundedBadge}>
                            🎉 Funded! Content is now free!
                        </div>
                    ) : (
                        <p style={styles.fundingText}>
                            Help reach the funding goal to unlock this content for everyone!
                        </p>
                    )}
                </div>
            )}

            {/* Gate Type Info */}
            {gateInfo && (
                <div style={styles.gateInfo}>
                    <div style={styles.gateType}>
                        <span style={styles.label}>Gate Type:</span> {gateInfo.gate_type}
                    </div>
                    {gateInfo.price_credits > 0 && (
                        <div style={styles.price}>
                            <span style={styles.label}>Price:</span> {gateInfo.price_credits} credits
                        </div>
                    )}
                </div>
            )}

            {/* Token Unlock Form */}
            {gateInfo?.gate_type === 'token' && (
                <form onSubmit={handleUnlock} style={styles.unlockForm}>
                    <p style={styles.unlockText}>
                        Enter your sovereign token to unlock this content:
                    </p>

                    {error && <div style={styles.error}>{error}</div>}
                    {success && <div style={styles.success}>{success}</div>}

                    <textarea
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste your token data here..."
                        style={styles.tokenInput}
                        rows={4}
                    />

                    <button
                        type="submit"
                        disabled={unlocking}
                        style={styles.unlockButton}
                    >
                        {unlocking ? 'Unlocking...' : 'Unlock with Token'}
                    </button>
                </form>
            )}

            {/* Subscription Gate */}
            {gateInfo?.gate_type === 'subscription' && (
                <div style={styles.subscriptionGate}>
                    <p>This content requires a subscription to the creator.</p>
                    <button style={styles.subscribeButton}>
                        Subscribe to Access
                    </button>
                </div>
            )}

            {/* Credit Gate */}
            {gateInfo?.gate_type === 'credit' && (
                <div style={styles.creditGate}>
                    <p>Purchase this content with credits:</p>
                    <div style={styles.priceTag}>
                        {gateInfo.price_credits} credits
                    </div>
                    <button style={styles.purchaseButton}>
                        Purchase with Credits
                    </button>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        background: '#0d0d0d',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '24px',
        margin: '20px 0',
    },
    loading: {
        color: '#666',
        textAlign: 'center',
        padding: '20px',
    },
    lockHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
    },
    lockIcon: {
        fontSize: '24px',
    },
    lockTitle: {
        color: '#fff',
        margin: 0,
        fontFamily: "'DM Sans', sans-serif",
    },
    fundingSection: {
        marginBottom: '20px',
    },
    progressBar: {
        height: '8px',
        background: '#222',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '8px',
    },
    progressFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #7c5cfc, #3ef0c0)',
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    },
    fundingStats: {
        display: 'flex',
        justifyContent: 'space-between',
        color: '#888',
        fontSize: '12px',
        marginBottom: '12px',
    },
    fundedBadge: {
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(62, 240, 192, 0.2))',
        border: '1px solid rgba(124, 92, 252, 0.3)',
        color: '#3ef0c0',
        padding: '12px',
        borderRadius: '8px',
        textAlign: 'center',
    },
    fundingText: {
        color: '#666',
        fontSize: '14px',
        textAlign: 'center',
        margin: 0,
    },
    gateInfo: {
        display: 'flex',
        gap: '20px',
        marginBottom: '20px',
        padding: '12px',
        background: '#151515',
        borderRadius: '8px',
    },
    label: {
        color: '#666',
        fontSize: '12px',
        marginRight: '8px',
    },
    gateType: {
        color: '#888',
        fontSize: '14px',
    },
    price: {
        color: '#888',
        fontSize: '14px',
    },
    unlockForm: {
        marginTop: '20px',
    },
    unlockText: {
        color: '#888',
        fontSize: '14px',
        marginBottom: '12px',
    },
    error: {
        background: 'rgba(255, 50, 80, 0.1)',
        border: '1px solid rgba(255, 50, 80, 0.3)',
        color: '#ff3250',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '12px',
        fontSize: '14px',
    },
    success: {
        background: 'rgba(0, 220, 120, 0.1)',
        border: '1px solid rgba(0, 220, 120, 0.3)',
        color: '#00dc78',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '12px',
        fontSize: '14px',
    },
    tokenInput: {
        width: '100%',
        padding: '12px',
        background: '#151515',
        border: '1px solid #333',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'monospace',
        resize: 'vertical',
        marginBottom: '12px',
    },
    unlockButton: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #7c5cfc, #3ef0c0)',
        border: 'none',
        borderRadius: '8px',
        color: '#000',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
    },
    subscriptionGate: {
        textAlign: 'center',
        padding: '20px',
    },
    subscribeButton: {
        marginTop: '12px',
        padding: '12px 24px',
        background: '#7c5cfc',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
    },
    creditGate: {
        textAlign: 'center',
        padding: '20px',
    },
    priceTag: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#fff',
        margin: '12px 0',
    },
    purchaseButton: {
        padding: '12px 24px',
        background: '#3ef0c0',
        border: 'none',
        borderRadius: '8px',
        color: '#000',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
    },
};

