import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { VPProvider } from './context/VPContext.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <VPProvider>
            <App />
        </VPProvider>
    </React.StrictMode>,
)
