#!/bin/bash
# SVRN Publisher — Development Setup
# Gets a new developer from zero to running in one command.

set -e

echo "📚 SVRN Publisher Setup"
echo "========================"

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node 18+ from https://nodejs.org"
    exit 1
fi
echo "✅ Node $(node --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup database
echo ""
echo "🗄️  Setting up database..."
npx knex migrate:latest 2>/dev/null || echo "⚠️  Migrations skipped (knex not configured)"

# Check env
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  No .env file found. Creating from template..."
    cat > .env << 'EOF'
# SVRN Configuration
DATABASE_URL=sqlite:./dev.db
JWT_SECRET=change-this-in-production
SMTP_HOST=localhost
SMTP_PORT=587
EMAIL_FROM=noreply@svrn.network
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
EOF
    echo "✅ Created .env (update with your values)"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  npm run dev        Start the publisher"
echo "  npm test           Run tests"
echo "  docker-compose up  Start with Docker (production-like)"
