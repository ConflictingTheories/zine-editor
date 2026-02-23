# Integration Plan: Sovereign Tokens + Longform Publishing

## Overview
This plan outlines the integration of Sovereign Tokens (content ownership/authentication) and Longform Publishing (crowdfunding/monetization) into the main Void Press platform.

---

## Phase 1: Database Schema Extensions

### 1.1 Add Sovereign Token Tables
Create new migration: `server/migrations/20260224000000_add_sovereign_tokens.cjs`

```javascript
exports.up = function(knex) {
  return knex.schema
    // Token ownership records
    .createTable('sovereign_tokens', function(table) {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users');
      table.string('token_id').unique(); // unique identifier
      table.string('public_key_jwk').text(); // JSON string
      table.string('private_key_jwk').text(); // encrypted JSON string
      table.jsonb('claims'); // arbitrary claims
      table.string('token_data'); // exported token blob (base64)
      table.integer('is_active').defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // Content gates (protected content)
    .createTable('content_gates', function(table) {
      table.increments('id').primary();
      table.integer('zine_id').references('id').inTable('zines');
      table.string('gate_id').unique();
      table.string('gate_type').defaultTo('token'); // 'token', 'subscription', 'credit', 'free'
      table.text('envelope'); // encrypted content envelope
      table.integer('token_id').references('id').inTable('sovereign_tokens');
      table.integer('price_credits'); // price in credits if credit-gated
      table.integer('is_active').defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // Delegated tokens (shared access)
    .createTable('delegated_tokens', function(table) {
      table.increments('id').primary();
      table.integer('parent_token_id').references('id').inTable('sovereign_tokens');
      table.integer('delegate_user_id').references('id').inTable('users');
      table.string('delegation_purpose');
      table.timestamp('expires_at');
      table.string('token_data'); // delegated token blob
      table.integer('is_active').defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};
```

### 1.2 Enhance Zines Table for Longform
Create new migration: `server/migrations/20260224000001_enhance_zines_monetization.cjs`

```javascript
exports.up = function(knex) {
  return knex.schema.table('zines', function(table) {
    // Crowdfunding
    table.decimal('funding_goal', 14, 2);
    table.decimal('amount_raised', 14, 2).defaultTo(0);
    table.integer('funding_currency').defaultTo('USD'); // USD, XRP, CREDIT
    table.integer('is_funded').defaultTo(0);
    table.timestamp('funding_deadline');
    
    // Monetization type
    table.string('monetization_type').defaultTo('free'); // 'free', 'crowdfund', 'subscription', 'token', 'one_time'
    
    // Premium content
    table.integer('is_premium').defaultTo(0);
    table.decimal('premium_price', 10, 2);
    
    // Access level
    table.string('access_level').defaultTo('public'); // 'public', 'subscriber', 'token_holder', 'owner'
  }).then(function() {
    // Add contributions table if not exists
    return knex.schema.createTableIfNotExists('contributions', function(table) {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users');
      table.integer('zine_id').references('id').inTable('zines');
      table.decimal('amount', 14, 2);
      table.string('currency').defaultTo('USD');
      table.string('stripe_payment_intent').unique();
      table.string('credit_tier'); // 'associate_producer', 'executive_producer'
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  });
};
```

---

## Phase 2: Server-Side Integration

### 2.1 Create Sovereign Token Service
New file: `server/sovereignService.cjs`

- Token creation/generation
- Token verification
- Content sealing/opening
- Delegation management
- Integration with existing user system

### 2.2 Update Server Routes
Modify `server/server.cjs` to add:

```javascript
// Sovereign Token Routes
app.post('/api/sovereign/create-token', authenticateToken, async (req, res) => {
  // Create new sovereign token for user
});

app.get('/api/sovereign/tokens', authenticateToken, async (req, res) => {
  // List user's tokens
});

app.post('/api/sovereign/seal-content', authenticateToken, async (req, res) => {
  // Seal content with token gate
});

app.post('/api/sovereign/delegate', authenticateToken, async (req, res) => {
  // Create delegated token
});

app.post('/api/sovereign/verify', async (req, res) => {
  // Verify token without authentication
});

// Content Gate Routes
app.get('/api/gates/:gateId', async (req, res) => {
  // Get gate info (not content)
});

app.post('/api/gates/:gateId/unlock', authenticateToken, async (req, res) => {
  // Attempt to unlock gate with token
});
```

