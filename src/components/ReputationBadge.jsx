
import React from 'react'

const ReputationBadge = ({ score, level, size = 'medium' }) => {
    const getLevelConfig = (level) => {
        const configs = {
            newcomer: {
                color: '#6c757d',
                icon: '🌱',
                label: 'Newcomer'
            },
            supporter: {
                color: '#17a2b8',
                icon: '💧',
                label: 'Supporter'
            },
            contributor: {
                color: '#28a745',
                icon: '🌿',
                label: 'Contributor'
            },
            established: {
                color: '#ffc107',
                icon: '⭐',
                label: 'Established'
            },
            master: {
                color: '#fd7e14',
                icon: '🔥',
                label: 'Master'
            },
            legendary: {
                color: '#dc3545',
                icon: '👑',
                label: 'Legendary'
            },
            creator: {
                color: '#4b2c5e',
                icon: '🎨',
                label: 'Creator'
            }
        }
        return configs[level] || configs.newcomer
    }

    const config = getLevelConfig(level)

    const sizeStyles = {
        small: { padding: '4px 8px', fontSize: '11px', iconSize: '12px' },
        medium: { padding: '6px 12px', fontSize: '13px', iconSize: '16px' },
        large: { padding: '8px 16px', fontSize: '15px', iconSize: '20px' }
    }

    const styles = sizeStyles[size] || sizeStyles.medium

    return (
        <div
            className="reputation-badge"
            style={{
                background: config.color,
                color: 'white',
                padding: styles.padding,
                borderRadius: '20px',
                fontSize: styles.fontSize,
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
        >
            <span style={{ fontSize: styles.iconSize }}>{config.icon}</span>
            <span>{config.label}</span>
            {score !== undefined && (
                <span style={{ opacity: 0.9, fontWeight: 'normal' }}>
                    · {score}
                </span>
            )}
        </div>
    )
}

export default ReputationBadge

