# Print Shop POS System - Complete Specification

**Stack:** Laravel 11 + React 18 + MySQL 8 + JWT Auth  
**Status:** Implementation-Ready  
**Version:** 1.0

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React SPA Frontend                      │
│  (Role-based dashboards, Real-time updates via polling)     │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS/JWT
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Laravel REST API (Stateless)                    │
│  • JWT Middleware • RBAC Guard • Event Broadcasting         │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│   MySQL 8    │   │  Redis (Queue)   │
│  Primary DB  │   │  Jobs/Cache      │
└──────────────┘   └──────────────────┘
```

### 1.2 Core Modules

**Backend (Laravel)**
- `Auth` - JWT token management, role guards
- `Pricing` - Multi-model pricing engine
- `Order` - Order lifecycle, state machine
- `Service` - Production workflow management
- `Customer` - CRM, credit management
- `Quotation` - Versioned estimates
- `Accounting` - Invoices, payments, aging
- `Inventory` - Stock management
- `Notification` - Real-time alerts
- `Audit` - Comprehensive logging

**Frontend (React)**
- `AdminDashboard` - System config, user management
- `CounterApp` - Order entry, customer lookup
- `BackOfficeApp` - Service queue, production tracking
- `AccountsApp` - Financial reports, invoice management
- `ManagerApp` - Analytics, approvals, oversight
- `SharedComponents` - Pricing calculator, product search

---

## 2. Role-Based Access Control (RBAC)

### 2.1 Permission Matrix

| Module/Action                | Admin | Manager | Counter | BackOffice | Accounts |
|------------------------------|-------|---------|---------|------------|----------|
| **Users & Roles**            |       |         |         |            |          |
| Create/Edit Users            | ✓     | ✗       | ✗       | ✗          | ✗        |
| Assign Roles                 | ✓     | ✗       | ✗       | ✗          | ✗        |
| View All Users               | ✓     | ✓       | ✗       | ✗          | ✗        |
| **Products & Pricing**       |       |         |         |            |          |
| Create/Edit Products         | ✓     | ✓       | ✗       | ✗          | ✗        |
| View Products                | ✓     | ✓       | ✓       | ✓          | ✓        |
| Override Pricing             | ✓     | ✓       | req*    | ✗          | ✗        |
| Set Customer Pricing         | ✓     | ✓       | ✗       | ✗          | ✗        |
| **Orders**                   |       |         |         |            |          |
| Create Orders                | ✓     | ✓       | ✓       | ✗          | ✗        |
| Edit Orders (Draft)          | ✓     | ✓       | ✓       | ✗          | ✗        |
| Cancel Orders                | ✓     | ✓       | req*    | ✗          | ✗        |
| View All Orders              | ✓     | ✓       | ✓       | ✗          | ✓        |
| Apply Discounts              | ✓     | ✓       | req*    | ✗          | ✗        |
| **Service/Production**       |       |         |         |            |          |
| View Service Queue           | ✓     | ✓       | ✓       | ✓          | ✗        |
| Update Service Status        | ✓     | ✓       | ✗       | ✓          | ✗        |
| Assign to Operators          | ✓     | ✓       | ✗       | ✓          | ✗        |
| Mark Complete                | ✓     | ✓       | ✗       | ✓          | ✗        |
| **Customers**                |       |         |         |            |          |
| Create Customers             | ✓     | ✓       | ✓       | ✗          | ✗        |
| Set Credit Limits            | ✓     | ✓       | ✗       | ✗          | ✓        |
| View Credit History          | ✓     | ✓       | ✓       | ✗          | ✓        |
| **Quotations**               |       |         |         |            |          |
| Create Quotations            | ✓     | ✓       | ✓       | ✗          | ✗        |
| Approve Quotations           | ✓     | ✓       | ✗       | ✗          | ✗        |
| Convert to Order             | ✓     | ✓       | ✓       | ✗          | ✗        |
| **Payments & Invoices**      |       |         |         |            |          |
| Record Payments              | ✓     | ✓       | ✓       | ✗          | ✓        |
| Issue Invoices               | ✓     | ✓       | ✓       | ✗          | ✓        |
| Void/Refund                  | ✓     | ✓       | req*    | ✗          | ✓        |
| Financial Reports            | ✓     | ✓       | ✗       | ✗          | ✓        |
| **Audit & Logs**             |       |         |         |            |          |
| View Audit Logs              | ✓     | ✓       | ✗       | ✗          | ✓        |
| Export Reports               | ✓     | ✓       | ✗       | ✗          | ✓        |

**Legend:**  
✓ = Allowed  
✗ = Denied  
req* = Requires Manager/Admin approval

### 2.2 Authentication Flow

```
User Login → JWT Token (24h) → Middleware validates → Role checked → Route allowed/denied
```

**Implementation:**
- Laravel Sanctum for token management
- Custom middleware: `CheckRole`, `CheckPermission`
- Frontend stores token in httpOnly cookie + localStorage backup
- Auto-refresh token 5min before expiry

---

## 3. Order & Service Workflow

### 3.1 Order Lifecycle State Machine

```
DRAFT → PENDING_PAYMENT → CONFIRMED → IN_PRODUCTION → QA → READY → DELIVERED → COMPLETED
   │         │                │              │                        │
   └────────┴────────────────┴──────────────┴────────────────────────┴──→ CANCELLED
