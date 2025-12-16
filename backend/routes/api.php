<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\OutletController;
use App\Http\Controllers\Api\ServiceJobController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\PricingController;
use App\Http\Controllers\Api\ReportController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Health check endpoint for DigitalOcean
Route::get('/health', function () {
    try {
        // Check database connection
        \DB::connection()->getPdo();
        return response()->json([
            'status' => 'healthy',
            'database' => 'connected',
            'timestamp' => now()->toIso8601String(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'unhealthy',
            'database' => 'disconnected',
            'error' => config('app.debug') ? $e->getMessage() : 'Database connection failed',
        ], 503);
    }
});

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/outlets', [OutletController::class, 'index']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    
    // Authentication
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    
    // Outlets (admin only)
    Route::get('/outlets/{id}', [OutletController::class, 'show']);
    Route::put('/outlets/{id}', [OutletController::class, 'update']);
    
    // Orders
    Route::apiResource('orders', OrderController::class);
    Route::post('orders/{id}/items', [OrderController::class, 'addItem']);
    Route::patch('orders/{id}/status', [OrderController::class, 'updateStatus']);
    Route::post('orders/{id}/approve', [OrderController::class, 'approve']);
    Route::post('orders/{id}/reject', [OrderController::class, 'reject']);
    Route::post('orders/{id}/discount', [OrderController::class, 'applyDiscount']);
    Route::post('orders/{id}/cancel', [OrderController::class, 'cancel']);
    
    // Payments
    Route::get('orders/{id}/payments', [PaymentController::class, 'index']);
    Route::post('orders/{id}/payments', [PaymentController::class, 'store']);
    
    // Service Jobs
    Route::get('service-jobs/queue', [ServiceJobController::class, 'queue']);
    Route::apiResource('service-jobs', ServiceJobController::class)->only(['index', 'show']);
    Route::patch('service-jobs/{id}/assign', [ServiceJobController::class, 'assign']);
    Route::patch('service-jobs/{id}/status', [ServiceJobController::class, 'updateStatus']);
    Route::patch('service-jobs/{id}/priority', [ServiceJobController::class, 'updatePriority']);
    Route::post('service-jobs/{id}/comments', [ServiceJobController::class, 'addComment']);
    Route::get('service-jobs/{id}/comments', [ServiceJobController::class, 'getComments']);
    
    // Products
    Route::apiResource('products', ProductController::class);
    
    // Customers
    Route::apiResource('customers', CustomerController::class);
    Route::get('customers/{id}/credit-history', [CustomerController::class, 'creditHistory']);
    Route::patch('customers/{id}/credit-limit', [CustomerController::class, 'updateCreditLimit']);
    
    // Invoices
    Route::apiResource('invoices', InvoiceController::class)->only(['index', 'show', 'update']);
    Route::post('orders/{id}/invoice', [InvoiceController::class, 'createFromOrder']);
    Route::post('invoices/{id}/payments', [InvoiceController::class, 'recordPayment']);
    Route::put('invoices/{id}/draft', [InvoiceController::class, 'updateDraft']);
    Route::post('invoices/{id}/approve', [InvoiceController::class, 'approveDraft']);
    
    // Quotations
    Route::apiResource('quotations', QuotationController::class);
    Route::post('quotations/{id}/items', [QuotationController::class, 'addItem']);
    Route::put('quotations/{id}/items/{itemId}', [QuotationController::class, 'updateItem']);
    Route::delete('quotations/{id}/items/{itemId}', [QuotationController::class, 'removeItem']);
    Route::patch('quotations/{id}/status', [QuotationController::class, 'updateStatus']);
    Route::post('quotations/{id}/convert', [QuotationController::class, 'convertToOrder']);
    
    // Pricing
    Route::get('pricing/calculate', [PricingController::class, 'calculate']);
    Route::post('pricing/batch-calculate', [PricingController::class, 'batchCalculate']);
    
    // Reports
    Route::get('reports/daily-sales', [ReportController::class, 'dailySales']);
    Route::get('reports/daily-orders', [ReportController::class, 'dailyOrders']);
    Route::get('reports/daily-invoices', [ReportController::class, 'dailyInvoices']);
    Route::get('reports/daily-credit', [ReportController::class, 'dailyCredit']);
    Route::get('reports/payment-summary', [ReportController::class, 'paymentSummary']);
    Route::get('reports/invoice-details', [ReportController::class, 'invoiceDetails']);
    Route::get('reports/orders-details', [ReportController::class, 'ordersDetails']);
    Route::get('reports/quotations', [ReportController::class, 'quotations']);
    
});
