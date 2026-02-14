# XRP PayID Integration - Implementation TODO

## Phase 1: Database Schema & Backend API

### Database Tables (server/server.cjs)
- [ ] credits - User credit balances (fiat-purchased)
- [ ] wallets - XRP wallet connections
- [ ] tokens - Creator-issued tokens
- [ ] trust_lines - XRP trust line status
- [ ] subscriptions - Creator-subscriber relationships
- [ ] bids - Content bidding system
- [ ] transactions - All financial transactions
- [ ] reputation - User reputation scores

### Backend API Endpoints
- [ ] POST /api/credits/purchase - Buy credits
- [ ] GET /api/credits/balance - Get balance
- [ ] POST /api/wallet/create - Create wallet
- [ ] POST /api/wallet/import - Import wallet
- [ ] POST /api/tokens/create - Issue token
- [ ] GET /api/tokens - List tokens
- [ ] POST /api/tokens/:id/buy - Buy tokens
- [ ] POST /api/trustlines/create - Create trust line
- [ ] GET /api/trustlines - List trust lines
- [ ] POST /api/subscriptions/subscribe - Subscribe
- [ ] POST /api/subscriptions/cancel - Cancel
- [ ] POST /api/bids/create - Place bid
- [ ] POST /api/bids/:id/accept - Accept bid
- [ ] GET /api/reputation/:userId - Get reputation
- [ ] GET /api/market - Token marketplace

## Phase 2: Frontend Components
- [ ] WalletModal.jsx - XRP wallet connection
- [ ] CreditPurchase.jsx - Buy credits UI
- [ ] TokenIssuance.jsx - Create tokens
- [ ] TokenMarketplace.jsx - Browse/buy tokens
- [ ] SubscriptionManager.jsx - Manage subs
- [ ] BiddingPanel.jsx - Bid on content
- [ ] CreatorMonetization.jsx - Creator dashboard
- [ ] ReputationBadge.jsx - Display reputation
- [ ] xrpClient.js - XRP Ledger library

## Phase 3: Integration
- [ ] XRPayIDContext.jsx - New context
- [ ] Integrate with VPContext
- [ ] Add to TopNav - wallet/credits display
- [ ] Add monetization tab to Dashboard

## Phase 4: XRP Ledger Integration (xrpl.js)
- [ ] Wallet generation
- [ ] Trust line creation
- [ ] Token transfers
- [ ] Payment processing