```

**State Transitions:**

| From            | To                  | Trigger                     | Actor          |
|-----------------|---------------------|-----------------------------|----------------|
| DRAFT           | PENDING_PAYMENT     | Submit order                | Counter        |
| PENDING_PAYMENT | CONFIRMED           | Payment received/partial    | Counter/Accounts|
| CONFIRMED       | IN_PRODUCTION       | Auto (if needs service)     | System         |
| IN_PRODUCTION   | QA                  | Production complete         | BackOffice     |
| QA              | READY               | QA pass                     | Manager/BackOffice|
| READY           | DELIVERED           | Customer pickup/delivery    | Counter        |
| DELIVERED       | COMPLETED           | Auto (if fully paid)        | System         |
| ANY             | CANCELLED           | Cancellation approved       | Manager/Admin  |

### 3.2 Service Job Workflow

**Auto-Generation Logic:**
```
Order contains service item → System creates ServiceJob → Status: PENDING
```

**Service Statuses:**

1. **PENDING** - Awaiting assignment
2. **ASSIGNED** - Allocated to operator
3. **IN_PROGRESS** - Production started
4. **ON_HOLD** - Blocked (material shortage, etc.)
5. **QA_REVIEW** - Quality check
6. **COMPLETED** - Ready for delivery
7. **REJECTED** - Failed QA (loop back to IN_PROGRESS)

**Status Change Triggers:**
- Counter notified on: `COMPLETED`, `ON_HOLD`, `REJECTED`
- Customer notified on: `COMPLETED`, `ON_HOLD`
- Auto-escalation if `PENDING > 24h` → Manager alert

### 3.3 Payment Scenarios

**Scenario A: Pay at Order**
```
Order created → Payment added (full) → Status: CONFIRMED → Production starts
```

**Scenario B: Pay at Delivery**
```
Order created → Status: CONFIRMED (credit/invoice) → Production → Payment on READY
```

**Scenario C: Partial Payments**
```
Order total: $500
Payment 1: $200 (order creation) → Status: CONFIRMED
Payment 2: $200 (after 7 days)
Payment 3: $100 (on delivery) → Status: COMPLETED
```

**Business Rules:**
- Minimum 40% deposit for production orders
- Credit customers: no upfront payment required
- Overdue invoices block new orders (configurable in customer profile)

---

## 4. Database Schema

### 4.1 Core Entities

#### **users**
```sql
id, name, email, password, role_id, created_at, updated_at, deleted_at
```

#### **roles**
```sql
id, name (admin, manager, counter_staff, back_office, accounts), permissions (JSON)
```

#### **customers**
```sql
id, name, email, phone, address, type (walk_in, regular, credit),
credit_limit, credit_balance, tax_id, notes, created_at, updated_at
```

#### **products**
```sql
id, sku, name, description, category_id, type (inventory, service, dimension),
unit_cost, stock_qty, min_stock_alert, is_active, created_at, updated_at
```

#### **pricing_rules**
```sql
id, product_id, rule_type (quantity_tier, dimension, fixed, customer_specific),
config (JSON):
  - quantity_tier: [{min_qty: 1, max_qty: 50, price: 10}, ...]
  - dimension: {unit: sqft/sqm, base_price: 5, min_size: 1, max_size: null}
  - customer_specific: {customer_id: 123, discount_pct: 10}
