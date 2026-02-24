import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { createPaymentIntent, getZineFunding, contributeToZine, getZineProducers } from "../api/index.js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ── Inner form — rendered inside <Elements> with a live clientSecret ──────────
function StripePaymentForm({ amountDollars, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required", // no redirect for card payments
    });

    if (stripeError) {
      setError(stripeError.message);
      setProcessing(false);
    } else {
      // Payment confirmed client-side. Webhook will record it server-side.
      // We poll briefly for the contribution to appear, then call onSuccess.
      onSuccess(amountDollars);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <PaymentElement />

      {error && (
        <p style={{ color: "#CC3333", fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          type="submit"
          disabled={!stripe || processing}
          style={{
            flex: 1, padding: "11px 0",
            background: processing ? "#555" : "#1A1410",
            color: "#F5F0E8", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: processing ? "default" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "background 0.15s",
          }}
        >
          {processing ? "Processing…" : `Pay $${amountDollars.toFixed(2)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "11px 18px", background: "white",
            border: "1px solid #DDD5C5", borderRadius: 10,
            fontSize: 14, color: "#6B5E52", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Outer panel — handles amount input and PaymentIntent creation ─────────────
export default function FundingPanel({ zine, onFunded, onContribute }) {
  const [step, setStep] = useState("input");   // "input" | "stripe"
  const [amount, setAmount] = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [confirmedAmt, setConfirmedAmt] = useState(null);
  const [error, setError] = useState(null);
  const [fundingInfo, setFundingInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [producers, setProducers] = useState([]);
  const [showProducers, setShowProducers] = useState(false);

  // Load funding info
  useEffect(() => {
    if (zine?.id) {
      loadFundingInfo();
    }
  }, [zine?.id]);

  const loadFundingInfo = async () => {
    try {
      const info = await getZineFunding(zine.id);
      setFundingInfo(info);
    } catch (err) {
      console.error('Failed to load funding info:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load producers (contributors with tiers)
  const loadProducers = async () => {
    try {
      const producerData = await getZineProducers(zine.id);
      setProducers(producerData);
    } catch (err) {
      console.error('Failed to load producers:', err);
    }
  };

  // Toggle producers display
  const toggleProducers = () => {
    if (!showProducers && producers.length === 0) {
      loadProducers();
    }
    setShowProducers(!showProducers);
  };

  // Calculate remaining based on funding info
  const remaining = fundingInfo?.fundingGoal > 0
    ? Math.max(0, fundingInfo.fundingGoal - fundingInfo.amountRaised)
    : null;

  const isFunded = fundingInfo?.isFunded || (zine?.is_funded && zine?.funding_goal > 0);

  const quickAmounts = [5, 10, 25].filter(
    (a) => remaining === null || a < remaining
  );

  const initiatePayment = async (dollarAmount) => {
    const parsed = parseFloat(dollarAmount);
    if (!parsed || parsed < 0.50) {
      setError("Minimum contribution is $0.50");
      return;
    }
    try {
      const { clientSecret: secret, amountCharged } =
        await createPaymentIntent(zine.id, parsed);
      setClientSecret(secret);
      setConfirmedAmt(amountCharged);
      setStep("stripe");
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSuccess = async (amountDollars) => {
    try {
      // Record contribution on the server
      await contributeToZine(zine.id, amountDollars, null);

      // Refresh funding info
      await loadFundingInfo();

      if (onFunded) {
        onFunded(amountDollars);
      }
      if (onContribute) {
        onContribute(amountDollars);
      }
    } catch (err) {
      console.error('Failed to record contribution:', err);
    }

    setStep("input");
    setAmount("");
    setClientSecret(null);
  };

  if (loading) {
    return (
      <div style={{
        background: "#FBF3E4", border: "1px solid #E8D5A8",
        borderRadius: 16, padding: "24px 28px",
      }}>
        <p style={{ color: "#6B5E52", textAlign: "center" }}>Loading funding info...</p>
      </div>
    );
  }

  // Already funded - show "Free for everyone" badge
  if (isFunded) {
    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(62, 240, 192, 0.15))",
        border: "1px solid rgba(124, 92, 252, 0.3)",
        borderRadius: 16, padding: "24px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>🎉</span>
          <div>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18, color: "#1A1410", margin: 0,
            }}>
              Funding Goal Reached!
            </h3>
            <p style={{ fontSize: 12, color: "#6B5E52", marginTop: 4 }}>
              This content is now free for everyone thanks to our contributors!
            </p>
          </div>
        </div>

        {fundingInfo?.amountRaised > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: "#6B5E52", marginBottom: 4 }}>
              Total raised: ${fundingInfo.amountRaised.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: "#FBF3E4", border: "1px solid #E8D5A8",
      borderRadius: 16, padding: "24px 28px",
    }}>
      <h3 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 18, color: "#1A1410", marginBottom: 4,
      }}>
        Fund this {zine?.monetization_type === 'crowdfund' ? 'Project' : 'Content'}
      </h3>
      <p style={{ fontSize: 12, color: "#6B5E52", marginBottom: 16 }}>
        Any contribution grants immediate access and earns a producer credit
      </p>

      {remaining !== null && (
        <div>
          <div style={{
            width: "100%", height: 4, background: "#DDD5C5",
            borderRadius: 2, overflow: "hidden", marginBottom: 6,
          }}>
            <div style={{
              width: `${Math.min(100, (fundingInfo?.amountRaised / fundingInfo?.fundingGoal) * 100)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #C8862A, #E8A84A)",
              borderRadius: 2, transition: "width 0.6s ease",
            }} />
          </div>
          <p style={{ fontSize: 12, color: "#6B5E52", marginBottom: 16 }}>
            ${fundingInfo?.amountRaised?.toFixed(2) || 0} raised · ${remaining.toFixed(2)} remaining
          </p>
        </div>
      )}

      {step === "input" && (
        <>
          {error && (
            <p style={{ color: "#CC3333", fontSize: 13, marginBottom: 10 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{
                position: "absolute", left: 14, top: "50%",
                transform: "translateY(-50%)",
                color: "#6B5E52", fontSize: 14, pointerEvents: "none",
              }}>$</span>
              <input
                type="number" min="0.50" step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && initiatePayment(amount)}
                style={{
                  width: "100%", padding: "10px 12px 10px 28px",
                  border: "1px solid #E8D5A8", borderRadius: 10,
                  fontSize: 14, color: "#1A1410",
                  fontFamily: "'DM Sans', sans-serif",
                  background: "white",
                }}
              />
            </div>
            <button
              onClick={() => initiatePayment(amount)}
              disabled={!amount}
              style={{
                padding: "10px 20px", background: "#1A1410",
                color: "#F5F0E8", border: "none", borderRadius: 10,
                cursor: amount ? "pointer" : "default", fontSize: 13,
                fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                opacity: amount ? 1 : 0.4, transition: "opacity 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Continue
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {quickAmounts.map((a) => (
              <button
                key={a}
                onClick={() => initiatePayment(a)}
                style={{
                  padding: "5px 12px", background: "white",
                  border: "1px solid #E8D5A8", borderRadius: 20,
                  fontSize: 12, color: "#6B5E52", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ${a}
              </button>
            ))}
            {remaining !== null && remaining > 0 && remaining <= 100 && (
              <button
                onClick={() => initiatePayment(remaining)}
                style={{
                  padding: "5px 12px", background: "white",
                  border: "1px solid #C8862A", borderRadius: 20,
                  fontSize: 12, color: "#C8862A", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                }}
              >
                Fund all ${remaining.toFixed(2)} — free it for everyone
              </button>
            )}
          </div>
        </>
      )}

      {step === "stripe" && clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "stripe" } }}
        >
          <StripePaymentForm
            amountDollars={confirmedAmt}
            onSuccess={handleSuccess}
            onCancel={() => setStep("input")}
          />
        </Elements>
      )}

      {/* Producer Credits Section */}
      {fundingInfo?.amountRaised > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #E8D5A8', paddingTop: 16 }}>
          <button
            onClick={toggleProducers}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B5E52',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            <span style={{ transform: showProducers ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▶</span>
            {showProducers ? 'Hide' : 'Show'} Producer Credits ({producers.length || fundingInfo?.contributorCount?.count || 0})
          </button>

          {showProducers && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {producers.length === 0 ? (
                <p style={{ fontSize: 12, color: '#6B5E52', fontStyle: 'italic' }}>No producers yet. Be the first!</p>
              ) : (
                producers.slice(0, 5).map((producer, idx) => (
                  <div
                    key={producer.user_id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'white',
                      borderRadius: 6,
                      border: producer.credit_tier === 'executive_producer' ? '1px solid #C8862A' : '1px solid #E8D5A8'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        background: producer.credit_tier === 'executive_producer' ? '#C8862A' : '#4b2c5e',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}>
                        {producer.tier_display}
                      </span>
                      <span style={{ fontSize: 13, color: '#1A1410' }}>@{producer.username}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#6B5E52' }}>
                      ${producer.total_contributed?.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
              {producers.length > 5 && (
                <p style={{ fontSize: 11, color: '#6B5E52', textAlign: 'center' }}>
                  +{producers.length - 5} more producers
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
