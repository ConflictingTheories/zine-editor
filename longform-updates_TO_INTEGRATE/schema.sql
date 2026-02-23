-- Longform database schema
-- Safe to run repeatedly (CREATE IF NOT EXISTS, idempotent)

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Articles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  excerpt        TEXT        NOT NULL DEFAULT '',
  content        TEXT        NOT NULL,
  tags           TEXT[]      NOT NULL DEFAULT '{}',
  funding_goal   INTEGER     NOT NULL DEFAULT 0 CHECK (funding_goal >= 0),
  -- amount_raised is a derived value maintained by triggers for consistency
  amount_raised  INTEGER     NOT NULL DEFAULT 0 CHECK (amount_raised >= 0),
  published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Contributions ─────────────────────────────────────────────────────────────
-- A contribution is only recorded AFTER Stripe confirms payment via webhook.
CREATE TABLE IF NOT EXISTS contributions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id              UUID        NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  -- Amount in cents to avoid floating point issues
  amount_cents            INTEGER     NOT NULL CHECK (amount_cents > 0),
  stripe_payment_intent   TEXT        NOT NULL UNIQUE,
  credit_tier             TEXT        NOT NULL CHECK (credit_tier IN ('Associate Producer', 'Executive Associate Producer')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Refresh Tokens ────────────────────────────────────────────────────────────
-- Stored so tokens can be revoked (logout, security incidents)
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
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ── Trigger: keep amount_raised in sync ───────────────────────────────────────
-- Rather than querying SUM() on every read, we maintain a running total.

CREATE OR REPLACE FUNCTION sync_article_amount_raised()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE articles
  SET amount_raised = (
    SELECT COALESCE(SUM(amount_cents), 0) / 100
    FROM contributions
    WHERE article_id = COALESCE(NEW.article_id, OLD.article_id)
  )
  WHERE id = COALESCE(NEW.article_id, OLD.article_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contribution_insert ON contributions;
CREATE TRIGGER trg_contribution_insert
  AFTER INSERT OR DELETE ON contributions
  FOR EACH ROW EXECUTE FUNCTION sync_article_amount_raised();
