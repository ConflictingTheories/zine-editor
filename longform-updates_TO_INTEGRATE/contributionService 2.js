import { config } from "../config.js";
import { DEFAULT_CURRENCY } from "./currency.js";

export const CreditTier = {
  ASSOCIATE: "Associate Producer",
  EXECUTIVE: "Executive Associate Producer",
};

// ── Credit tier ───────────────────────────────────────────────────────────────
// Computed from the user's CUMULATIVE contribution total against the article's
// funding goal. Always derived at read time — never stored — so it is accurate
// even when someone reaches Executive threshold across multiple payments.

export function computeCreditTier(cumulativeMicro, fundingGoalMicro) {
  if (!fundingGoalMicro || fundingGoalMicro === 0) {
    // Free article — still give Associate credit for any contribution
    return CreditTier.ASSOCIATE;
  }
  const fraction = cumulativeMicro / fundingGoalMicro;
  return fraction >= config.credits.executiveProducerMinFraction
    ? CreditTier.EXECUTIVE
    : CreditTier.ASSOCIATE;
}

// ── Funding state ─────────────────────────────────────────────────────────────

export function isFunded(article) {
  return (
    article.funding_goal_micro === 0 ||
    article.amount_raised_micro >= article.funding_goal_micro
  );
}

export function remainingMicro(article) {
  if (article.funding_goal_micro === 0) return 0;
  return Math.max(0, article.funding_goal_micro - article.amount_raised_micro);
}

// ── Access control ────────────────────────────────────────────────────────────
// Strip full content from articles the user has not paid for.
// userTotalMicro is the sum of all this user's contributions to this article.

export function applyAccessControl(article, userId, userTotalMicro) {
  const funded       = isFunded(article);
  const isAuthor     = article.author_id === userId;
  const hasPaid      = userTotalMicro > 0;
  const canReadFully = funded || isAuthor || hasPaid;

  if (canReadFully) return { ...article, locked: false };

  // Unauthenticated or unpaid — return first paragraph only
  const previewContent = article.content.split("\n\n")[0];
  return {
    ...article,
    content: previewContent,
    locked: true,
  };
}
