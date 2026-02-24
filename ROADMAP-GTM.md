# ROADMAP-GTM.md - Void Press Complete Cleanup & Overhaul

> **Project:** Void Press - Zine Publishing Platform  
> **Status:** Incomplete - Multiple bugs and half-finished features  
> **Generated:** 2025

---

## Executive Summary

This document outlines a comprehensive cleanup and overhaul plan for the Void Press zine publishing platform. The project has significant potential but suffers from incomplete integrations, bugs, and missing core features. This roadmap addresses all issues systematically.

---

## Part 1: Current State Analysis

### 1.1 Project Overview

Void Press is a full-stack zine publishing platform featuring:
- **Frontend:** React 18 + Vite + Konva (canvas rendering)
- **Backend:** Express.js + SQLite + Knex migrations
- **Features:** Rich editor, themes, shaders, monetization, sovereign tokens, crowdfunding

### 1.2 Identified Issues

#### Critical Bugs 🔴

| Issue | Location | Impact |
|-------|----------|--------|
| React imports in server.cjs | `server/server.cjs` (lines ~1100+) | Server crash on startup |
| Duplicate/missing migrations | `server/migrations/` | Database schema inconsistencies |
| Incomplete sovereign integration | `sovereign-token_TO_INTEGRATE/` | Core feature non-functional |
| Duplicate longform files | `longform-updates_TO_INTEGRATE/` | Code confusion, maintenance burden |

#### Incomplete Features 🟡

| Feature | Status | Notes |
|---------|--------|-------|
| Sovereign Token Client Integration | 60% | Files copied but not wired to components |
| Producer Credits System | 0% | Not implemented |
| Token Marketplace UI | Incomplete | Component exists but may not work |
| Token Issuance UI | Incomplete | Component exists but may not work |
| Subscription Manager | Incomplete | Component exists but may not work |
| Creator Monetization | Incomplete | Component exists but may not work |
| XRPayIDContext | Incomplete | Context may be missing implementation |

#### Code Quality Issues 🟠

| Issue | Location | Description |
|-------|----------|-------------|
| Server file contains React code | `server/server.cjs` | Imports at bottom break server |
| Duplicate files in TO_INTEGRATE | Root directory | ~30+ duplicate files |
| Unused dependencies | `package.json` | Some packages may be unnecessary |
| Inconsistent error handling | Multiple files | Many endpoints lack proper error handling |
| Hardcoded values | Multiple files | Configuration should be externalized |

---

## Part 2: Cleanup Tasks

### 2.1 Remove Server Contamination

**Issue:** `server/server.cjs` contains React component imports at the end of the file (lines ~1100+), which causes the Express server to crash on startup.

**Current (BUGGY):**
```javascript
// server/server.cjs ends with:
import React from 'react'
import TopNav from './components/TopNav.jsx'
// ... more React imports (SHOULD NOT BE HERE)
```

**Fix:**
1. Remove all React/component imports from server.cjs
2. Move any shared utilities to separate files

### 2.2 Clean Up TO_INTEGRATE Directories

The following directories contain duplicate/legacy code that should be handled:

| Directory | Contents | Action |
|-----------|----------|--------|
| `longform-updates_TO_INTEGRATE/` | 30+ duplicate files | Review, integrate needed code, delete |
| `sovereign-token_TO_INTEGRATE/` | PoC implementations | Integrate into src/lib/, delete |
| `plans/` | Planning documents | Archive or delete |

**Action Items:**
1. Review each file in `longform-updates_TO_INTEGRATE/`
2. Identify unique functionality not in main codebase
3. Merge any valuable changes
4. Delete entire directory when complete

### 2.3 Fix Migration Issues

**Issues:**
1. Missing index on frequently queried columns
2. Some columns may not exist (check schema)
3. No rollback strategy for failed migrations

**Fix:**
```javascript
// Create a new migration for fixes: server/migrations/20260225000000_fix_schema.cjs
exports.up = function(knex) {
    return knex.schema
        .table('zines', table => {
            // Ensure columns exist with correct types
            table.string('token_price').alter();
            table.integer('is_token_gated').defaultTo(0).alter();
        })
        .then(() => {
            // Add missing indexes
            return knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_zines_user ON zines(user_id)');
        });
};
```

### 2.4 Clean package.json

