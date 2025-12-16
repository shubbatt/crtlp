#!/bin/bash

# Deployment Preparation Script
# Generates APP_KEY and tests database connection

echo "🚀 CtrlP POS Deployment Preparation"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "composer.json" ]; then
    echo "❌ Error: Run this script from the backend directory"
    exit 1
fi

# Generate APP_KEY
echo "📝 Generating APP_KEY..."
APP_KEY=$(php artisan key:generate --show)
echo "✅ APP_KEY generated!"
echo ""
echo "Your APP_KEY is:"
echo "$APP_KEY"
echo ""
echo "⚠️  IMPORTANT: Save this key securely!"
echo "   Add it to DigitalOcean App Platform as APP_KEY environment variable"
echo ""

# Check for .env file
if [ -f ".env" ]; then
    echo "📋 Current Database Configuration:"
    grep "^DB_" .env | head -5
    echo ""
fi

# Test database connection if possible
echo "🔍 Testing database connection..."
php artisan tinker --execute="try { \DB::connection()->getPdo(); echo '✅ Database connected successfully!'; } catch (\Exception \$e) { echo '❌ Database connection failed: ' . \$e->getMessage(); }"
echo ""

echo "===================================="
echo "✅ Preparation complete!"
echo ""
echo "Next steps:"
echo "1. Push code to GitHub"
echo "2. Create Supabase project and get connection details"
echo "3. Create DigitalOcean App and configure environment variables"
echo "4. Deploy!"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions."
