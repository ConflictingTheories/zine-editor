// ── Micro-unit currency system ────────────────────────────────────────────────
//
// All monetary values are stored and passed internally as integer micro-units.
// This eliminates every class of floating-point rounding error.
//
// For USD:
//   1 dollar      = 1,000,000 micro-units
//   1 cent        = 10,000    micro-units
//   1 Stripe unit = 10,000    micro-units  (Stripe uses cents as its base unit)
//
// The only place dollars appear is at the API boundary (user input / display).
// They are converted to micro-units immediately on entry and never used again
// for arithmetic.
//
// To add a new currency, add its MICRO_PER_STRIPE_UNIT here and pass the
// currency code through the payment flow. Nothing else needs to change.

export const Currency = {
  USD: {
    code:               "usd",
    microPerUnit:       1_000_000,   // micro-units per dollar
    microPerStripUnit:  10_000,      // Stripe uses cents; 1 cent = 10,000 micro
    minimumMicro:       500_000,     // $0.50 minimum contribution
  },
};

// Default currency for this deployment — change here to support others
export const DEFAULT_CURRENCY = Currency.USD;

// ── Conversion functions ──────────────────────────────────────────────────────

// Parse a user-supplied dollar string/number into micro-units.
// Rejects non-finite, negative, and fractional-micro values.
export function dollarsToMicro(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`Invalid dollar amount: ${dollars}`);
  }
  // Round to nearest micro to handle any floating-point in the input itself
  return Math.round(n * DEFAULT_CURRENCY.microPerUnit);
}

// Format micro-units as a human-readable dollar string. Display only — never
// use this value for arithmetic.
export function microToDollarsDisplay(micro) {
  const dollars = micro / DEFAULT_CURRENCY.microPerUnit;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Convert micro-units to Stripe's unit (cents). Used only when creating a
// PaymentIntent — Stripe receives an integer, never a float.
export function microToStripeUnits(micro) {
  if (micro % DEFAULT_CURRENCY.microPerStripUnit !== 0) {
    throw new RangeError(
      `Amount ${micro} micro-units is not evenly divisible into Stripe units. ` +
      `Minimum chargeable unit is ${DEFAULT_CURRENCY.microPerStripUnit} micro-units.`
    );
  }
  return micro / DEFAULT_CURRENCY.microPerStripUnit;
}

// Convert Stripe's units (cents) back to micro-units. Used only in the webhook
// when recording a confirmed payment.
export function stripeUnitsToMicro(stripeUnits) {
  return stripeUnits * DEFAULT_CURRENCY.microPerStripUnit;
}

// Validate that a micro-unit amount meets the contribution minimum.
export function assertMeetsMinimum(micro) {
  if (micro < DEFAULT_CURRENCY.minimumMicro) {
    throw new RangeError(
      `Contribution of ${micro} micro-units is below the minimum of ` +
      `${DEFAULT_CURRENCY.minimumMicro} (${microToDollarsDisplay(DEFAULT_CURRENCY.minimumMicro)})`
    );
  }
}
