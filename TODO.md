# Marketplace Fix Plan

## Phase 1: Critical Backend Fixes

### 1.1 Fix economyService.cjs - Missing xrpl import
- [ ] Add xrpl import to economyService.cjs
- [ ] Fix PLATFORM_SEED reference

### 1.2 Create .env.example file
- [ ] Document all required environment variables
- [ ] Add XRP testnet credentials guidance

### 1.3 Fix XRP Service Issues
- [ ] Add proper error handling
- [ ] Add fallback for missing credentials

## Phase 2: Frontend Integration

### 2.1 Fix CreditPurchase.jsx
- [ ] Remove hardcoded Stripe key
- [ ] Load from environment/config
- [ ] Add proper loading states
- [ ] Fix error handling

### 2.2 Fix WalletModal.jsx
- [ ] Implement proper wallet connection flow
- [ ] Add XRP wallet generation/connection
- [ ] Add proper UI states

### 2.3 Fix PaymentModal.jsx
- [ ] Implement proper payment flow
- [ ] Add Stripe integration
- [ ] Add XRP payment option

### 2.4 Fix TokenMarketplace.jsx
- [ ] Add loading states
- [ ] Add better error handling
- [ ] Show token-gated indicator

### 2.5 Fix TokenIssuance.jsx
- [ ] Add loading states
- [ ] Show created tokens properly

## Phase 3: Authentication & Security

### 3.1 Fix Protected Routes
- [ ] Ensure monetization dashboard requires login
- [ ] Ensure dashboard features require login
- [ ] Add proper auth guards

### 3.2 Improve VPContext
- [ ] Add proper auth state handling
- [ ] Add redirect logic for protected routes

## Phase 4: UI/UX Improvements

### 4.1 Enhance Dashboard
- [ ] Show monetization features when logged in
- [ ] Add wallet/credits quick view
- [ ] Add quick actions

### 4.2 Enhance Discover
- [ ] Show token-gated content indicators
- [ ] Add purchase prompts for gated content

### 4.3 Enhance MonetizationDashboard
- [ ] Add comprehensive stats
- [ ] Add proper tab navigation
- [ ] Show all relevant information

## Phase 5: Testing & Verification

### 5.1 Test Credit Purchase Flow
- [ ] Test Stripe checkout
- [ ] Verify credit balance update

### 5.2 Test Token Flow
- [ ] Test token creation
- [ ] Test token purchase
- [ ] Test trust line creation

### 5.3 Test XRP Integration
- [ ] Test wallet creation
- [ ] Test payment flow

## Dependencies to Install
- [ ] dotenv (for environment variables)
- [ ] stripe (already installed)
- [ ] xrpl (already installed)
