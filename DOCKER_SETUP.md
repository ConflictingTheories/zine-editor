# Docker Setup Guide

## Quick Start with Docker Compose

### Prerequisites
- Docker installed and running
- Docker Compose v2.0+

### 1. Environment Setup

```bash
# Copy .env.example to .env and configure
cp .env.example .env
```

Edit `.env` with your actual values:
```env
NODE_ENV=production
PORT=3000

# Security - use strong random string
JWT_SECRET=your_super_secret_jwt_key_change_this_use_strong_random_string

# Stripe (if using payment features)
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here

# Frontend
VITE_API_BASE_URL=http://localhost:3000
```

### 2. Build and Run

```bash
# Build all images
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### 3. Access the Application

- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3000
- **Database Admin**: http://localhost:8080 (Adminer)

## Individual Docker Images

### Backend Only

```bash
# Build
docker build -f Dockerfile.backend -t void-press-backend .

# Run
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_secret_key \
  -e STRIPE_SECRET_KEY=sk_test_xxx \
  -v $(pwd)/data:/app/data \
  void-press-backend
```

### Frontend Only

```bash
# Build
docker build -f Dockerfile.frontend -t void-press-frontend .

# Run
docker run -p 5174:5174 \
  -e VITE_API_BASE_URL=http://localhost:3000 \
  void-press-frontend
```

## Production Deployment

### Environment Security
- **Never commit .env to git** - it's in .gitignore
- Use `.env.example` as template for others
- Store real secrets in Docker Secrets or environment management service
- For sensitive environments, use:
  - AWS Secrets Manager
  - HashiCorp Vault
  - Docker Swarm Secrets
  - Kubernetes Secrets

### Database Persistence
- Backend data is stored in `backend_data` volume
- Survives container restarts
- Use `docker volume inspect backend_data` to check location

### Scaling
```bash
# Scale backend (note: with SQLite, only 1 instance recommended)
docker-compose up -d --scale backend=1

# For production with multiple backends, migrate to PostgreSQL
```

## Health Checks

Both services include health checks:
- Backend: `GET /api/health`
- Frontend: HTTP 200 status

View health:
```bash
docker-compose ps
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Port already in use
```bash
# Find process using port
lsof -i :3000   # Backend
lsof -i :5174   # Frontend

# Kill process
kill -9 <PID>

# Or change ports in docker-compose.yml
```

### Database issues
```bash
# Access database via Adminer
# Login to http://localhost:8080
# System: SQLite
# Database file: /app/data/database.sqlite

# Or via container shell
docker exec -it void-press-backend sqlite3 /app/data/database.sqlite
```

### Build fails
```bash
# Check Node version
docker --version
node --version

# Ensure clean build
rm -rf node_modules dist
docker-compose build --no-cache
```

## Environment Variables Reference

### Backend (.env)
| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | Yes | Backend port (default: 3000) |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `JWT_EXPIRY` | No | Token expiry time (default: 7d) |
| `STRIPE_SECRET_KEY` | No | Stripe API secret key |
| `DB_PATH` | No | Database file path (default: ./database.sqlite) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins |

### Frontend (.env)
All frontend variables **must** start with `VITE_` to be exposed:
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Backend API endpoint |
| `VITE_APP_NAME` | No | App display name |
| `VITE_APP_VERSION` | No | Version string |

## Next Steps

1. **Development**: Use `yarn dev` locally (faster iteration)
2. **Testing**: Use Docker Compose for integration testing
3. **Production**: Deploy with proper secret management
4. **Database**: Migrate to PostgreSQL for clustered deployments

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify `.env` configuration
3. Ensure ports are available
4. Check Docker daemon is running
