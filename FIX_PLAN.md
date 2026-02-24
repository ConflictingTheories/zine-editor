# Fix Plan: Docker + Frontend-Backend Communication

## Issues Identified

### Issue 1: Local Development - Frontend Not Calling Backend
- **Root Cause**: No `.env` file with `VITE_API_BASE_URL` set
- **Fix**: Create `.env` file with proper API URL

### Issue 2: Database Initialization in Docker
- **Root Cause**: 
  - Relative DB_PATH in docker-compose.yml
  - Migrations may not run properly on container start
- **Fix**: 
  - Use absolute path for DB in Docker
  - Ensure migrations run on startup

### Issue 3: Docker Setup Not Working
- **Root Causes**:
  1. `Dockerfile.backend` has wrong CMD path
  2. `docker-compose.yml` has wrong DB_PATH (relative vs absolute)
  3. Health check path incorrect
  4. No nginx config being used in frontend container
  5. No `.env` file for Docker

## Fixes to Apply

### Fix 1: Create `.env` file for local development
- File: `.env`
- Set `VITE_API_BASE_URL=/api` for dev server proxy

### Fix 2: Fix `docker-compose.yml`
- Change DB_PATH to absolute path: `/app/server/data/database.sqlite`
- Fix health check path

### Fix 3: Fix `Dockerfile.backend`
- Change CMD from `node server/server.cjs` to `node server.cjs`

### Fix 4: Fix `Dockerfile.frontend`
- Ensure nginx config is properly copied

### Fix 5: Create Docker `.env` file
- File: `docker/.env`
- Set all required environment variables for Docker

### Fix 6: Fix `nginx.conf` 
- Ensure API proxy is correctly configured

