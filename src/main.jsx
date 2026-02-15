import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/shaderBridge.js'
import App from './App.jsx'
import { VPProvider } from './context/VPContext.jsx'
import { XRPayIDProvider } from './context/XRPayIDContext.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <VPProvider>
            <XRPayIDProvider>
                <App />
            </XRPayIDProvider>
        </VPProvider>
    </React.StrictMode>,
)

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