Review and potentially remove unused dependencies:
- Check actual usage of all packages
- Remove `pg` if only using SQLite
- Verify all scripts work correctly

---

## Part 3: Core Feature Implementation

### 3.1 Sovereign Token Integration (Complete)

**Current Status:** Files copied to `src/lib/sovereign/` but not wired up

**Required Actions:**

1. **Verify library files exist:**
   - `src/lib/sovereign/sovereign-token.js` ✓/✗
   - `src/lib/sovereign/sovereign-gate.js` ✓/✗
   - `src/lib/sovereign/self-coding-encryption.js` ✓/✗

2. **Wire up SovereignTokenManager component:**
   - File: `src/components/SovereignTokenManager.jsx`
   - Needs: Token creation UI, identity management, export/import

3. **Connect to API endpoints:**
   ```javascript
   // Add to src/api/index.js
   export async function createSovereignToken(identity, claims) {
       return api('/sovereign/create-token', 'POST', { identity, claims });
   }
   
   export async function getUserTokens() {
       return api('/sovereign/tokens', 'GET');
   }
   
   export async function sealContent(zineId, tokenId, content) {
       return api('/sovereign/seal', 'POST', { zineId, tokenId, content });
   }
   
   export async function unlockContent(gateId, tokenData) {
       return api('/sovereign/unlock', 'POST', { gateId, tokenData });
   }
   ```

4. **Update MonetizationDashboard:**
   - Ensure sovereign tab calls API correctly
   - Handle loading/error states

### 3.2 Producer Credits System

**Current Status:** Not implemented

**Required Implementation:**

1. **Database:**
   - Track contribution tiers per user per zine
   - Store credit tier (associate_producer, executive_producer)

2. **Backend API:**
   ```javascript
   // Add to server.cjs
   app.get('/api/zines/:id/producers', async (req, res) => {
       // Return list of producers with their tiers
   });
   ```

3. **Frontend:**
   - Display producer credits in FundingPanel
   - Show tier badges (Associate Producer, Executive Producer)

### 3.3 Token Marketplace

**Current Status:** Component exists but likely incomplete

**Required Actions:**

1. **Fix TokenMarketplace component:**
   - Wire up to `/api/tokens` endpoint
   - Add buy functionality
   - Implement search/filter

2. **Fix TokenIssuance component:**
   - Wire up to `/api/tokens/create` endpoint
   - Add form validation
   - Connect to wallet

### 3.4 Subscription Manager

**Current Status:** Component exists but likely incomplete

**Required Actions:**

1. **Wire up to API:**
   ```javascript
   // Add to src/api/index.js
   export async function subscribeToCreator(creatorId, tokenId, amount) {
       return api('/subscriptions/subscribe', 'POST', { creatorId, tokenId, amountPerPeriod: amount });
   }
   
   export async function cancelSubscription(subscriptionId) {
       return api('/subscriptions/cancel', 'POST', { subscriptionId });
   }
   
   export async function getSubscriptions(type = 'subscribing') {
       return api(`/subscriptions?type=${type}`, 'GET');
   }
   ```

2. **Update SubscriptionManager.jsx:**
   - List active subscriptions
   - Show subscriber count (for creators)
   - Handle renewal reminders

### 3.5 Creator Monetization Tools

**Current Status:** Component exists but likely incomplete

**Required Actions:**

1. **Wire up creator endpoints:**
   - `/api/zines/:id/funding` (set funding goal)
   - `/api/zines/:id/token-gate` (token gating)
   - Revenue/earnings dashboard

2. **Implement in CreatorMonetization.jsx:**
   - Funding goal form
   - Token price configuration
   - Earnings display

---

## Part 4: Infrastructure & Testing

### 4.1 Error Handling Improvements

Add consistent error handling across all API endpoints:

```javascript
// Create middleware: server/middleware/errorHandler.cjs
const errorHandler = (err, req, res, next) => {
    console.error('API Error:', err);
    
    if (err.type === 'validation') {
        return res.status(400).json({ error: err.message });
    }
    if (err.type === 'auth') {
        return res.status(401).json({ error: err.message });
    }
    if (err.type === 'forbidden') {
        return res.status(403).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
};
```

### 4.2 Add Input Validation

Use a validation library (e.g., `express-validator`) for all user inputs:

