import { useState, useEffect } from 'react';
import { getUserSovereignTokens, createSovereignToken } from '../api/index.js';

/**
 * SovereignTokenManager - Component for managing sovereign tokens
 * 
 * Features:
 * - Create new sovereign tokens
 * - View existing tokens
 * - Copy token data for sharing
 * - Visual token preview
 */
export default function SovereignTokenManager({ userId, onTokenCreated }) {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTokenIdentity, setNewTokenIdentity] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Load user's tokens on mount
    useEffect(() => {
        loadTokens();
    }, [userId]);

    const loadTokens = async () => {
        setLoading(true);
        try {
            const result = await getUserSovereignTokens();
            if (result && Array.isArray(result)) {
                setTokens(result);
            }
        } catch (err) {
            console.error('Failed to load tokens:', err);
            setError('Failed to load tokens');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateToken = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await createSovereignToken(newTokenIdentity, {
                created_at: new Date().toISOString(),
                platform: 'void-press'
            });

            if (result && result.tokenId) {
                setSuccess('Token created successfully!');
                setNewTokenIdentity('');
                setShowCreateForm(false);
                loadTokens();
                if (onTokenCreated) {
                    onTokenCreated(result);
                }
            }
        } catch (err) {
            console.error('Failed to create token:', err);
            setError(err.message || 'Failed to create token');
        } finally {
            setCreating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard!');
        setTimeout(() => setSuccess(null), 2000);
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading tokens...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>Sovereign Tokens</h3>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    style={styles.createButton}
                >
                    {showCreateForm ? 'Cancel' : '+ Create Token'}
                </button>
            </div>

            {error && (
                <div style={styles.error}>{error}</div>
            )}
            {success && (
                <div style={styles.success}>{success}</div>
            )}

            {showCreateForm && (
                <form onSubmit={handleCreateToken} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Identity</label>
                        <input
                            type="text"
                            value={newTokenIdentity}
                            onChange={(e) => setNewTokenIdentity(e.target.value)}
                            placeholder="e.g., username@email.com or your DID"
                            style={styles.input}
                            required
                        />
                        <p style={styles.hint}>
                            This identity will be embedded in your token. Use a unique identifier.
                        </p>
                    </div>
                    <button
                        type="submit"
                        disabled={creating || !newTokenIdentity}
                        style={styles.submitButton}
                    >
                        {creating ? 'Creating...' : 'Create Token'}
                    </button>
                </form>
            )}

            <div style={styles.tokenList}>
                {tokens.length === 0 ? (
                    <div style={styles.empty}>
                        <p>No sovereign tokens yet.</p>
                        <p>Create one to sign and verify your content.</p>
                    </div>
                ) : (
                    tokens.map((token) => (
                        <div key={token.id} style={styles.tokenCard}>
                            <div style={styles.tokenHeader}>
                                <div
                                    style={{
                                        ...styles.tokenVisual,
                                        background: token.palette_h1 ?
                                            `linear-gradient(135deg, hsl(${token.palette_h1}, 70%, 50%), hsl(${token.palette_h2 || token.palette_h1}, 60%, 40%))` :
                                            '#1a1a1a'
                                    }}
                                />
                                <div style={styles.tokenInfo}>
                                    <div style={styles.tokenId}>{token.token_id}</div>
                                    <div style={styles.tokenIdentity}>{token.identity}</div>
                                </div>
                            </div>

                            {token.claims && (
                                <div style={styles.tokenClaims}>
                                    <strong>Claims:</strong> {JSON.stringify(token.claims)}
                                </div>
                            )}

                            <div style={styles.tokenActions}>
                                <button
                                    onClick={() => copyToClipboard(token.token_data)}
                                    style={styles.actionButton}
                                >
                                    Copy Token Data
                                </button>
                            </div>

                            <div style={styles.tokenDate}>
                                Created: {new Date(token.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        padding: '20px',
        background: '#0d0d0d',
        borderRadius: '12px',
        border: '1px solid #222',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
    },
    title: {
        color: '#fff',
        margin: 0,
        fontFamily: "'DM Sans', sans-serif",
    },
    createButton: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #7c5cfc, #3ef0c0)',
        border: 'none',
        borderRadius: '8px',
        color: '#000',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
    },
    loading: {
        color: '#666',
        textAlign: 'center',
        padding: '40px',
    },
    error: {
        background: 'rgba(255, 50, 80, 0.1)',
        border: '1px solid rgba(255, 50, 80, 0.3)',
        color: '#ff3250',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '14px',
    },
    success: {
        background: 'rgba(0, 220, 120, 0.1)',
        border: '1px solid rgba(0, 220, 120, 0.3)',
        color: '#00dc78',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '14px',
    },
    form: {
        background: '#151515',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
    },
    formGroup: {
        marginBottom: '16px',
    },
    label: {
        display: 'block',
        color: '#888',
        fontSize: '12px',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    },
    input: {
        width: '100%',
        padding: '12px',
        background: '#0d0d0d',
        border: '1px solid #333',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        fontFamily: "'DM Sans', sans-serif",
    },
    hint: {
        color: '#555',
        fontSize: '12px',
        marginTop: '8px',
    },
    submitButton: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #7c5cfc, #3ef0c0)',
        border: 'none',
        borderRadius: '6px',
        color: '#000',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
    },
    tokenList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    empty: {
        color: '#555',
        textAlign: 'center',
        padding: '40px',
        background: '#151515',
        borderRadius: '8px',
    },
    tokenCard: {
        background: '#151515',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #222',
    },
    tokenHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
    },
    tokenVisual: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    tokenInfo: {
        flex: 1,
    },
    tokenId: {
        color: '#888',
        fontSize: '11px',
        fontFamily: 'monospace',
    },
    tokenIdentity: {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
    },
    tokenClaims: {
        color: '#666',
        fontSize: '12px',
        marginBottom: '12px',
        fontFamily: 'monospace',
    },
    tokenActions: {
        display: 'flex',
        gap: '8px',
    },
    actionButton: {
        padding: '6px 12px',
        background: '#222',
        border: '1px solid #333',
        borderRadius: '4px',
        color: '#888',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
    },
    tokenDate: {
        color: '#444',
        fontSize: '11px',
        marginTop: '12px',
    },
};

