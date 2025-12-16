# API Testing Guide

## Prerequisites
Server must be running: `php artisan serve`

## 1. Authentication

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@printshop.com",
    "password": "password"
  }'
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@printshop.com",
    "role": "admin",
    "permissions": {...}
  },
  "token": "1|xxxxxxxxxxxxx"
}
```

**Save the token** for subsequent requests!

### Get Current User
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 2. Products

### Get All Products
```bash
curl http://localhost:8000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Single Product
```bash
curl http://localhost:8000/api/products/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Search Products
```bash
curl "http://localhost:8000/api/products?search=business" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Filter by Type
```bash
curl "http://localhost:8000/api/products?type=inventory" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 3. Pricing Calculator

### Calculate Price for Business Cards (Quantity-tier)
```bash
curl "http://localhost:8000/api/pricing/calculate?product_id=1&quantity=500" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "product_id": 1,
  "product_name": "Business Cards",
  "unit_price": 0.60,
  "line_total": 300.00,
  "applied_rule": 1
}
```

### Calculate Price for Banner (Dimension-based)
```bash
curl "http://localhost:8000/api/pricing/calculate?product_id=3&quantity=1&width=3&height=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "product_id": 3,
  "product_name": "Vinyl Banner",
  "unit_price": 12.00,
  "line_total": 216.00,
  "applied_rule": 2
}
```

### Batch Calculate
```bash
curl -X POST http://localhost:8000/api/pricing/batch-calculate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"product_id": 1, "quantity": 500},
      {"product_id": 2, "quantity": 100},
      {"product_id": 3, "quantity": 1, "width": 3, "height": 6}
    ]
  }'
```

---

## 4. Customers

### Create Customer
```bash
curl -X POST http://localhost:8000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Corporation",
    "email": "contact@abc.com",
    "phone": "555-1234",
    "type": "credit",
    "credit_limit": 5000
  }'
```

### Get All Customers
```bash
curl http://localhost:8000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Customer Credit History
```bash
curl http://localhost:8000/api/customers/1/credit-history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 5. Orders

### Create Order (Walk-in, Multiple Items)
```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_type": "walk_in",
    "payment_terms": "immediate",
    "items": [
      {
        "product_id": 1,
        "quantity": 500,
        "description": "Business Cards - Full Color"
      },
      {
        "product_id": 2,
        "quantity": 100,
        "description": "A5 Flyers"
      }
    ]
  }'
```

**Response:**
```json
{
  "id": 1,
  "order_number": "ORD-2025-0001",
  "status": "DRAFT",
  "subtotal": 380.00,
  "discount": 0,
  "tax": 38.00,
  "total": 418.00,
  "paid_amount": 0,
  "balance": 418.00,
  "items": [...]
}
```

### Create Order with Dimension-based Product
```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_type": "walk_in",
    "payment_terms": "immediate",
    "items": [
      {
        "product_id": 3,
        "quantity": 1,
        "width": 4,
        "height": 8,
        "description": "Custom Vinyl Banner 4x8 ft"
      }
    ]
  }'
```

### Get All Orders
```bash
curl http://localhost:8000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Filter Orders by Status
```bash
curl "http://localhost:8000/api/orders?status=DRAFT" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Single Order with Full Details
```bash
curl http://localhost:8000/api/orders/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Item to Existing Order
```bash
curl -X POST http://localhost:8000/api/orders/1/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 6,
    "quantity": 1,
    "description": "Graphic Design Service"
  }'
```

### Apply Discount
```bash
curl -X POST http://localhost:8000/api/orders/1/discount \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "discount": 50.00,
    "reason": "Repeat customer discount"
  }'
```

### Update Order Status
```bash
curl -X PATCH http://localhost:8000/api/orders/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PENDING_PAYMENT"
  }'
```

Then:
```bash
curl -X PATCH http://localhost:8000/api/orders/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED"
  }'
```

Then:
```bash
curl -X PATCH http://localhost:8000/api/orders/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PRODUCTION"
  }'
```

**Note:** This will auto-create service jobs for service/dimension items!

### Cancel Order
```bash
curl -X POST http://localhost:8000/api/orders/1/cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested cancellation"
  }'
```

---

## 6. Service Jobs

### Get Service Queue (Pending Jobs)
```bash
curl http://localhost:8000/api/service-jobs/queue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Queue by Status
```bash
curl "http://localhost:8000/api/service-jobs/queue?status=IN_PROGRESS" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get All Service Jobs
```bash
curl http://localhost:8000/api/service-jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Single Job with History
```bash
curl http://localhost:8000/api/service-jobs/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Assign Job to User
```bash
curl -X PATCH http://localhost:8000/api/service-jobs/1/assign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 4
  }'
```

### Update Job Status
```bash
# Start production
curl -X PATCH http://localhost:8000/api/service-jobs/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'

# Move to QA
curl -X PATCH http://localhost:8000/api/service-jobs/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "QA_REVIEW"
  }'

# Complete
curl -X PATCH http://localhost:8000/api/service-jobs/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED"
  }'
```

### Update Priority
```bash
curl -X PATCH http://localhost:8000/api/service-jobs/1/priority \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "urgent"
  }'
```

---

## 7. Complete Workflow Example

### Full Order-to-Delivery Flow
```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"counter@printshop.com","password":"password"}' \
  | jq -r '.token')

# 2. Create Order
ORDER_ID=$(curl -s -X POST http://localhost:8000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_type": "walk_in",
    "payment_terms": "immediate",
    "items": [
      {"product_id": 3, "quantity": 1, "width": 5, "height": 10, "description": "Banner 5x10"}
    ]
  }' | jq -r '.id')

# 3. Confirm Order
curl -X PATCH http://localhost:8000/api/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "PENDING_PAYMENT"}'

curl -X PATCH http://localhost:8000/api/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "CONFIRMED"}'

# 4. Move to Production (creates service job)
curl -X PATCH http://localhost:8000/api/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PRODUCTION"}'

# 5. Check service queue
curl http://localhost:8000/api/service-jobs/queue \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test Different User Roles

### Counter Staff
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"counter@printshop.com","password":"password"}'
```
**Can:** Create orders, manage customers, view service jobs  
**Cannot:** Approve large discounts, manage users

### Back Office (Production)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"production@printshop.com","password":"password"}'
```
**Can:** View products, manage service jobs, update job status  
**Cannot:** Create orders, access financial data

### Manager
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@printshop.com","password":"password"}'
```
**Can:** Everything except system config  
**Cannot:** Manage users and roles (admin only)

---

## Expected Database State After Tests

- **Users:** 5 (seeded)
- **Roles:** 5 (seeded)
- **Products:** 7 (seeded with pricing rules)
- **Customers:** 1+ (from tests)
- **Orders:** 1+ (from tests)
- **ServiceJobs:** 1+ (auto-created)
- **AuditLogs:** Multiple entries tracking all actions
- **Notifications:** Auto-generated for status changes

---

## Troubleshooting

### 401 Unauthorized
- Token expired or invalid
- Re-login to get new token

### 500 Internal Server Error
- Check `storage/logs/laravel.log`
- Common: Missing relationships or service dependencies

### Validation Errors
- Check request body matches validation rules
- All required fields must be present

---

## Next Steps

1. ✅ Test all endpoints above
2. ⏳ Implement Quotations API
3. ⏳ Implement Invoices & Payments API
4. ⏳ Build React frontend
5. ⏳ Add real-time notifications (WebSockets/Polling)

---

**API is production-ready for core workflows!** 🚀