priority, valid_from, valid_until, created_at, updated_at
```

#### **orders**
```sql
id, order_number (auto), customer_id, order_type (walk_in, quotation, invoice),
status (enum), subtotal, discount, tax, total, paid_amount, balance,
payment_terms (immediate, credit_30, credit_60), notes,
created_by, approved_by, created_at, updated_at
```

#### **order_items**
```sql
id, order_id, product_id, item_type (inventory, service, dimension),
description, quantity, dimensions (JSON: {width, height, unit}),
unit_price, line_total, pricing_rule_id (nullable), override_reason (nullable),
created_at, updated_at
```

#### **service_jobs**
```sql
id, job_number (auto), order_id, order_item_id, status (enum),
assigned_to (user_id), priority (low, normal, high, urgent),
due_date, started_at, completed_at, notes,
created_at, updated_at
```

#### **service_status_history**
```sql
id, service_job_id, from_status, to_status, changed_by, reason, created_at
```

#### **quotations**
```sql
id, quote_number (auto), customer_id, version (int), status (draft, sent, approved, expired, converted),
subtotal, discount, tax, total, valid_until, notes, converted_order_id (nullable),
created_by, approved_by, created_at, updated_at
```

#### **quotation_items**
```sql
id, quotation_id, product_id, description, quantity, dimensions (JSON),
unit_price, line_total, created_at, updated_at
```

#### **invoices**
```sql
id, invoice_number (auto), order_id, customer_id, status (draft, issued, partial, paid, overdue),
subtotal, discount, tax, total, paid_amount, balance,
issue_date, due_date, created_at, updated_at
```

#### **payments**
```sql
id, payment_number (auto), invoice_id (nullable), order_id (nullable),
customer_id, amount, payment_method (cash, card, bank_transfer, credit),
reference_number, received_by, payment_date, created_at, updated_at
```

#### **notifications**
```sql
id, user_id, type (order_update, payment_reminder, service_status),
title, message, data (JSON), read_at, created_at
```

#### **audit_logs**
```sql
id, user_id, action (create, update, delete, approve, cancel),
entity_type (order, payment, quotation, etc.), entity_id,
old_values (JSON), new_values (JSON), ip_address, created_at
```

### 4.2 Key Relationships

```
customers →< orders →< order_items → products
orders →< service_jobs → users (assigned_to)
orders →< invoices →< payments
quotations → orders (converted_order_id)
pricing_rules → products
users → roles → permissions
```

### 4.3 Indexes (Critical for Performance)

```sql
-- Orders
idx_orders_status, idx_orders_customer_id, idx_orders_created_at

-- Service Jobs
idx_service_jobs_status, idx_service_jobs_assigned_to, idx_service_jobs_due_date

-- Payments
idx_payments_customer_id, idx_payments_payment_date

-- Invoices
idx_invoices_status, idx_invoices_customer_id, idx_invoices_due_date

