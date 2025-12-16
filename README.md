# Print Shop POS System

A full-featured Sales & Service POS system for Print Shops built with Laravel (backend) and React (frontend).

## 🚀 Features

### Business Logic
- **Multi-Model Pricing Engine**: Quantity-tier, dimension-based, fixed, and customer-specific pricing
- **Order Management**: Complete workflow from draft to delivery with state machine
- **Service/Production Workflow**: Track jobs through production pipeline with QA and status history
- **Credit Management**: Customer credit limits, invoice aging, payment tracking
- **Quotation System**: Versioned quotes with expiry and order conversion
- **Payment Flexibility**: Partial payments, multiple payment methods, invoice-based
- **Audit Trail**: Complete logging of all critical actions

### Role-Based Access Control (RBAC)
- **Admin**: Full system access
- **Manager**: Oversight, approvals, analytics
- **Counter Staff**: Order entry, customer service
- **Back Office**: Production workflow management
- **Accounts**: Financial operations, reports

## 📋 Tech Stack

- **Backend**: Laravel 11 (REST API)
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: MySQL 8 (SQLite for development)
- **Authentication**: Laravel Sanctum (JWT)
- **State Management**: Redux Toolkit (TBD)

## 🛠️ Installation

### Prerequisites
- PHP >= 8.2
- Composer
- Node.js >= 20
- MySQL 8 (or SQLite for dev)

### Backend Setup

```bash
cd backend

# Install dependencies
composer install

# Configure environment
cp .env.example .env
php artisan key:generate

# Run migrations and seeders
php artisan migrate:fresh --seed

# Start development server
php artisan serve
```

The API will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5174`

## 🔑 Test Credentials

```
Admin:      admin@printshop.com / password
Manager:    manager@printshop.com / password
Counter:    counter@printshop.com / password
Production: production@printshop.com / password
Accounts:   accounts@printshop.com / password
```

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### Resource Endpoints
```
# Orders
GET    /api/orders
POST   /api/orders
GET    /api/orders/{id}
PUT    /api/orders/{id}
DELETE /api/orders/{id}
POST   /api/orders/{id}/items
PATCH  /api/orders/{id}/status

# Service Jobs
GET    /api/service-jobs/queue
PATCH  /api/service-jobs/{id}/assign
PATCH  /api/service-jobs/{id}/status

# Customers
GET    /api/customers
POST   /api/customers
GET    /api/customers/{id}/credit-history

# Quotations
GET    /api/quotations
POST   /api/quotations
POST   /api/quotations/{id}/convert

# Invoices & Payments
GET    /api/invoices
POST   /api/payments
GET    /api/invoices/overdue

# Products & Pricing
GET    /api/products
GET    /api/pricing/calculate
```

## 🗄️ Database Schema

### Core Tables
- `users` - System users with role-based access
- `roles` - User roles with JSON permissions
- `customers` - Customer profiles with credit management
- `products` - Inventory, service, and dimension-based products
- `pricing_rules` - Flexible pricing configurations
- `orders` - Orders with complete state machine
- `order_items` - Line items with pricing details
- `service_jobs` - Production workflow tracking
- `quotations` - Quote management with versioning
- `invoices` - Invoice lifecycle management
- `payments` - Payment tracking
- `notifications` - User notifications
- `audit_logs` - Complete audit trail

See `SYSTEM_SPECIFICATION.md` for complete schema details.

## 🏗️ Project Structure

```
CtrlP/
├── backend/                    # Laravel API
│   ├── app/
│   │   ├── Models/            # Eloquent models
│   │   ├── Http/
│   │   │   ├── Controllers/   # API controllers
│   │   │   ├── Middleware/    # RBAC, audit middleware
│   │   │   └── Requests/      # Form request validation
│   │   ├── Services/          # Business logic
│   │   ├── Events/            # Domain events
│   │   ├── Listeners/         # Event handlers
│   │   └── Jobs/              # Queue jobs
│   ├── database/
│   │   ├── migrations/        # Database migrations
│   │   └── seeders/           # Data seeders
│   └── routes/
│       └── api.php            # API routes
├── frontend/                   # React SPA
│   └── src/
│       ├── apps/              # Role-specific apps
│       │   ├── AdminApp/
│       │   ├── CounterApp/
│       │   ├── BackOfficeApp/
│       │   ├── AccountsApp/
│       │   └── ManagerApp/
│       ├── components/        # Shared components
│       ├── features/          # Redux slices & API
│       └── hooks/             # Custom hooks
└── SYSTEM_SPECIFICATION.md    # Complete spec
```

## 🧪 Testing

```bash
# Backend tests
cd backend
php artisan test

# Frontend tests
cd frontend
npm run test
```

## 📖 Documentation

- `SYSTEM_SPECIFICATION.md` - Complete system architecture and specifications
- `PROGRESS.md` - Development progress tracker

## 🔧 Development Workflow

### Backend Development
1. Create migration: `php artisan make:migration create_xxx_table`
2. Create model: `php artisan make:model ModelName`
3. Create controller: `php artisan make:controller ApiController`
4. Add routes in `routes/api.php`
5. Test with Postman/Insomnia

### Frontend Development
1. Create component in appropriate app directory
2. Add Redux slice in `features/`
3. Connect to API using axios instance
4. Test in browser

## 🚢 Deployment

### Backend
```bash
# Build production
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Frontend
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📄 License

Proprietary - All rights reserved

## 👥 Team

- System Architecture: Designed per specification
- Backend: Laravel 11
- Frontend: React 18 + TypeScript
- Database: MySQL 8

---

**Status**: 🟢 Active Development  
**Last Updated**: 2025-12-12
