import React from 'react'
import { useVP } from '../context/VPContext.jsx'

function Toast() {
    const { vpState } = useVP()

    return (
        <div className="toast-container" id="toastContainer">
            {vpState.toasts.map(toast => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    {toast.msg}
                </div>
            ))}
        </div>
    )
}

export default Toast
