import { useEffect } from 'react'
import { useXRPayID } from '../context/XRPayIDContext'

export const useStripeConfirm = () => {
    const { loadData } = useXRPayID()

    useEffect(() => {
        // Check for Stripe session_id in URL
        const params = new URLSearchParams(window.location.search)
        const sessionId = params.get('session_id')

        if (sessionId) {
            confirmPayment(sessionId)
        }
    }, [])

    const confirmPayment = async (sessionId) => {
        try {
            const token = localStorage.getItem('vp_token')
            if (!token) {
                console.error('Not authenticated')
                return
            }

            const response = await fetch('/api/stripe/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sessionId })
            })

            const data = await response.json()
            if (response.ok) {
                // Reload wallet data
                await loadData()
                // Show success message
                window.location.href = window.location.pathname
            } else {
                console.error('Payment confirmation failed:', data.error)
            }
        } catch (error) {
            console.error('Error confirming payment:', error)
        }
    }
}
