
const Stripe = require('stripe');
const knex = require('./knexfile.cjs');
const CONFIG = require('./config.cjs');

// Lazy initialize Stripe - only create instance if API key is available
let stripe = null;
if (CONFIG.payment.stripeSecretKey) {
  stripe = new Stripe(CONFIG.payment.stripeSecretKey);
} else {
  console.warn('WARNING: STRIPE_SECRET_KEY not set - Stripe payments will be simulated');
}

async function createContributionIntent(zine_id, amount_dollars, user_id) {
  if (!zine_id) throw new Error("zine_id is required");
  if (!amount_dollars) throw new Error("amount_dollars is required");

  const parsedAmount = parseFloat(amount_dollars);
  if (isNaN(parsedAmount) || parsedAmount < 0.50) {
    throw new Error("Minimum contribution is $0.50");
  }

  const zine = await knex('zines').where({ id: zine_id }).first();
  if (!zine) throw new Error("Zine not found");

  const remaining = zine.funding_goal > 0 ? Math.max(0, zine.funding_goal - zine.amount_raised) : parsedAmount;
  const chargeAmount = zine.funding_goal > 0 ? Math.min(parsedAmount, remaining) : parsedAmount;

  if (chargeAmount <= 0) throw new Error("Zine is already fully funded");

  const amountCents = Math.round(chargeAmount * 100);

  // If Stripe not configured, return mock response
  if (!stripe) {
    return {
      clientSecret: "mock_" + Date.now(),
      amountCharged: chargeAmount,
      mock: true
    };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    metadata: {
      zine_id: zine_id,
      user_id: user_id,
    },
    description: `Zine Contribution: "${zine.title}"`,
  });

  return { clientSecret: paymentIntent.client_secret, amountCharged: chargeAmount };
}

async function handleStripeWebhook(body, signature) {
  // If Stripe not configured, skip webhook processing
  if (!stripe) {
    console.warn('Stripe not configured - skipping webhook processing');
    return { received: true, mock: true };
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      CONFIG.payment.stripeWebhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    throw new Error("Invalid webhook signature");
  }

  if (event.type === "payment_intent.succeeded") {
    await handlePaymentSuccess(event.data.object);
  }

  return { received: true };
}

async function handlePaymentSuccess(paymentIntent) {
  const { id: stripeIntentId, amount, metadata } = paymentIntent;
  const { zine_id, user_id } = metadata;

  if (!zine_id || !user_id) {
    console.warn("Received Stripe payment without Zine metadata:", stripeIntentId);
    return;
  }

  await knex.transaction(async (trx) => {
    const existing = await trx('contributions').where({ stripe_payment_intent: stripeIntentId }).first();
    if (existing) return;

    await trx('contributions').insert({
      user_id: user_id,
      zine_id: zine_id,
      amount: amount / 100, // convert cents to dollars
      stripe_payment_intent: stripeIntentId,
    });

    await trx('zines').where({ id: zine_id }).increment('amount_raised', amount / 100);
  });

  console.log(`Payment recorded: ${stripeIntentId} — user ${user_id} → zine ${zine_id}`);
}

module.exports = {
  createContributionIntent,
  handleStripeWebhook,
};
