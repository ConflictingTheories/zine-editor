-- Longform database schema
-- Safe to run repeatedly (CREATE TABLE/INDEX IF NOT EXISTS, idempotent)
--
-- CURRENCY: All monetary values are stored as BIGINT micro-units.
--   1 USD = 1,000,000 micro-units
--   1 cent = 10,000 micro-units
-- This eliminates all floating-point arithmetic on money.
-- See src/services/currency.js for conversion constants.

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Articles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  excerpt          TEXT        NOT NULL DEFAULT '' CHECK (char_length(excerpt) <= 500),
  content          TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 200000),
  tags             TEXT[]      NOT NULL DEFAULT '{}',

  -- Monetary values: BIGINT micro-units (1 USD = 1,000,000).
  -- funding_goal_micro = 0 means the article is free (no goal).
  funding_goal_micro   BIGINT  NOT NULL DEFAULT 0 CHECK (funding_goal_micro >= 0),

  -- amount_raised_micro is derived — maintained by the trigger below.
  -- Never write to this column directly from application code.
  amount_raised_micro  BIGINT  NOT NULL DEFAULT 0 CHECK (amount_raised_micro >= 0),

  published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Contributions ─────────────────────────────────────────────────────────────
-- A row is only inserted AFTER Stripe confirms payment via signed webhook.
-- credit_tier is intentionally NOT stored here — it is derived at read time
-- from the user's cumulative total, so it is always accurate even when someone
-- reaches Executive threshold across multiple contributions.
CREATE TABLE IF NOT EXISTS contributions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  article_id            UUID        NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

  -- BIGINT micro-units. 1 USD = 1,000,000. Never use INTEGER (overflows at ~$2,147).
  amount_micro          BIGINT      NOT NULL CHECK (amount_micro > 0),

  stripe_payment_intent TEXT        NOT NULL UNIQUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Refresh Tokens ────────────────────────────────────────────────────────────
-- Stored hashed so tokens can be revoked server-side (logout, security events).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_articles_author        ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_published     ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_user     ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_article  ON contributions(article_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_article ON contributions(user_id, article_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ── Trigger: keep amount_raised_micro in sync ─────────────────────────────────
-- Maintains the running total as an integer sum of integer micro-units.
-- No division, no floating point — pure integer arithmetic throughout.

CREATE OR REPLACE FUNCTION sync_amount_raised_micro()
RETURNS TRIGGER AS $$
DECLARE
  target_article_id UUID;
BEGIN
  target_article_id := COALESCE(NEW.article_id, OLD.article_id);

  UPDATE articles
  SET amount_raised_micro = (
    SELECT COALESCE(SUM(amount_micro), 0)
    FROM contributions
    WHERE article_id = target_article_id
  )
  WHERE id = target_article_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_amount_raised ON contributions;
CREATE TRIGGER trg_sync_amount_raised
  AFTER INSERT OR DELETE ON contributions
  FOR EACH ROW EXECUTE FUNCTION sync_amount_raised_micro();