### 2.3 Update Economy Service
Modify `server/economyService.cjs`:

- Add crowdfunding fulfillment logic
- Add "free for all" trigger when funding goal met
- Integrate sovereign tokens with credit purchases

---

## Phase 3: Client-Side Integration

### 3.1 Add Sovereign Token Components
New files in `src/components/`:

1. **SovereignTokenManager.jsx** - Token creation/management UI
2. **ContentGate.jsx** - Gated content component using sovereign-gate web component
3. **TokenVerification.jsx** - Token verification modal
4. **DelegationManager.jsx** - Delegate token management

### 3.2 Update Existing Components

1. **FundingPanel.jsx** - Enhance with:
   - Crowdfunding progress display
   - "Free for all" indicator when funded
   - Producer credit display
   - Different monetization type support

2. **Editor.jsx** - Add:
   - Content gating options in publish modal
   - Token gate configuration
   - Monetization type selector

3. **Reader.jsx** - Add:
   - Token gate unlock UI
   - Delegated token input
   - Crowdfunding contribution prompt

4. **Dashboard.jsx** - Add:
   - Sovereign token management section
   - Revenue/earnings from crowdfunding

### 3.3 Add API Client Functions
Update `src/api/index.js`:

```javascript
// Sovereign Token API
export async function createSovereignToken(identity, claims) { }
export async function getUserTokens() { }
export async function sealContent(zineId, gateType, options) { }
export async function delegateToken(tokenId, purpose, ttl) { }
export async function unlockGate(gateId, tokenData) { }

// Crowdfunding API
export async function contributeToZine(zineId, amount, currency) { }
export async function getZineFundingStatus(zineId) { }
```

---

## Phase 4: Frontend Library Integration

### 4.1 Copy and Integrate PoC Libraries

1. Copy from `sovereign-token_TO_INTEGRATE/`:
   - `sovereign-token.js` → `src/lib/sovereign-token.js`
   - `sovereign-gate.js` → `src/lib/sovereign-gate.js`
   - `self-coding-encryption.js` → `src/lib/self-coding-encryption.js`

2. Update imports to work with ES modules

### 4.2 Create Unified Token Service
New file: `src/lib/tokenService.js`

```javascript
import { SovereignToken } from './sovereign-token.js';
import { SovereignGate } from './sovereign-gate.js';
import { SCEE } from './self-coding-encryption.js';

// Unified API for all token operations
export const TokenService = {
  // Identity
  async createIdentity(claims) { },
  async verifyIdentity(tokenBlob) { },
  
  // Content Protection
  async sealZine(zineData, identity) { },
  async unlockZine(gateId, tokenData) { },
  
  // Delegation
  async createDelegation(tokenId, purpose, ttl) { },
  
  // Encryption
  async encryptContent(content, passphrase) { },
  async decryptContent(envelope, key, passphrase) { },
};
```

---

## Phase 5: Testing & Verification

### 5.1 Test Scenarios

1. **Sovereign Tokens**:
   - Create token with claims
   - Verify token authenticity
   - Seal content with token gate
   - Unlock content with valid token
   - Create and use delegated tokens

2. **Crowdfunding**:
   - Create zine with funding goal
   - Make contribution
   - Verify amount_raised updates
   - Test "free for all" when goal met
   - Verify producer credits

3. **Integration**:
   - Token-gated zine with crowdfunding
   - Premium content with token unlock
   - Subscription + token hybrid access

---

## Implementation Order

1. **Database Migrations** - Foundation
2. **Server Services** - sovereignService.cjs
3. **Server Routes** - API endpoints
4. **Client API** - API functions
5. **Token Libraries** - Copy and adapt PoC code
6. **Token Service** - Unified client service
7. **UI Components** - Token manager, gates
8. **Funding Updates** - Enhanced FundingPanel
9. **Editor Updates** - Gating options
10. **Reader Updates** - Unlock UI
11. **Testing** - Integration tests

---

## Dependencies

- Stripe (already integrated)
- XRPL/xrpService (already integrated)
- Web Crypto API (browser native)
- Existing auth system (JWT)

---

## Backward Compatibility

- Existing zines remain unchanged
- New optional fields have defaults
- Token gating is opt-in
- Crowdfunding is opt-in

