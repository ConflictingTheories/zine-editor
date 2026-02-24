# Void Press - TODO

## Current Status: CRITICAL FIXES IN PROGRESS

### 🚨 CRITICAL: Auth & API Routing Issues (IN PROGRESS)

**Problem**: Login/Register completely broken, premium modal pushed into corner

**Root Causes Identified**:
1. ✅ API_BASE_URL in constants.js defaults to '/api' (correct for dev with proxy)
2. ✅ VPContext.jsx api() function uses hardcoded '/api' - needs consistency
3. ✅ Error handling added to login/register functions
4. ❌ Need to verify CORS configuration on backend
5. ❌ Need to check modal CSS/styling issues

**Files Modified**:
- `src/constants.js` - API_BASE_URL set to '/api' for dev proxy
- `src/context/VPContext.jsx` - Added error handling, logging, and improved error messages

**Next Steps**:
1. Test login/register with browser
2. Fix modal CSS if still broken
3. Verify backend CORS allows frontend origin

---

## Routing Architecture (COMPLETED)

### Development Mode (yarn dev + yarn server)
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:3000 (Express server)
- API calls: `/api/*` → Vite proxy → localhost:3000
- Vite config handles proxy automatically

### Docker Mode
- Nginx: http://localhost:5173 (port mapped to 80)
- Frontend: Served as static files by Nginx
- Backend: http://backend:3000 (internal Docker network)
- API calls: `/api/*` → Nginx reverse proxy → backend:3000

**Files**:
- `vite.config.js` - Dev proxy configuration
- `loadbalancer/nginx.conf` - Docker reverse proxy
- `docker/docker-compose.yml` - Service orchestration
- `docker/Dockerfile.frontend` - Frontend build + nginx

---

## Completed Tasks

### ✅ Routing Fix (COMPLETED)
- Fixed vite.config.js proxy to point to localhost:3000
- Updated nginx.conf for Docker deployment
- Set API_BASE_URL to '/api' for relative path routing
- Docker compose configures frontend with VITE_API_BASE_URL=/api

### ✅ Auth Error Handling (COMPLETED)
- Added try-catch to login() function
- Added try-catch to register() function
- Added toast notifications for errors
- Added console logging for debugging

---

## Remaining Issues

### 🔴 HIGH PRIORITY
1. **Modal Display** - Premium modal pushed into corner
   - Check CSS for modal positioning
   - Verify z-index and transform properties
   
2. **CORS Verification** - Ensure backend accepts requests
   - Test with browser dev tools
   - Check preflight OPTIONS requests

### 🟡 MEDIUM PRIORITY
3. **API Consistency** - Ensure all API calls use proper base URL
   - Check src/api/index.js
   - Verify no hardcoded URLs remain

4. **Testing** - Full auth flow test
   - Register new user
   - Login existing user
   - Verify token persistence

---

## Testing Checklist

- [ ] Start backend: `cd server && node server.cjs`
- [ ] Start frontend: `yarn dev`
- [ ] Open browser to http://localhost:5173
- [ ] Try to register new account
- [ ] Check browser console for errors
- [ ] Check network tab for API requests
- [ ] Verify modal displays correctly
- [ ] Test login with existing account

---

## Notes

**Last Updated**: 2024 (Current Session)

**Current Branch**: main

**Next Action**: Test in browser and fix any remaining issues
