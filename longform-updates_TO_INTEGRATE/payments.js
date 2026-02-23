import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db/pool.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/authenticate.js";
import { createError } from "../middleware/errorHandler.js";
import { determineCreditTier, willBeFullyFunded } from "../services/contributionService.js";

const router = Router();
const stripe = new Stripe(config.stripe.secretKey);

// ── POST /api/payments/create-intent ─────────────────────────────────────────
// Creates a Stripe PaymentIntent. The client uses the returned clientSecret
// to render Stripe Elements and collect card details directly — card data
// never touches our server.
router.post("/create-intent", authenticate, async (req, res, next) => {
  try {
    const { article_id, amount_dollars } = req.body;
    if (!article_id)     throw createError(400, "article_id is required");
    if (!amount_dollars) throw createError(400, "amount_dollars is required");

    const parsedAmount = parseFloat(amount_dollars);
    if (isNaN(parsedAmount) || parsedAmount < 0.50) {
      throw createError(400, "Minimum contribution is $0.50");
    }

    const article = await db.queryOne(
      "SELECT id, title, funding_goal, amount_raised FROM articles WHERE id = $1",
      [article_id]
    );
    if (!article) throw createError(404, "Article not found");

    // Clamp: don't allow overpayment beyond the goal
    const remaining = article.funding_goal > 0
      ? Math.max(0, article.funding_goal - article.amount_raised)
      : parsedAmount;
    const chargeAmount = article.funding_goal > 0
      ? Math.min(parsedAmount, remaining)
      : parsedAmount;

    if (chargeAmount <= 0) throw createError(400, "Article is already fully funded");

    const amountCents = Math.round(chargeAmount * 100);
    const creditTier  = determineCreditTier(chargeAmount, article.funding_goal);

    // Attach metadata so the webhook knows what to record on confirmation
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency: "usd",
      metadata: {
        longform_article_id: article_id,
        longform_user_id:    req.user.id,
        longform_credit_tier: creditTier,
      },
      description: `Longform: "${article.title}"`,
    });

    res.json({ clientSecret: paymentIntent.client_secret, amountCharged: chargeAmount });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/payments/webhook ────────────────────────────────────────────────
// Stripe calls this when a payment is confirmed. This is the authoritative
// place to grant access — never trust client-side confirmation alone.
// IMPORTANT: Nginx must NOT buffer this route (proxy_request_buffering off)
// so the raw body is available for signature verification.
router.post(
  "/webhook",
  // Raw body is needed for Stripe signature verification
  // express.raw is applied specifically to this route in index.js
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,                      // raw Buffer (not parsed JSON)
        req.headers["stripe-signature"],
        config.stripe.webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    if (event.type === "payment_intent.succeeded") {
      await handlePaymentSuccess(event.data.object);
    }

    // Always return 200 so Stripe doesn't retry unnecessarily
    res.json({ received: true });
  }
);

async function handlePaymentSuccess(paymentIntent) {
  const { id: stripeIntentId, amount, metadata } = paymentIntent;
  const { longform_article_id, longform_user_id, longform_credit_tier } = metadata;

  if (!longform_article_id || !longform_user_id) {
    console.warn("Received Stripe payment without Longform metadata:", stripeIntentId);
    return;
  }

  await db.transaction(async (client) => {
    // Idempotency: skip if this intent was already recorded (webhook retries)
    const existing = await client.query(
      "SELECT id FROM contributions WHERE stripe_payment_intent = $1",
      [stripeIntentId]
    );
    if (existing.rows.length > 0) return;

    await client.query(
      `INSERT INTO contributions
         (user_id, article_id, amount_cents, stripe_payment_intent, credit_tier)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        longform_user_id,
        longform_article_id,
        amount,            // already in cents from Stripe
        stripeIntentId,
        longform_credit_tier,
      ]
    );

    // amount_raised is updated automatically by the database trigger
  });

  console.log(`Payment recorded: ${stripeIntentId} — user ${longform_user_id} → article ${longform_article_id}`);
}

export default router;