```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/zines', [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('data').isObject()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // proceed with handler
});
```

### 4.3 Add Tests

**Priority Tests:**
1. Authentication (register, login, token refresh)
2. Zine CRUD operations
3. Payment flow (even mocked)
4. Sovereign token creation/verification

**Test Framework:** Jest or Mocha

```javascript
// Example test: server/test/test_economy.js
describe('Economy Service', () => {
    it('should create checkout session', async () => {
        const session = await economyService.createCheckoutSession(1, 10.00, 'test@example.com');
        expect(session).toHaveProperty('sessionId');
    });
    
    it('should fulfill credit purchase', async () => {
        // Test credit issuance
    });
});
```

---

## Part 5: Implementation Phases

### Phase 1: Critical Fixes (Week 1)

| Task | Priority | Estimated Effort |
|------|----------|------------------|
| Remove React imports from server.cjs | 🔴 Critical | 1 hour |
| Fix database migrations | 🔴 Critical | 2 hours |
| Delete TO_INTEGRATE directories | 🟠 High | 4 hours |
| Verify server starts correctly | 🔴 Critical | 1 hour |

### Phase 2: Core Features (Weeks 2-3)

| Task | Priority | Estimated Effort |
|------|----------|------------------|
| Complete sovereign token integration | 🟡 Medium | 8 hours |
| Implement producer credits system | 🟡 Medium | 6 hours |
| Fix token marketplace | 🟡 Medium | 4 hours |
| Fix subscription manager | 🟡 Medium | 4 hours |
| Fix creator monetization tools | 🟡 Medium | 4 hours |

### Phase 3: Quality & Testing (Week 4)

| Task | Priority | Estimated Effort |
|------|----------|------------------|
| Add error handling middleware | 🟠 High | 4 hours |
| Add input validation | 🟠 High | 6 hours |
| Write unit tests | 🟠 High | 8 hours |
| Integration testing | 🟠 High | 8 hours |

### Phase 4: Polish (Week 5+)

| Task | Priority | Estimated Effort |
|------|----------|------------------|
| UI/UX improvements | 🟢 Normal | Ongoing |
| Performance optimization | 🟢 Normal | 4 hours |
| Documentation | 🟢 Normal | 4 hours |
| Security audit | 🟠 High | 8 hours |

---

## Part 6: Success Criteria

### Before Cleanup
- [ ] Server crashes on startup
- [ ] Multiple duplicate files causing confusion
- [ ] Sovereign tokens not functional
- [ ] Producer credits not implemented
- [ ] Several UI components broken

### After Overhaul
- [ ] Server starts without errors
- [ ] Clean project structure
- [ ] Sovereign tokens fully operational
- [ ] Producer credits implemented
- [ ] All UI components functional
- [ ] Error handling consistent
- [ ] Basic test coverage
- [ ] Input validation in place

---

## Appendix: File Reference

### Critical Files to Fix

| File | Issue | Fix Action |
|------|-------|------------|
| `server/server.cjs` | React imports at bottom | Remove React imports (lines ~1100+) |
| `server/migrations/*.cjs` | Potential schema issues | Review and fix |
| `src/lib/sovereign/` | Incomplete integration | Wire up to components |

### Components Needing Work

| Component | Current State | Required Work |
|-----------|--------------|---------------|
| `SovereignTokenManager.jsx` | May exist | Complete implementation |
| `TokenMarketplace.jsx` | Incomplete | Fix API wiring |
| `TokenIssuance.jsx` | Incomplete | Fix API wiring |
| `SubscriptionManager.jsx` | Incomplete | Fix API wiring |
| `CreatorMonetization.jsx` | Incomplete | Fix API wiring |
| `FundingPanel.jsx` | Needs work | Add producer credits |

### API Endpoints to Verify

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/sovereign/create-token` | POST | Needs testing |
| `/api/sovereign/tokens` | GET | Needs testing |
| `/api/sovereign/seal` | POST | Needs testing |
| `/api/sovereign/unlock` | POST | Needs testing |
| `/api/zines/:id/funding` | GET/POST | Needs testing |
| `/api/zines/:id/producers` | GET | Needs implementation |
| `/api/tokens/create` | POST | Needs testing |
| `/api/subscriptions/*` | GET/POST | Needs testing |

---

*Document Version: 1.0*  
*Last Updated: 2025*