-- Audit Logs
idx_audit_logs_entity_type_id, idx_audit_logs_created_at
```

---

## 5. Laravel API Module Breakdown

### 5.1 Module Structure

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── AuthController.php
│   │   ├── OrderController.php
│   │   ├── ServiceJobController.php
│   │   ├── CustomerController.php
│   │   ├── QuotationController.php
│   │   ├── InvoiceController.php
│   │   ├── PaymentController.php
│   │   ├── ProductController.php
│   │   ├── PricingController.php
│   │   └── ReportController.php
│   ├── Middleware/
│   │   ├── CheckRole.php
│   │   ├── CheckPermission.php
│   │   └── AuditLog.php
│   └── Requests/
│       ├── StoreOrderRequest.php
│       ├── UpdateServiceJobRequest.php
│       └── ...
├── Models/
│   ├── User.php
│   ├── Order.php
│   ├── ServiceJob.php
│   ├── Customer.php
│   └── ...
├── Services/
│   ├── PricingEngine.php
│   ├── OrderService.php
│   ├── ServiceJobService.php
│   ├── PaymentService.php
│   └── InvoiceService.php
├── Events/
│   ├── OrderStatusChanged.php
│   ├── ServiceJobUpdated.php
│   └── PaymentReceived.php
├── Listeners/
│   ├── NotifyCounterStaff.php
│   ├── UpdateInventory.php
│   └── CreateServiceJob.php
└── Jobs/
    ├── SendPaymentReminder.php
    └── GenerateAgingReport.php
```

### 5.2 Critical Service Classes

#### **PricingEngine.php**
```php
public function calculate(Product $product, array $params): array
{
    // Params: quantity, width, height, customer_id
    // Returns: ['unit_price' => X, 'line_total' => Y, 'applied_rule' => Z]
    
    // Priority: Customer-specific → Dimension → Quantity-tier → Base price
}
```

#### **OrderService.php**
```php
public function create(array $data): Order
public function addItem(Order $order, array $itemData): OrderItem
public function updateStatus(Order $order, string $newStatus, User $user): void
public function calculateTotals(Order $order): void
public function applyDiscount(Order $order, float $discount, string $reason): void
```

#### **ServiceJobService.php**
```php
public function createFromOrderItem(OrderItem $item): ServiceJob
public function assign(ServiceJob $job, User $operator): void
public function updateStatus(ServiceJob $job, string $status, string $reason): void
public function getQueueByPriority(string $status = 'PENDING'): Collection
```

#### **PaymentService.php**
```php
public function recordPayment(array $data): Payment
public function allocateToInvoice(Payment $payment, Invoice $invoice): void
public function checkOverdueInvoices(): Collection
public function sendReminders(): void
```

### 5.3 API Routes

```php
// routes/api.php

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh'])->middleware('auth:sanctum');

Route::middleware(['auth:sanctum', 'audit.log'])->group(function () {
    
    // Orders
    Route::apiResource('orders', OrderController::class);
    Route::post('orders/{order}/items', [OrderController::class, 'addItem']);
    Route::patch('orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::post('orders/{order}/approve-discount', [OrderController::class, 'approveDiscount'])
        ->middleware('role:manager,admin');
    
    // Service Jobs
    Route::get('service-jobs/queue', [ServiceJobController::class, 'queue'])
        ->middleware('role:back_office,manager,admin');
    Route::patch('service-jobs/{job}/assign', [ServiceJobController::class, 'assign']);
    Route::patch('service-jobs/{job}/status', [ServiceJobController::class, 'updateStatus']);
    
    // Customers
    Route::apiResource('customers', CustomerController::class);
    Route::get('customers/{customer}/credit-history', [CustomerController::class, 'creditHistory']);
    Route::patch('customers/{customer}/credit-limit', [CustomerController::class, 'updateCreditLimit'])
        ->middleware('role:manager,admin,accounts');
    
    // Quotations
    Route::apiResource('quotations', QuotationController::class);
    Route::post('quotations/{quotation}/convert', [QuotationController::class, 'convertToOrder']);
    Route::post('quotations/{quotation}/new-version', [QuotationController::class, 'createVersion']);
    
    // Invoices & Payments
    Route::apiResource('invoices', InvoiceController::class);
    Route::apiResource('payments', PaymentController::class);
    Route::get('invoices/overdue', [InvoiceController::class, 'overdue']);
    Route::get('reports/aging', [ReportController::class, 'agingReport'])
        ->middleware('role:accounts,manager,admin');
    
    // Products & Pricing
    Route::apiResource('products', ProductController::class);
    Route::get('pricing/calculate', [PricingController::class, 'calculate']);
    Route::apiResource('pricing-rules', PricingController::class);
    
    // Reports
    Route::get('reports/sales', [ReportController::class, 'sales'])
        ->middleware('role:manager,admin,accounts');
    Route::get('reports/production', [ReportController::class, 'production'])
        ->middleware('role:manager,admin,back_office');
});
```

