# Marketplace Comprehensive Fix Plan

## Priority 1: Critical Bug Fixes

### 1.1 Fix TokenIssuance.jsx Syntax Error
- File: src/components/TokenIssuance.jsx
- Issue: Missing closing brace before `{message &&`
- Status: TODO

### 1.2 Fix PaymentModal.jsx API Endpoints
- File: src/components/PaymentModal.jsx
- Issues:
  - Calls `/api/payment/initiate` but server has `/api/stripe/create-checkout-session`
  - Calls `/api/payment/confirm` but server has `/api/stripe/confirm-payment`
  - Missing proper Stripe integration
- Status: TODO

### 1.3 Fix WalletModal.jsx Wallet Generation
- File: src/components/WalletModal.jsx
- Issue: Generates fake wallet addresses (`r` + random string)
- Should use proper xrpl.js or at least validate XRP address format
- Status: TODO

## Priority 2: Security & Payment Protocol Improvements

### 2.1 Add Server-Side Input Validation
- File: server/server.cjs
- Add validation for all user inputs
- Status: TODO

### 2.2 Add Rate Limiting
- File: server/server.cjs
- Add rate limiting middleware
- Status: TODO

### 2.3 Add CSRF Protection
- File: server/server.cjs
- Add CSRF tokens
- Status: TODO

## Priority 3: Frontend Integration

### 3.1 Add Stripe.js to Frontend
- Add Stripe Publishable Key configuration
- Add proper Stripe Checkout flow
- Status: TODO

### 3.2 Add Login-Only UI Visibility
- File: src/components/TokenMarketplace.jsx
- File: src/components/TokenIssuance.jsx
- File: src/components/Dashboard.jsx
- Ensure auth-gated content is properly hidden
- Status: TODO

## Priority 4: Configuration

### 4.1 Create .env.example
- Document all required environment variables
- Status: TODO

### 4.2 Fix economyService Import Paths
- Files: economyService.js vs server/economyService.cjs
- Ensure correct imports
- Status: TODO

## Priority 5: XRP Integration

### 5.1 Add Platform Wallet Configuration
- File: server/config.cjs
- Add PLATFORM_WALLET_SEED configuration
- Status: TODO

### 5.2 Add Real Wallet Validation
- File: src/components/WalletModal.jsx
- Validate XRP address format (r...)<
- Status: TODO

## Implementation Order:
1. Fix TokenIssuance.jsx syntax
2. Fix PaymentModal.jsx endpoints
3. Add Stripe config to frontend
4. Fix WalletModal.jsx validation
5. Add server-side validation
6. Add login-only visibility
7. Create .env.example
8. Test full payment flow
