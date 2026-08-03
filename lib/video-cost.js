/**
 * Rate-card cost estimation for Higgsfield generations.
 *
 * Researched and confirmed: Higgsfield exposes NO MCP tool or REST endpoint
 * for credit balance or per-generation cost — usage/credits are dashboard-only
 * (cloud.higgsfield.ai). There is no way to check balance before firing a call,
 * which is also why generation calls have failed with zero advance warning
 * whenever credits ran out during testing. Given that, every number here is a
 * RATE-CARD ESTIMATE derived from Higgsfield's published per-model pricing —
 * never a real billed value read from an API. Tune PRICE_PER_CREDIT_USD and
 * the per-model credit costs below as real invoices/pricing pages are checked.
 */

// Approximate credits-to-USD conversion (500 credits ≈ $50 on the Creator plan)
const PRICE_PER_CREDIT_USD = 0.1;

// Approximate credit cost per generation call, by model — placeholders to be
// refined against Higgsfield's actual published per-model/resolution/duration
// pricing table (higgsfield.ai/pricing).
const CREDITS_PER_CALL = {
  soul_2: 4, // still image
  seedance_2_0: 12, // per ~5s of 9:16 video with native audio — scaled by duration below
};

const SEEDANCE_BASE_SECONDS = 5;

export function estimateStillCost(count = 1) {
  return Math.round(CREDITS_PER_CALL.soul_2 * count * PRICE_PER_CREDIT_USD * 100) / 100;
}

export function estimateSegmentCost({ hasCharacter, duration }) {
  const stillCredits = CREDITS_PER_CALL.soul_2;
  const seconds = duration || SEEDANCE_BASE_SECONDS;
  const videoCredits = CREDITS_PER_CALL.seedance_2_0 * (seconds / SEEDANCE_BASE_SECONDS);
  const totalCredits = stillCredits + videoCredits;
  return Math.round(totalCredits * PRICE_PER_CREDIT_USD * 100) / 100;
}
