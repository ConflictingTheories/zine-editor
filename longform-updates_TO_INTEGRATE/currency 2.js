// ── Client-side micro-unit currency utilities ─────────────────────────────────
//
// Mirrors backend/src/services/currency.js
// All API amounts are in micro-units (integers). This file handles the only two
// operations the UI needs: converting user input to micro-units, and formatting
// micro-units for display. Arithmetic always happens in micro-units.

const MICRO_PER_DOLLAR = 1_000_000;
const MINIMUM_MICRO    = 500_000; // $0.50

export function dollarsToMicro(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * MICRO_PER_DOLLAR);
}

export function microToDollars(micro) {
  return micro / MICRO_PER_DOLLAR;
}

// Format for display only — never use the return value for arithmetic
export function formatMicro(micro) {
  return (micro / MICRO_PER_DOLLAR).toLocaleString("en-US", {
    style:    "currency",
    currency: "USD",
  });
}

export function isAboveMinimum(micro) {
  return micro >= MINIMUM_MICRO;
}

export function minimumMicro() {
  return MINIMUM_MICRO;
}

export function fundingPercent(goalMicro, raisedMicro) {
  if (!goalMicro || goalMicro === 0) return 100;
  return Math.min(100, (raisedMicro / goalMicro) * 100);
}

export function remainingMicro(goalMicro, raisedMicro) {
  if (!goalMicro || goalMicro === 0) return 0;
  return Math.max(0, goalMicro - raisedMicro);
}
