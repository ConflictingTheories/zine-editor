const fetch = require('node-fetch');

async function testPurchase() {
    console.log("Simulating a successful VPC purchase via Stripe Webhook");

    // Let's create a simulated event body for a checkout.session.completed
    const payload = {
        type: 'checkout.session.completed',
        data: {
            object: {
                id: 'cs_test_simulated',
                metadata: {
                    userId: '1',
                    type: 'VPC_PURCHASE',
                    vpcAmount: '500' // $5.00 * 100
                }
            }
        }
    };

    try {
        const res = await fetch('http://localhost:3000/api/webhook/stripe', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                // The economyService handles Stripe signature internally and in mock mode ignores it
                'stripe-signature': 'simulated_signature',
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        console.log("Webhook Response Status:", res.status);
        console.log("Webhook Response Body:", text);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testPurchase();
