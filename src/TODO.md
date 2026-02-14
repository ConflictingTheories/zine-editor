# Void Press Economy - Implementation Roadmap

## Vision: The "Void" Economy
1. **Fiat On-Ramp**: Users buy "Void Credits" (VPC) via Stripe.
2. **Platform Issuance**: VPC are XRP-based IOUs issued by the Platform Wallet.
3. **Creator Economy**: Creators issue their own tokens (e.g., "ART") via Trust Lines.
4. **Interoperability**: Creators can accept other creators' tokens if trust exists.

## Phase 1: Infrastructure & Configuration
- [ ] **Environment Setup**: Configure `XRPL_NODE_URL`, `PLATFORM_WALLET_SEED`, `STRIPE_KEYS`.
- [ ] **Platform Wallet**: Generate/Fund the master issuer wallet for "VPC" credits.
- [ ] **Database**: Ensure `users` table has `xrp_address` and `xrp_seed` (encrypted).

## Phase 2: Core XRP Services (`xrpService.js`)
- [ ] **Wallet Management**: Generate custodial wallets for users.
- [ ] **Trust Lines**: 
    - Users must trust Platform Wallet to receive VPC.
    - Users must trust Creator Wallets to receive Creator Tokens.
- [ ] **Issuance**: 
    - Platform sends Payment (VPC) to User upon Stripe success.
    - Creator sends Payment (Token) to User upon purchase.

## Phase 3: Economy Services (`economyService.js`)
- [ ] **Stripe Integration**:
    - `createPaymentIntent`: Initiate fiat purchase.
    - `handleWebhook`: Trigger XRP issuance on `payment_intent.succeeded`.
- [ ] **Subscription Logic**:
    - Periodic XRP payments from User Wallet to Creator Wallet.
    - Check balance/trust lines before renewing.

## Phase 4: API Layer
- [ ] `POST /api/economy/wallet` - Create/Get user wallet.
- [ ] `POST /api/economy/trust` - Establish trust line (Platform or Creator).
- [ ] `POST /api/economy/buy-credits` - Start Stripe flow.
- [ ] `POST /api/economy/issue-token` - Creator issues new currency.

## Phase 5: Frontend Integration
- [ ] **Dashboard**: Show VPC Balance (query XRPL).
- [ ] **Creator Studio**: "Mint Token" interface.
- [ ] **Discover**: "Subscribe with VPC" button.

## Technical Dependencies
- `xrpl`: For ledger interaction.
- `stripe`: For fiat processing.
- `crypto-js`: For encrypting custodial keys (if not using KMS).

## Security Note
Currently storing seeds in DB for custodial experience. 
Future: Move to non-custodial (xumm/gem) or use HSM.
