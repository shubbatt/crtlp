# Quick Deployment Reference

## Supabase Database (Already Configured!)

Your database is set up and seeded at:
```
Host: aws-1-ap-northeast-1.pooler.supabase.com
Port: 5432
Database: postgres  
Username: postgres.lnemtevmvwbuublxerhl
Password: Micr0Soft@123
```

---

## DigitalOcean App Platform Setup

### Step 1: Create App
1. Go to https://cloud.digitalocean.com/apps
2. Click **"Create App"**
3. Select **GitHub** → Choose `shubbatt/crtlp` → Branch: `main`

### Step 2: Configure Components

#### Component 1: API (Backend)
| Setting | Value |
|---------|-------|
| Name | `api` |
| Source Directory | `/backend` |
| Resource Type | **Web Service** |
| Build Command | `composer install --no-dev --optimize-autoloader && php artisan config:cache && php artisan route:cache && php artisan view:cache` |
| Run Command | `heroku-php-nginx -C nginx.conf public/` |
| HTTP Port | `8080` |
| Instance Size | Basic ($5/mo) |

#### Component 2: Frontend
| Setting | Value |
|---------|-------|
| Name | `frontend` |
| Source Directory | `/frontend` |
| Resource Type | **Static Site** |
| Build Command | `npm install && npm run build` |
| Output Directory | `dist` |

### Step 3: Environment Variables

**For Backend (api):**
```
APP_NAME=PrintShop POS
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:WiK0hkDxjMoAdjg8FAM5GffEW1pnNdxriL+EDstbjNE=

DB_CONNECTION=pgsql
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.lnemtevmvwbuublxerhl
DB_PASSWORD=Micr0Soft@123

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

FRONTEND_URL=${frontend.PUBLIC_URL}
```

**For Frontend:**
```
VITE_API_BASE_URL=${api.PUBLIC_URL}/api
```

> Note: `${api.PUBLIC_URL}` and `${frontend.PUBLIC_URL}` are DigitalOcean's dynamic variable references that automatically get replaced with the actual URLs.

### Step 4: Deploy
Click **"Create Resources"** and wait for deployment.

---

## Test Credentials
```
Admin:      admin@printshop.com / password
Manager:    manager@printshop.com / password
Counter:    counter@printshop.com / password
Production: production@printshop.com / password
Accounts:   accounts@printshop.com / password
```

---

## Troubleshooting

### CORS Issues
If you get CORS errors, make sure `FRONTEND_URL` is set correctly.

### Database Issues
The database is already migrated and seeded. If you need to reset:
```bash
# Via DigitalOcean Console
php artisan migrate:fresh --seed --force
```

### Build Failures
- Check the build logs in DigitalOcean
- Ensure all dependencies are in `composer.json` and `package.json`
