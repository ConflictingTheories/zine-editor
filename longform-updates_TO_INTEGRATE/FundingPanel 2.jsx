import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { createPaymentIntent } from "../api/payments.js";
import {
  dollarsToMicro,
  formatMicro,
  isAboveMinimum,
  remainingMicro,
  fundingPercent,
} from "../utils/currency.js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ── Quick-pick amounts defined in micro-units — no floats anywhere ────────────
const QUICK_AMOUNTS_MICRO = [5_000_000, 10_000_000, 25_000_000]; // $5, $10, $25

// ── Inner Stripe form ─────────────────────────────────────────────────────────
function StripePaymentForm({ chargeMicro, onSuccess, onCancel }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [error,      setError]      = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message);
      setProcessing(false);
    } else {
      onSuccess(chargeMicro);
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
            fontSize: 14, fontWeight: 600,
            cursor: processing ? "default" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "background 0.15s",
          }}
        >
          {processing ? "Processing…" : `Pay ${formatMicro(chargeMicro)}`}
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

// ── Outer panel — amount input + PaymentIntent creation ───────────────────────
export default function FundingPanel({ article, onFunded }) {
  const [step,         setStep]         = useState("input");
  const [dollarInput,  setDollarInput]  = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [chargeMicro,  setChargeMicro]  = useState(0);
  const [error,        setError]        = useState(null);

  const goalMicro    = article.funding_goal_micro;
  const raisedMicro  = article.amount_raised_micro;
  const leftMicro    = remainingMicro(goalMicro, raisedMicro);
  const pct          = fundingPercent(goalMicro, raisedMicro);

  // Convert from quick-pick or text input to micro-units, then initiate payment
  const initiatePayment = async (micro) => {
    if (!isAboveMinimum(micro)) {
      setError("Minimum contribution is $0.50");
      return;
    }
    try {
      setError(null);
      const { clientSecret: secret, chargeAmountMicro } =
        await createPaymentIntent(article.id, micro);
      setClientSecret(secret);
      setChargeMicro(chargeAmountMicro);
      setStep("stripe");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInputSubmit = () => {
    // Convert at the input boundary — only place dollars exist on the client
    const micro = dollarsToMicro(dollarInput);
    if (!micro) { setError("Enter a valid amount"); return; }
    initiatePayment(micro);
  };

  const handleSuccess = (micro) => {
    setStep("input");
    setDollarInput("");
    setClientSecret(null);
    onFunded(micro);
  };

  return (
    <div style={{
      background: "#FBF3E4", border: "1px solid #E8D5A8",
      borderRadius: 16, padding: "24px 28px",
    }}>
      <h3 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 18, color: "#1A1410", marginBottom: 4,
      }}>
        Fund this article
      </h3>
      <p style={{ fontSize: 12, color: "#6B5E52", marginBottom: 16 }}>
        Any contribution grants immediate access and earns a producer credit
      </p>

      {goalMicro > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            width: "100%", height: 4, background: "#DDD5C5",
            borderRadius: 2, overflow: "hidden", marginBottom: 6,
          }}>
            <div style={{
              width: `${pct}%`, height: "100%",
              background: "linear-gradient(90deg, #C8862A, #E8A84A)",
              borderRadius: 2, transition: "width 0.6s ease",
            }} />
          </div>
          <p style={{ fontSize: 12, color: "#6B5E52" }}>
            {formatMicro(raisedMicro)} raised · {formatMicro(leftMicro)} remaining
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
                type="number" min="0.50" step="0.01" placeholder="0.00"
                value={dollarInput}
                onChange={(e) => setDollarInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInputSubmit()}
                style={{
                  width: "100%", padding: "10px 12px 10px 28px",
                  border: "1px solid #E8D5A8", borderRadius: 10,
                  fontSize: 14, color: "#1A1410", background: "white",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
            <button
              onClick={handleInputSubmit}
              disabled={!dollarInput}
              style={{
                padding: "10px 20px", background: "#1A1410",
                color: "#F5F0E8", border: "none", borderRadius: 10,
                cursor: dollarInput ? "pointer" : "default",
                fontSize: 13, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                opacity: dollarInput ? 1 : 0.4,
                transition: "opacity 0.15s", whiteSpace: "nowrap",
              }}
            >
              Continue
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {QUICK_AMOUNTS_MICRO
              .filter((a) => goalMicro === 0 || a < leftMicro)
              .map((micro) => (
                <button key={micro} onClick={() => initiatePayment(micro)} style={{
                  padding: "5px 12px", background: "white",
                  border: "1px solid #E8D5A8", borderRadius: 20,
                  fontSize: 12, color: "#6B5E52", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {formatMicro(micro)}
                </button>
              ))}
            {goalMicro > 0 && leftMicro > 0 && (
              <button
                onClick={() => initiatePayment(leftMicro)}
                style={{
                  padding: "5px 12px", background: "white",
                  border: "1px solid #C8862A", borderRadius: 20,
                  fontSize: 12, color: "#C8862A", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                }}
              >
                Fund all {formatMicro(leftMicro)} — free it for everyone
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
            chargeMicro={chargeMicro}
            onSuccess={handleSuccess}
            onCancel={() => setStep("input")}
          />
        </Elements>
      )}
    </div>
  );
}
