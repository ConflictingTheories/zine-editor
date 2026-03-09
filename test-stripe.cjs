const fetch = require('node-fetch');

async function test() {
    console.log("Testing Stripe /api/webhook/stripe...");
    try {
        const res = await fetch('http://localhost:3000/api/webhook/stripe', {
            method: 'POST',
            body: JSON.stringify({ test: true }),
            headers: {
                'stripe-signature': 'test',
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Body:", text);
    } catch (e) {
        console.error(e);
    }
}

test();
