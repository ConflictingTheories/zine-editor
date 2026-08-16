/*
 * Entry: main.jsx
 * Bootstraps the React application, registers providers, and attaches the service worker.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/shaderBridge.js'
import App from './App.jsx'
import { VPProvider } from './context/VPContext.jsx'
import { XRPayIDProvider } from './context/XRPayIDContext.jsx'
import './styles.css'
import './styles/tokens.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <VPProvider>
            <XRPayIDProvider>
                <App />
            </XRPayIDProvider>
        </VPProvider>
    </React.StrictMode>,
)

// Register the optional service worker only in a secure, production-like context.
// Vite's development worker can be blocked by the browser and is not needed for HMR.
if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
}
