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
