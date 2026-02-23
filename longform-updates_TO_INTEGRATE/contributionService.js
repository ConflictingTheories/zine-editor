import { config } from "../config.js";

export const CreditTier = {
  ASSOCIATE:         "Associate Producer",
  EXECUTIVE:         "Executive Associate Producer",
};

export function determineCreditTier(contributionAmountDollars, fundingGoalDollars) {
  if (!fundingGoalDollars) return CreditTier.ASSOCIATE;
  const fraction = contributionAmountDollars / fundingGoalDollars;
  return fraction >= config.credits.executiveProducerMinFraction
    ? CreditTier.EXECUTIVE
    : CreditTier.ASSOCIATE;
}

export function isFunded(article) {
  return article.funding_goal === 0 || article.amount_raised >= article.funding_goal;
}

// After a new contribution, should the article now be considered funded?
export function willBeFullyFunded(article, newContributionDollars) {
  if (article.funding_goal === 0) return false;
  return (article.amount_raised + newContributionDollars) >= article.funding_goal;
}

// Strip full content from articles the user has not paid for
export function applyAccessControl(article, userId, userContributions) {
  const funded        = isFunded(article);
  const isAuthor      = article.author_id === userId;
  const hasPaid       = userContributions?.some((c) => c.article_id === article.id);
  const canReadFully  = funded || isAuthor || hasPaid;

  if (canReadFully) return article;

  // Return excerpt + first paragraph only — client shows paywall
  const firstParagraph = article.content.split("\n\n")[0];
  return {
    ...article,
    content: firstParagraph,
    locked: true,
  };
}
