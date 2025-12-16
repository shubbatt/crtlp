# Deployment Guide: DigitalOcean + Supabase

This guide will help you deploy the Print Shop POS System to DigitalOcean App Platform with Supabase PostgreSQL database.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean App Platform                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │  Static Site    │      │     App (Laravel API)       │  │
│  │  (React Build)  │─────▶│     PHP 8.2 + Nginx         │  │
│  │  Port: 80       │      │     Port: 8080              │  │
│  └─────────────────┘      └──────────────┬──────────────┘  │
└──────────────────────────────────────────┼──────────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │   Supabase (PostgreSQL)  │
                              │   External Database      │
                              └─────────────────────────┘
```

---

## Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Organization**: Select or create one
   - **Project name**: `ctrlp-pos` (or your preferred name)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**

### 1.2 Get Database Connection Details

Once created, go to **Project Settings → Database**:

You'll need these values:
```
Host:     db.<project-ref>.supabase.co
Port:     5432
Database: postgres
User:     postgres
Password: [Your saved password]
```

For connection pooling (recommended for production), use:
```
Host:     db.<project-ref>.supabase.co
Port:     6543  (Transaction pooler port)
```

### 1.3 Configure Database Connection

The connection string format for Laravel:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Or individual parameters:
```
DB_CONNECTION=pgsql
DB_HOST=db.[PROJECT-REF].supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=[YOUR-PASSWORD]
```

---

## Step 2: Prepare Your Repository

### 2.1 Create GitHub Repository

1. Create a new GitHub repository
2. Push your code:

```bash
cd /Volumes/Backup/Development/CtrlP

# Initialize git if not already done
git init

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/ctrlp-pos.git

# Add all files
git add .
git commit -m "Initial deployment setup"
git push -u origin main
```

### 2.2 Project Structure for Deployment

Your repository should look like:
```
CtrlP/
├── backend/                 # Laravel API
│   ├── .do/
│   │   └── app.yaml        # DO App Spec (included)
│   ├── Procfile            # (included)
│   ├── nginx.conf          # (included)
│   └── ...
├── frontend/               # React SPA
│   └── ...
└── .do/
    └── app.yaml           # Main App Spec (included)
```

---

## Step 3: Deploy to DigitalOcean

### 3.1 Create DigitalOcean App

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Connect your GitHub repository
4. Select the repository and branch (`main`)
5. Configure the app components:

### 3.2 Configure Backend (Laravel API)

**Component Type**: Web Service

| Setting | Value |
|---------|-------|
| Source Directory | `/backend` |
| Build Command | See below |
| Run Command | See below |
| HTTP Port | 8080 |
| Instance Size | Basic ($5/mo) or Pro ($12/mo) |

**Build Command:**
```bash
composer install --no-dev --optimize-autoloader && php artisan config:cache && php artisan route:cache && php artisan view:cache
```

**Run Command:**
```bash
php artisan migrate --force && heroku-php-nginx -C nginx.conf public/
```

> Note: DigitalOcean uses the Heroku buildpack which includes `heroku-php-nginx`

### 3.3 Configure Frontend (React)

**Component Type**: Static Site

| Setting | Value |
|---------|-------|
| Source Directory | `/frontend` |
| Build Command | `npm install && npm run build` |
| Output Directory | `dist` |

### 3.4 Set Environment Variables

Go to **App Settings → Environment Variables** and add:

#### Backend Variables:
```
APP_NAME=PrintShop POS
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-app.ondigitalocean.app

# Database (Supabase)
DB_CONNECTION=pgsql
DB_HOST=db.xxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=your-supabase-password

# Session & Cache
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

# Sanctum
SANCTUM_STATEFUL_DOMAINS=your-frontend-domain.ondigitalocean.app
SESSION_DOMAIN=.ondigitalocean.app

# Generate with: php artisan key:generate --show
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.ondigitalocean.app
```

#### Frontend Variables:
```
VITE_API_BASE_URL=https://your-api.ondigitalocean.app/api
```

---

## Step 4: Update CORS Configuration

Update `backend/config/cors.php` for production:

```php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5174'),
    ],
    'allowed_origins_patterns' => [
        // Allow all DigitalOcean app domains
        '#^https://.*\.ondigitalocean\.app$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

---

## Step 5: Database Migration

After deployment, run migrations:

### Option A: Via DigitalOcean Console
1. Go to your app in DigitalOcean
2. Click **Console** tab
3. Run:
```bash
php artisan migrate --force
php artisan db:seed --force
```

### Option B: Via SSH (if using Droplet)
```bash
ssh root@your-droplet-ip
cd /app
php artisan migrate --force
php artisan db:seed --force
```

---

## Step 6: DNS & Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain
3. Update your DNS records:
   - `A` record pointing to DigitalOcean IP
   - Or `CNAME` to `xxx.ondigitalocean.app`

---

## Environment Variables Quick Reference

### Backend (.env.production)
```env
APP_NAME="PrintShop POS"
APP_ENV=production
APP_KEY=base64:YOUR_KEY_HERE
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=pgsql
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=YOUR_SUPABASE_PASSWORD

BROADCAST_CONNECTION=log
CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database
SESSION_LIFETIME=120

SANCTUM_STATEFUL_DOMAINS=yourdomain.com,www.yourdomain.com
SESSION_DOMAIN=.yourdomain.com

FRONTEND_URL=https://yourdomain.com
```

### Frontend (.env.production)
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

---

## Troubleshooting

### Database Connection Issues
1. Verify Supabase allows connections from DigitalOcean IPs
2. Go to Supabase → Database → Connection Pooling
3. Enable "Pool mode: Transaction"
4. Use port `6543` instead of `5432`

### CORS Errors
1. Verify `FRONTEND_URL` is set correctly in backend
2. Check `config/cors.php` includes your frontend domain
3. Clear config cache: `php artisan config:cache`

### 500 Errors
1. Check DigitalOcean logs: **Runtime Logs** tab
2. Temporarily set `APP_DEBUG=true` to see errors
3. Verify all environment variables are set

### Migration Issues
1. Run migrations manually via Console
2. Check database credentials
3. Ensure Supabase database is accessible

---

## Estimated Costs

| Service | Monthly Cost |
|---------|-------------|
| DigitalOcean App (Basic) | $5 |
| DigitalOcean Static Site | Free (with App) |
| Supabase (Free Tier) | $0 |
| **Total** | **~$5/month** |

For production with more resources:
| Service | Monthly Cost |
|---------|-------------|
| DigitalOcean App (Pro) | $12 |
| Supabase (Pro) | $25 |
| **Total** | **~$37/month** |

---

## Quick Deploy Commands

```bash
# Generate APP_KEY locally
cd backend
php artisan key:generate --show

# Build frontend locally for testing
cd frontend
npm run build
npm run preview

# Test production database connection
php artisan tinker
>>> DB::connection()->getPdo();
```