---

## 6. React Frontend Module Separation

### 6.1 Application Structure

```
src/
├── apps/
│   ├── AdminApp/
│   │   ├── pages/
│   │   │   ├── UserManagement.jsx
│   │   │   ├── RolePermissions.jsx
│   │   │   └── SystemSettings.jsx
│   │   └── index.jsx
│   ├── CounterApp/
│   │   ├── pages/
│   │   │   ├── OrderEntry.jsx
│   │   │   ├── CustomerLookup.jsx
│   │   │   ├── QuickSale.jsx
│   │   │   └── PaymentProcessing.jsx
│   │   └── index.jsx
│   ├── BackOfficeApp/
│   │   ├── pages/
│   │   │   ├── ServiceQueue.jsx
│   │   │   ├── JobDetails.jsx
│   │   │   └── ProductionBoard.jsx
│   │   └── index.jsx
│   ├── AccountsApp/
│   │   ├── pages/
│   │   │   ├── InvoiceManagement.jsx
│   │   │   ├── PaymentTracking.jsx
│   │   │   ├── AgingReport.jsx
│   │   │   └── FinancialReports.jsx
│   │   └── index.jsx
│   └── ManagerApp/
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── ApprovalQueue.jsx
│       │   ├── SalesAnalytics.jsx
│       │   └── PerformanceMetrics.jsx
│       └── index.jsx
├── components/
│   ├── shared/
│   │   ├── PricingCalculator.jsx
│   │   ├── ProductSearch.jsx
│   │   ├── CustomerSelector.jsx
│   │   └── PaymentForm.jsx
│   ├── orders/
│   │   ├── OrderForm.jsx
│   │   ├── OrderItemsTable.jsx
│   │   └── OrderStatusBadge.jsx
│   └── layout/
│       ├── Navbar.jsx
│       ├── Sidebar.jsx
│       └── NotificationBell.jsx
├── features/
│   ├── auth/
│   │   ├── authSlice.js
│   │   └── authAPI.js
│   ├── orders/
│   │   ├── ordersSlice.js
│   │   └── ordersAPI.js
│   ├── serviceJobs/
│   │   ├── serviceJobsSlice.js
│   │   └── serviceJobsAPI.js
│   └── ...
├── hooks/
│   ├── useAuth.js
│   ├── usePricing.js
│   └── useNotifications.js
├── utils/
│   ├── api.js (Axios instance with JWT interceptor)
│   ├── formatters.js
│   └── validators.js
└── App.jsx
```

### 6.2 Role-Based Routing

```jsx
// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" />;
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminApp />
          </ProtectedRoute>
        } />
        
        <Route path="/counter/*" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'counter_staff']}>
            <CounterApp />
          </ProtectedRoute>
        } />
        
        <Route path="/backoffice/*" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'back_office']}>
            <BackOfficeApp />
          </ProtectedRoute>
        } />
        
        <Route path="/accounts/*" element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'accounts']}>
            <AccountsApp />
          </ProtectedRoute>
        } />
        
        <Route path="/manager/*" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <ManagerApp />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
```

### 6.3 Key Components

#### **PricingCalculator.jsx**
```jsx
const PricingCalculator = ({ product, customerId, onCalculate }) => {
  const [quantity, setQuantity] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const calculatePrice = async () => {
    const result = await api.get('/pricing/calculate', {
      params: { product_id: product.id, quantity, ...dimensions, customer_id: customerId }
    });
    onCalculate(result.data);
  };
  
  // UI handles quantity input, dimension input based on product type
};
```

#### **ServiceQueue.jsx** (BackOffice)
```jsx
const ServiceQueue = () => {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('PENDING');
  
  useEffect(() => {
    const fetchQueue = async () => {
      const { data } = await api.get(`/service-jobs/queue?status=${filter}`);
      setJobs(data);
    };
    fetchQueue();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [filter]);
  
  // Display kanban board: PENDING | IN_PROGRESS | QA_REVIEW | COMPLETED
};
```

