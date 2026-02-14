# Void Press - Focused Fix Roadmap

## The Real Problem
The system isn't "shoddy" in concept—it's **incomplete wiring**. The backend API exists with 90% of what's needed. The React app has most components but they're not connected.

### Quick Wins (Get Working Core)

**Tier 1: Backend-Frontend Connection** (1-2 days)
- [ ] Fix API endpoint mismatches
- [ ] Verify auth flow end-to-end (login works?)
- [ ] Test project sync (can you save and reopen?)
- [ ] Test publishing (create, publish, verify in DB)

**Tier 2: Discovery & Reader** (1-2 days)
- [ ] Implement `Discover.jsx` - fetch from `/api/published`
- [ ] Implement `Reader.jsx` - display published zines with interactivity
- [ ] Add back-button and navigation flow
- [ ] Test: Can you find and read published zines?

**Tier 3: Publishing Workflow** (1 day)
- [ ] Draft → Preview → Publish pipeline
- [ ] Show publish status in dashboard
- [ ] Remove "syncing" confusion - make it clear what's local vs published
- [ ] Test: Create zine → Edit → Preview → Publish → Find on discover

**Tier 4: UI Polish** (1-2 days)
- [ ] Fix component spacing/layout
- [ ] Improve visual hierarchy  
- [ ] Add proper error handling & loading states
- [ ] Professional typography and spacing

**Tier 5: XRP/Monetization** (2-3 days)
- [ ] Wallet integration (connect to real XRP)
- [ ] Credits system (buy credits UI)
- [ ] Token creation (creators issue tokens)
- [ ] Clean abstraction layer for payments

---

## What to Fix Right Now (CRITICAL)

### Bug 1: API Endpoint Mismatch
In `VPContext.jsx` line 261, `saveLocal()` should also sync:
```jsx
const saveLocal = () => {
    // Currently just saves to localStorage and marks dirty
    // But sync() isn't being called automatically
}
```
**Fix:** Call `sync()` after a delay to push changes to backend.

### Bug 2: publishZine References Wrong Data
Line 450: `open Project` tries to access `res.data` but backend returns `res.data` structure directly
**Fix:** Verify backend returns structure matches what code expects

### Bug 3: Discover Component Not Implemented
`Discover.jsx` exists but is probably empty or stubbed
**Fix:** Connect to `/api/published` and render grid

### Bug 4: Reader Component Not Implemented  
`Reader.jsx` exists but probably doesn't actually read published zines
**Fix:** Connect to `/api/zines/:id` and render interactive reader

### Bug 5: No Real "Publishing" UX
Publishing works as API call but user doesn't feel like they're publishing
**Fix:** 
- Add draft status indicator
- Show "Publish Now" button prominently
- Create preview modal before publishing
- Show "Published" badge after

---

## Testing Checklist

After each tier, verify:

- [ ] **Tier 1**: Can you create account → Login → Stay logged in
- [ ] **Tier 1**: Create zine → Refresh browser → Zine still there (saved to backend)
- [ ] **Tier 2**: Create zine → Publish it → See it on Discover page
- [ ] **Tier 2**: Click published zine → Read it → Return to discover
- [ ] **Tier 3**: Create zine → Edit pages → Preview changes → Publish → Update published version
- [ ] **Tier 4**: All components look professional and not cramped
- [ ] **Tier 5**: Browse wallet → Buy credits → Use credits (stub for now)

---

## Priority Fixes (Do These First)

1. **Fix Discover component** (fetch & display published zines)
2. **Fix Reader component** (display & interact with published zines)  
3. **Fix publish status UI** (show draft/published badges)
4. **Fix sync timing** (auto-save to backend after edits)
5. **Polish modals** (proper spacing, visual hierarchy)

This gets you to a **usable publishing platform** in ~3-4 days instead of a complete rewrite.

