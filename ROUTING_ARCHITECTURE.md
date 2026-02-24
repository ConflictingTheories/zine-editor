# Void Press - Routing Architecture

This document explains how the frontend routing works in both development and Docker environments.

## Overview

The application supports two deployment modes:
1. **Development Mode**: Using `yarn dev` (Vite dev server) + `yarn server` (backend)
2. **Docker Mode**: Using `docker-compose up` with nginx as reverse proxy

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPMENT MODE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │   Browser    │────────▶│  Vite (5173) │────────▶│ Backend(3000)│    │
│  │              │         │              │         │              │    │
│  │  /api/auth   │         │  /api ──────▶│         │  /api/auth   │    │
│  │  (relative)  │         │  (proxy)     │         │  (actual)    │    │
│  └──────────────┘         └──────────────┘         └──────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            DOCKER MODE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │   Browser    │────────▶│  Nginx (80)  │────────▶│ Backend(3000)│    │
│  │              │         │              │         │              │    │
│  │  /api/auth   │         │  /api ──────▶│         │  /api/auth   │    │
│  │  (relative)  │         │  (proxy)     │         │  (actual)    │    │
│  └──────────────┘         └──────────────┘         └──────────────┘    │
│                           │                                             │
│                           │  / (static)                                 │
│                           ▼                                             │
│                    ┌──────────────┐                                     │
│                    │  Static Files│                                     │
│                    │  (dist/)     │                                     │
│                    └──────────────┘                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### 1. vite.config.js (Development)
```javascript
server: {
    port: 5173,
    proxy: {
        '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            secure: false,
        },
        '/mcp': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            secure: false,
        }
    }
}
```
- Vite dev server runs on port 5173
- Proxies `/api` and `/mcp` requests to backend at localhost:3000
- This allows the frontend to use relative paths like `/api/auth/login`

### 2. src/constants.js (Frontend API Configuration)
```javascript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
```
- **Key Change**: Default changed from `'http://localhost:3000'` to `'/api'`
- This ensures the frontend always uses relative paths
- Works in both development and Docker modes

### 3. src/api/index.js (API Client)
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```
- Uses the same pattern as constants.js
- Makes requests to `${API_BASE_URL}${endpoint}`

### 4. loadbalancer/nginx.conf (Docker Reverse Proxy)
```nginx
server {
    listen 80;
    
    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy MCP requests to backend
    location /mcp/ {
        proxy_pass http://backend:3000/mcp/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
- Nginx listens on port 80
- Proxies `/api/` and `/mcp/` to backend container
- Serves static frontend files from `/usr/share/nginx/html`
- Handles SPA routing with `try_files`

### 5. docker-compose.yml
```yaml
frontend:
  build:
    args:
      - VITE_API_BASE_URL=${VITE_API_BASE_URL:-/api}
  ports:
    - "5173:80"  # Host 5173 → Container 80
  environment:
    - VITE_API_BASE_URL=/api
```
- Frontend container exposes port 80 (nginx)
- Mapped to host port 5173 for consistency with dev mode
- Sets `VITE_API_BASE_URL=/api` at build time

## How It Works

### Development Mode (yarn dev + yarn server)

1. **Frontend**: Runs on `http://localhost:5173`
2. **Backend**: Runs on `http://localhost:3000`
3. **API Calls**: Frontend calls `/api/auth/login`
4. **Vite Proxy**: Intercepts `/api` requests and forwards to `localhost:3000`
5. **Result**: Request becomes `http://localhost:3000/api/auth/login`

### Docker Mode (docker-compose up)

1. **Frontend**: Served by nginx on `http://localhost:5173` (host port)
2. **Backend**: Runs in container on port 3000
3. **API Calls**: Frontend calls `/api/auth/login`
4. **Nginx Proxy**: Intercepts `/api/` requests and forwards to backend container
5. **Result**: Request becomes `http://backend:3000/api/auth/login`

## Key Benefits

1. **Consistent API Paths**: Frontend always uses `/api/...` regardless of environment
2. **No Hardcoded URLs**: No need to change code between dev and production
3. **CORS-Free**: Both modes use same-origin requests (proxied)
4. **Environment Agnostic**: Works with SQLite (dev) or PostgreSQL (Docker)

## Environment Variables

| Variable | Development | Docker | Description |
|----------|-------------|--------|-------------|
| `VITE_API_BASE_URL` | Not set (uses `/api` default) | `/api` | Frontend API base path |
| `PORT` | 3000 | 3000 | Backend port |
| `NODE_ENV` | development | production | Environment mode |
| `DB_PATH` | `./server/data/database.sqlite` | `/app/server/data/database.sqlite` | SQLite path |

## Testing

### Development Mode
```bash
# Terminal 1
yarn server
# Backend running on http://localhost:3000

# Terminal 2
yarn dev
# Frontend running on http://localhost:5173
# API calls proxied to backend
```

### Docker Mode
```bash
cd docker
docker-compose up --build
# Frontend: http://localhost:5173
# Backend: http://localhost:3000 (exposed for debugging)
# Both proxied through nginx
```

## Troubleshooting

### Issue: API calls fail in Docker
**Check**: Ensure `VITE_API_BASE_URL=/api` is set in docker-compose.yml

### Issue: API calls fail in development
**Check**: Ensure backend is running on port 3000 and Vite proxy is configured

### Issue: Double `/api` in paths
**Check**: Ensure API endpoints in `src/constants.js` don't include extra `/api` prefix since `API_BASE_URL` already includes it

## Summary

The routing architecture ensures:
- ✅ Development works with `yarn dev` + `yarn server`
- ✅ Docker works with `docker-compose up`
- ✅ No code changes needed between environments
- ✅ Consistent API paths using relative URLs
- ✅ Proper reverse proxy configuration in both modes
