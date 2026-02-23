import { apiClient } from "./client.js";

// Returns { clientSecret, amountCharged }
export const createPaymentIntent = (articleId, amountDollars) =>
  apiClient.post("/payments/create-intent", {
    article_id:     articleId,
    amount_dollars: amountDollars,
  });
