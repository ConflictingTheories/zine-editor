# Integration Plan - Void Press (Zine Publishing Platform)

## Current Status
✅ Frontend builds successfully (vite build)
✅ Backend server loads without errors  
✅ Docker builds for both frontend and backend work
✅ Core features exist: Auth, Zine CRUD, MCP, Economy, Sovereign Tokens, Crowdfunding

## TODO List

### Phase 1: Database Schema Fixes (Critical)
- [ ] 1.1 Add missing columns to zines table for crowdfunding and token gating
- [ ] 1.2 Ensure all migrations run correctly
- [ ] 1.3 Verify database schema integrity

### Phase 2: Sovereign Token Client Integration
- [ ] 2.1 Copy sovereign-token.js to src/lib/
- [ ] 2.2 Copy sovereign-gate.js to src/lib/
- [ ] 2.3 Copy self-coding-encryption.js to src/lib/
- [ ] 2.4 Integrate with SovereignTokenManager component
- [ ] 2.5 Add visual token rendering to frontend

### Phase 3: Producer Credits System
- [ ] 3.1 Add contribution tier tracking
- [ ] 3.2 Add producer credits UI component
- [ ] 3.3 Connect to crowdfunding endpoints

### Phase 4: Docker Configuration Fixes
- [ ] 4.1 Fix docker-compose.yml context paths
- [ ] 4.2 Ensure proper environment variable handling
- [ ] 4.3 Test full docker-compose build

### Phase 5: Final Verification
- [ ] 5.1 Verify npm run build succeeds
- [ ] 5.2 Verify node server loads without errors
- [ ] 5.3 Verify docker builds succeed

## Implementation Notes

### Database Migration Strategy
The zines table needs additional columns for:
- `funding_goal` - decimal for crowdfunding target
- `amount_raised` - decimal for current funding
- `funding_currency` - string (USD, etc)
- `funding_deadline` - timestamp
- `is_funded` - boolean
- `access_level` - string (public, private, token_gated)
- `monetization_type` - string (free, crowdfund, subscription, one_time)
- `premium_price` - decimal
- `requires_token` - boolean
- `gate_id` - string

### Sovereign Token Integration
The PoC files in `sovereign-token_TO_INTEGRATE/` need to be:
1. Copied to `src/lib/sovereign/` directory
2. Imported in components that need them
3. Connected to the API endpoints already in place

### Docker Issues
The docker-compose.yml references context "." but Dockerfile copies from ".." - needs fixing

