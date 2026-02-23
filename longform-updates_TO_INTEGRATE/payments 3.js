import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db/pool.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/authenticate.js";
import { createError } from "../middleware/errorHandler.js";
import { computeCreditTier } from "../services/contributionService.js";
import {
  dollarsToMicro,
  microToStripeUnits,
  stripeUnitsToMicro,
  assertMeetsMinimum,
  microToDollarsDisplay,
} from "../services/currency.js";

const router = Router();
const stripe = new Stripe(config.stripe.secretKey);

// ── POST /api/payments/create-intent ─────────────────────────────────────────
// Accepts amount_micro (integer) from the client — no floats accepted.
// Uses SELECT FOR UPDATE to prevent race conditions on the remaining balance.
router.post("/create-intent", authenticate, async (req, res, next) => {
  try {
    const { article_id, amount_micro } = req.body;
    if (!article_id)    throw createError(400, "article_id is required");
    if (!amount_micro)  throw createError(400, "amount_micro is required");

    const requestedMicro = parseInt(amount_micro, 10);
    if (!Number.isInteger(requestedMicro) || requestedMicro <= 0) {
      throw createError(400, "amount_micro must be a positive integer");
    }

    assertMeetsMinimum(requestedMicro); // throws if below minimum

    // ── Race-safe remaining balance check ─────────────────────────────────────
    // SELECT FOR UPDATE locks the article row for the duration of this
    // transaction, preventing two simultaneous payments from both seeing the
    // same remaining balance and both over-funding the article.
    const { chargeMicro, article } = await db.transaction(async (client) => {
      const lockedArticle = await client.query(
        "SELECT id, title, funding_goal_micro, amount_raised_micro FROM articles WHERE id = $1 FOR UPDATE",
        [article_id]
      );

      if (lockedArticle.rows.length === 0) throw createError(404, "Article not found");
      const art = lockedArticle.rows[0];

      // Convert BIGINT strings from pg driver to numbers
      const goalMicro    = Number(art.funding_goal_micro);
      const raisedMicro  = Number(art.amount_raised_micro);

      if (goalMicro > 0 && raisedMicro >= goalMicro) {
        throw createError(400, "Article is already fully funded");
      }

      // Clamp to remaining balance so we never over-charge
      const remainingMicro = goalMicro > 0
        ? Math.max(0, goalMicro - raisedMicro)
        : requestedMicro;

      const finalMicro = goalMicro > 0
        ? Math.min(requestedMicro, remainingMicro)
        : requestedMicro;

      return { chargeMicro: finalMicro, article: art };
    });

    const stripeUnits = microToStripeUnits(chargeMicro);

    // Attach metadata so the webhook can record the contribution without
    // trusting any client-supplied values at confirmation time
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   stripeUnits,
      currency: "usd",
      metadata: {
        longform_article_id:  article_id,
        longform_user_id:     req.user.id,
        longform_amount_micro: String(chargeMicro), // store as string in Stripe metadata
      },
      description: `Longform: "${article.title}"`,
    });

    res.json({
      clientSecret:      paymentIntent.client_secret,
      chargeAmountMicro: chargeMicro,
      chargeDisplay:     microToDollarsDisplay(chargeMicro),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/payments/webhook ────────────────────────────────────────────────
// Stripe calls this on payment confirmation. It is the ONLY place we record
// contributions — client-side "success" events are never trusted.
//
// Critical requirements for this endpoint:
//   1. Must always respond 200, even on internal errors (or Stripe will retry)
//   2. Must be idempotent (webhook retries must not double-record)
//   3. express.raw() must be applied before express.json() — see index.js
router.post("/webhook", async (req, res) => {
  // Always respond 200 — put everything in try/finally so Stripe is never left
  // waiting for a response that never comes
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      config.stripe.webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  // Handle the event asynchronously but don't let errors reach Stripe
  try {
    if (event.type === "payment_intent.succeeded") {
      await handlePaymentSuccess(event.data.object);
    }
  } catch (err) {
    // Log but do NOT re-throw — Stripe must get 200 or it will retry indefinitely
    console.error(`Webhook handler failed for event ${event.id}:`, err.message);
  }

  res.json({ received: true });
});

async function handlePaymentSuccess(paymentIntent) {
  const { id: stripeIntentId, amount: stripeUnits, metadata } = paymentIntent;
  const { longform_article_id, longform_user_id, longform_amount_micro } = metadata;

  if (!longform_article_id || !longform_user_id || !longform_amount_micro) {
    console.warn("Skipping Stripe payment with missing Longform metadata:", stripeIntentId);
    return;
  }

  // Convert from the authoritative Stripe amount (not the metadata, in case of
  // any rounding during PaymentIntent creation) — but use metadata for traceability
  const confirmedMicro = stripeUnitsToMicro(stripeUnits);

  await db.transaction(async (client) => {
    // Idempotency guard — webhook retries must not create duplicate contributions
    const existing = await client.query(
      "SELECT id FROM contributions WHERE stripe_payment_intent = $1",
      [stripeIntentId]
    );
    if (existing.rows.length > 0) {
      console.info(`Skipping duplicate webhook for intent ${stripeIntentId}`);
      return;
    }

    // Record the contribution in micro-units — trigger updates amount_raised_micro
    await client.query(
      `INSERT INTO contributions (user_id, article_id, amount_micro, stripe_payment_intent)
       VALUES ($1, $2, $3, $4)`,
      [longform_user_id, longform_article_id, confirmedMicro, stripeIntentId]
    );
  });

  console.log(
    `Contribution recorded: ${stripeIntentId} — ` +
    `user ${longform_user_id} → article ${longform_article_id} — ` +
    `${microToDollarsDisplay(confirmedMicro)}`
  );
}

export default router;
