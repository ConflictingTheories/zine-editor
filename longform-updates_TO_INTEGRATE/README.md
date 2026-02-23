# Longform

A publishing platform where authors set a funding goal for their articles. Readers pay to unlock access — once the goal is met, the article becomes free for everyone. Contributors earn permanent producer credits.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Public Internet                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ :80 / :443
             ┌─────────▼─────────┐
             │   Nginx (reverse  │  Rate limiting, SSL termination,
             │   proxy + SSL)    │  routes /api → backend,
             └──────┬───────┬───┘  / → frontend
                    │       │
         /api/*     │       │  /*
    ┌───────────────▼──┐ ┌──▼─────────────────┐
    │  Node.js/Express │ │  React (static SPA) │
    │  Backend API     │ │  Served by Nginx    │
    │  :4000           │ │  :80                │
    └────────┬─────────┘ └─────────────────────┘
             │
    ┌────────▼─────────┐    ┌───────────────────┐
    │   PostgreSQL     │    │   Stripe API       │
    │   :5432          │    │   (external)       │
    └──────────────────┘    └───────────────────┘
```

---

## Payment Flow

```
1. User clicks "Continue" with an amount
        │
        ▼
2. Frontend: POST /api/payments/create-intent
   Backend creates a Stripe PaymentIntent with metadata
   (article_id, user_id, credit_tier) attached
        │
        ▼
3. Backend returns { clientSecret }
        │
        ▼
4. Frontend renders <Elements> with Stripe's PaymentElement
   Card data goes DIRECTLY to Stripe — never touches our server
        │
        ▼
5. User submits card → Stripe confirms payment
        │
        ▼
6. Stripe calls POST /api/payments/webhook
   Webhook verifies signature (HMAC), records contribution in DB
   Database trigger updates article.amount_raised automatically
        │
        ▼
7. Frontend polls or receives "success" from Stripe Elements,
   re-fetches article to show updated state + library access
```

**Why the webhook?** Never trust the client to confirm a payment. The webhook is the authoritative signal that money actually moved.

---

## Database Schema

```
users
  id, email, name, password_hash, created_at

articles
  id, author_id → users,
  title, excerpt, content, tags[],
  funding_goal (dollars), amount_raised (maintained by trigger),
  published_at, created_at

contributions
  id, user_id → users, article_id → articles,
  amount_cents, stripe_payment_intent (unique),
  credit_tier (Associate Producer | Executive Associate Producer),
  created_at

refresh_tokens
  id, user_id → users, token_hash, expires_at, created_at
```

**Credit tiers:**
- **Associate Producer** — any contribution
- **Executive Associate Producer** — contributed ≥ 20% of the funding goal (total)

---

## Local Development Setup

### Prerequisites
- Docker + Docker Compose
- A [Stripe account](https://dashboard.stripe.com) (free)
- The [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook testing

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env with your values
```

### 2. Generate secrets

```bash
# JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run twice — one for JWT_SECRET, one for JWT_REFRESH_SECRET
```

### 3. Get Stripe keys

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy **Publishable key** → `STRIPE_PUBLISHABLE_KEY`
3. Copy **Secret key** → `STRIPE_SECRET_KEY`

### 4. Set up local webhook forwarding

```bash
# In a separate terminal
stripe listen --forward-to localhost:4000/api/payments/webhook

# Copy the webhook signing secret printed by the CLI
# → STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Run locally (without Docker)

```bash
# Start just Postgres in Docker
docker compose up postgres -d

# Backend
cd backend
npm install
npm run migrate
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### 6. Run with Docker Compose

```bash
docker compose up --build
```

---

## Production Deployment

### SSL certificates

Place your SSL certificates in `nginx/certs/`:
- `nginx/certs/fullchain.pem`
- `nginx/certs/privkey.pem`

Using Let's Encrypt? Use [Certbot](https://certbot.eff.org/) or [acme.sh](https://acme.sh).

### Stripe webhook endpoint

Add your production URL in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

```
https://yourdomain.com/api/payments/webhook
```

Subscribe to: `payment_intent.succeeded`

Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in your production `.env`.

### Environment checklist

```
[ ] POSTGRES_PASSWORD — strong, unique password
[ ] JWT_SECRET — 64-byte random hex
[ ] JWT_REFRESH_SECRET — different 64-byte random hex
[ ] STRIPE_SECRET_KEY — sk_live_... (not sk_test_)
[ ] STRIPE_PUBLISHABLE_KEY — pk_live_...
[ ] STRIPE_WEBHOOK_SECRET — from Stripe dashboard
[ ] FRONTEND_URL — your actual domain (no trailing slash)
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get tokens |
| POST | `/api/auth/refresh` | — | Rotate tokens |
| POST | `/api/auth/logout` | ✓ | Revoke refresh token |
| GET | `/api/articles` | optional | List articles |
| GET | `/api/articles/:id` | optional | Get article (with access control) |
| POST | `/api/articles` | ✓ | Publish article |
| GET | `/api/articles/library/mine` | ✓ | User's library |
| POST | `/api/payments/create-intent` | ✓ | Create Stripe PaymentIntent |
| POST | `/api/payments/webhook` | Stripe sig | Confirm payment (Stripe only) |
| GET | `/health` | — | Health check |

---

## Extending This

**Crypto payments** — replace the Stripe PaymentIntent with a blockchain payment handler (e.g. USDC on Solana). The webhook pattern stays identical — just swap the payment confirmation source.

**Email notifications** — hook into the `handlePaymentSuccess` function in `payments.js` to send emails when articles are funded or fully unlocked.

**Payouts to authors** — add Stripe Connect to route a percentage of each contribution to the author's connected account.

**Search** — add a `tsvector` column to `articles` and a GIN index for full-text search via PostgreSQL.
