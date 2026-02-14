# TODO: Fix XRP Economy System

## Task Overview
Fix the conceptual mismatch between the code and the intended vision:
- Users buy credits via Stripe → Credits issued as XRP
- Credits serve as currency between creators
- Creators can issue their own XRP tokens via trust lines
- Users can accept other creators' tokens

## Issues Identified

### 1. economyService.js
- [ ] Not integrated with server (functions not called)
- [ ] Uses mock XRP addresses
- [ ] No webhook endpoint

### 2. xrpService.js
- [ ] Missing trust line checking function
- [ ] Missing account info retrieval
- [ ] No creator token issuance integration

### 3. server.cjs  
- [ ] Missing `/api/stripe/checkout-session` endpoint
- [ ] Credit purchases are simulated, not real Stripe
- [ ] Token creation doesn't issue real XRP tokens
- [ ] Trust lines aren't established on XRPL

### 4. Frontend
- [ ] CreditPurchase.jsx calls non-existent endpoint

## Implementation Plan

### Step 1: Update xrpService.js
- Add `checkTrustLine()` function
- Add `getAccountInfo()` function  
- Add `issueCreatorToken()` function that creates real XRP tokens

### Step 2: Update economyService.js
- Fix to use real database
- Add proper Stripe webhook handling
- Connect to xrpService for real XRP issuance

### Step 3: Update server.cjs
- Add `/api/stripe/checkout-session` endpoint
- Add `/api/stripe/webhook` endpoint
- Integrate xrpService for real operations
- Fix credit purchase to actually work

### Step 4: Update CreditPurchase.jsx
- Fix to use correct API endpoints
- Add proper error handling

## Status: In Progress