---

## 7. Critical Edge Cases & Failure Scenarios

### 7.1 Order Management

| Edge Case | Solution |
|-----------|----------|
| **Partial payment on credit-blocked customer** | System prevents order creation → Display warning with outstanding balance |
| **Order cancelled after production started** | Require Manager approval → Refund logic calculates based on completion % → Log in audit |
| **Price override exceeds threshold** | Flag for Manager approval → Order status: PENDING_APPROVAL → Notification sent |
| **Mixed payment methods (cash + card)** | Support multiple payment records per order → Each payment_method tracked separately |
| **Customer wants to change order after confirmation** | Create amendment workflow: duplicate order as version 2 → Cancel original → Link in audit log |

### 7.2 Service Jobs

| Edge Case | Solution |
|-----------|----------|
| **Job stuck in IN_PROGRESS > 48h** | Auto-escalate to Manager → Notification: "Job #123 overdue" |
| **Material shortage mid-production** | Status → ON_HOLD → Notify Counter → Log reason → Customer notified via SMS/Email |
| **QA rejection** | Status → REJECTED → Loop back to ASSIGNED → Increment rework_count → If rework_count > 2 → Manager alert |
| **Operator assigned to 10+ jobs** | System warns on assignment → Suggests load balancing |
| **Rush order (same-day)** | Priority field set to URGENT → Appears top of queue → Due date validation enforced |

### 7.3 Payments & Invoicing

| Edge Case | Solution |
|-----------|----------|
| **Overpayment** | Create credit_balance in customer record → Allow apply to future orders |
| **Invoice partially paid multiple times** | Track each payment → Update invoice.paid_amount incrementally → Status updates dynamically |
| **Payment recorded to wrong invoice** | Accounts can void payment → Requires Manager approval → Audit log captures reallocation |
| **Customer disputes invoice** | Status → DISPUTED → Prevent auto-reminders → Manager resolves |
| **Aging > 90 days** | Auto-block new orders → Email to customer + Manager notification |

### 7.4 Quotations

| Edge Case | Solution |
|-----------|----------|
| **Quotation expired but customer accepts** | Allow Manager to extend validity → Create new version with updated dates |
| **Price changed between quote and order** | Display warning to Counter staff → Option to honor quoted price or update |
| **Convert quotation with out-of-stock items** | Pre-check inventory → Warn staff → Allow convert with backorder flag |

### 7.5 Pricing

| Edge Case | Solution |
|-----------|----------|
| **Multiple pricing rules conflict** | Priority field resolves (customer_specific > dimension > quantity_tier > base) |
| **Dimension-based with min size not met** | Charge minimum size price → Display warning in UI |
| **Negative pricing due to discount** | Validation prevents > 100% discount → Max discount configurable per role |
| **Tax-exempt customers** | Customer profile flag: tax_exempt → System skips tax calculation |

### 7.6 System-Level

| Edge Case | Solution |
|-----------|----------|
| **Concurrent edit of same order** | Optimistic locking: check updated_at before save → Return 409 Conflict if stale |
| **Database connection lost mid-transaction** | Laravel DB transactions with rollback → Queue jobs for retry → Frontend shows error modal |
| **JWT token expires during order entry** | Auto-refresh token in Axios interceptor → Retry failed request |
| **Notifications not delivered** | Queue-based system → Retry failed notifications 3x → Log failures for manual review |

---

## 8. Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Database migration files for all tables
- [ ] Seed data: roles, permissions, test products
- [ ] Auth system: JWT login, refresh, role middleware
- [ ] Base models with relationships

### Phase 2: Core Business Logic (Week 3-5)
- [ ] Pricing Engine service class
- [ ] Order CRUD + state machine
- [ ] Service Job workflow
- [ ] Customer management + credit logic
- [ ] Payment processing

### Phase 3: Advanced Features (Week 6-7)
- [ ] Quotation system with versioning
- [ ] Invoice lifecycle
- [ ] Aging reports
- [ ] Notification system
- [ ] Audit logging

