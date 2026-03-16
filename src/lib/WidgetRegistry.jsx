import React from 'react'

const WidgetRegistry = {
    'rss-feed': (props) => (
        <div style={{ padding: '8px', background: '#000', color: '#0f0', border: '1px solid #0f0', fontSize: '10px', height: '100%', overflow: 'hidden' }}>
            <div style={{ borderBottom: '1px solid #0f0', marginBottom: '4px' }}>RSS_DATA_STREAM</div>
            <div>- System update 4.2: Stability improved</div>
            <div>- New zines published in Sector 7</div>
            <div>- Sovereign token audit complete</div>
        </div>
    ),
    'countdown': (props) => (
        <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px solid #333' }}>
            00:45:12
        </div>
    ),
    'ticker': (props) => (
        <div style={{ background: '#222', color: '#fff', padding: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <marquee>LATEST_SYSTEM_TELEMETRY: ALL_SYSTEMS_OPERATIONAL... VOID_PRESS_ACT_IV_DEPLOYED...</marquee>
        </div>
    )
}

export default WidgetRegistry