### Phase 4: Frontend (Week 8-10)
- [ ] Counter App (order entry, payment)
- [ ] BackOffice App (service queue)
- [ ] Accounts App (invoices, reports)
- [ ] Manager Dashboard (analytics, approvals)
- [ ] Admin panel (user/role management)

### Phase 5: Testing & Deployment (Week 11-12)
- [ ] Unit tests for critical services
- [ ] Integration tests for workflows
- [ ] Load testing (simulate peak hours)
- [ ] Production deployment
- [ ] Training documentation

---

## 9. Performance Optimizations

### 9.1 Database
- Indexing strategy (see section 4.3)
- Query optimization: eager loading relationships
- Archive old orders/invoices to separate table after 2 years

### 9.2 Caching
```php
// Cache pricing rules (rarely change)
Cache::remember("pricing_rules_{$productId}", 3600, fn() => PricingRule::where(...)->get());

// Cache customer credit status
Cache::remember("customer_credit_{$customerId}", 600, fn() => Customer::find($id)->credit_balance);
```

### 9.3 API
- Pagination on all list endpoints (default 50 items)
- Rate limiting: 100 requests/min per user
- Response compression (gzip)

### 9.4 Frontend
- React.lazy() for code-splitting per app
- Virtual scrolling for large lists (service queue, order history)
- Debounce search inputs (300ms)

---

## 10. Security Considerations

| Threat | Mitigation |
|--------|------------|
| **Unauthorized access** | JWT expiry (24h), role-based guards on all routes |
| **Price manipulation** | Audit all price overrides, require approval above threshold |
| **SQL injection** | Eloquent ORM, parameterized queries |
| **XSS attacks** | React auto-escapes, CSP headers |
| **CSRF** | Laravel Sanctum CSRF protection |
| **Data breaches** | Encrypt sensitive fields (customer phone, tax_id), HTTPS only |
| **Session hijacking** | httpOnly cookies, secure flag, IP validation |

---

## 11. Deployment Architecture

```
               ┌─────────────┐
               │   Nginx     │ (Reverse Proxy + SSL)
               └──────┬──────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│  Laravel App    │       │  Redis Queue    │
│  (PHP-FPM 8.2)  │◄─────►│   Worker        │
└────────┬────────┘       └─────────────────┘
         │
         ▼
┌─────────────────┐
│   MySQL 8.0     │
│  (InnoDB)       │
└─────────────────┘

React Build → Served by Nginx as static files
```

**Server Requirements:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- PHP 8.2, Composer, Node 20
- MySQL 8.0, Redis 7

---

## Appendix A: Sample Data Models

### Order JSON Example
```json
{
  "id": 1,
  "order_number": "ORD-2025-001",
  "customer_id": 15,
  "order_type": "walk_in",
  "status": "IN_PRODUCTION",
  "subtotal": 450.00,
  "discount": 45.00,
  "tax": 40.50,
  "total": 445.50,
  "paid_amount": 200.00,
  "balance": 245.50,
  "items": [
    {
      "id": 1,
      "product_id": 10,
      "item_type": "dimension",
      "description": "Banner 3x6 ft",
      "quantity": 1,
      "dimensions": {"width": 3, "height": 6, "unit": "ft"},
      "unit_price": 150.00,
      "line_total": 150.00,
      "pricing_rule_id": 5
    },
    {
      "id": 2,
      "product_id": 22,
      "item_type": "inventory",
      "description": "Business Cards (500 qty)",
      "quantity": 500,
      "unit_price": 0.60,
      "line_total": 300.00,
      "pricing_rule_id": 12
    }
  ],
  "service_jobs": [
    {
      "id": 45,
      "job_number": "JOB-2025-045",
      "order_item_id": 1,
      "status": "IN_PROGRESS",
      "assigned_to": 8,
      "priority": "normal",
      "due_date": "2025-12-15 17:00:00"
    }
  ]
}
```

---

**END OF SPECIFICATION**

*This document is implementation-ready. All assumptions are industry-standard for print shop operations. Proceed with development.*
