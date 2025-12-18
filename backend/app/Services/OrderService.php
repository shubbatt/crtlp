<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\DB;

class OrderService
{
    protected PricingEngine $pricingEngine;
    protected ServiceJobService $serviceJobService;
    protected InvoiceService $invoiceService;

    public function __construct(
        PricingEngine $pricingEngine, 
        ServiceJobService $serviceJobService,
        InvoiceService $invoiceService
    ) {
        $this->pricingEngine = $pricingEngine;
        $this->serviceJobService = $serviceJobService;
        $this->invoiceService = $invoiceService;
    }

    /**
     * Create a new order
     */
    public function create(array $data, User $user): Order
    {
        return DB::transaction(function () use ($data, $user) {
            $customer = null;
            $orderType = $data['order_type'] ?? 'walk_in';
            $paymentTerms = $data['payment_terms'] ?? 'immediate';
            $outletId = $data['outlet_id'] ?? null;
            
            // Validate customer credit if credit customer
            // If credit limit exceeded, order will be created as DRAFT and need manager approval
            $needsApproval = false;
            $approvalReason = null;
            if (isset($data['customer_id'])) {
                $customer = Customer::find($data['customer_id']);
                $estimatedTotal = $data['estimated_total'] ?? 0;
                
                if ($customer && $customer->type === 'credit' && $orderType === 'invoice') {
                    // For credit customers with invoice orders, check if they can place order on credit
                    // If payment_terms is 'immediate', they can pay, so no credit check needed
                    $allowPayment = $paymentTerms === 'immediate';
                    
                    if (!$customer->canPlaceOrder($estimatedTotal, $allowPayment)) {
                        // Instead of throwing, mark as needing approval
                        $needsApproval = true;
                        $approvalReason = $customer->hasOverdueInvoices() 
                            ? 'Customer has overdue invoices' 
                            : 'Customer credit limit exceeded';
                    }
                }
            }

            // Create order
            $order = Order::create([
                'customer_id' => $data['customer_id'] ?? null,
                'outlet_id' => $outletId,
                'order_type' => $orderType,
                'status' => 'DRAFT',
                'payment_terms' => $paymentTerms,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            // Add items if provided
            if (isset($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $itemData) {
                    $this->addItem($order, $itemData);
                }
            }

            // Recalculate totals
            $this->calculateTotals($order);
            
            // Refresh order to get calculated total
            $order = $order->fresh();
            
            // If order needs approval, add note and return (don't create invoice yet)
            if ($needsApproval) {
                $currentNotes = $order->notes ? $order->notes . "\n\n" : '';
                $order->update([
                    'notes' => $currentNotes . "[REQUIRES APPROVAL] " . $approvalReason
                ]);
                return $order->fresh(['items', 'customer', 'invoice']);
            }

            // Create invoice for non-credit orders automatically (walk-in, regular customers)
            // For credit invoice orders, invoice will be created only after delivery (RELEASED status)
            $isCreditInvoiceOrder = $orderType === 'invoice' && $customer && $customer->type === 'credit';
            
            if (!$isCreditInvoiceOrder) {
                try {
                    $this->invoiceService->createFromOrder($order->fresh());
                } catch (\Exception $e) {
                    // Log error but don't fail order creation
                    \Log::warning('Failed to create invoice for order: ' . $e->getMessage());
                }
            }

            return $order->fresh(['items', 'customer', 'invoice']);
        });
    }

    /**
     * Add item to order
     */
    public function addItem(Order $order, array $itemData): OrderItem
    {
        // Calculate pricing
        $product = \App\Models\Product::findOrFail($itemData['product_id']);
        
        $pricing = $this->pricingEngine->calculate($product, [
            'quantity' => $itemData['quantity'] ?? 1,
            'width' => $itemData['width'] ?? null,
            'height' => $itemData['height'] ?? null,
            'customer_id' => $order->customer_id,
        ]);

        // Check if unit_price is overridden
        $unitPrice = $itemData['unit_price'] ?? $pricing['unit_price'];
        $isOverridden = isset($itemData['unit_price']) && abs($itemData['unit_price'] - $pricing['unit_price']) > 0.01;
        
        // Calculate line total
        $lineTotal = $pricing['line_total'];
        if ($isOverridden) {
            // Recalculate line total with overridden unit price
            if ($product->type === 'dimension' && isset($itemData['width'], $itemData['height'])) {
                $area = $itemData['width'] * $itemData['height'];
                $lineTotal = $unitPrice * $area * ($itemData['quantity'] ?? 1);
            } else {
                $lineTotal = $unitPrice * ($itemData['quantity'] ?? 1);
            }
        }

        // Create order item
        $orderItem = $order->items()->create([
            'product_id' => $product->id,
            'item_type' => $product->type,
            'description' => $itemData['description'] ?? $product->name,
            'quantity' => $itemData['quantity'] ?? 1,
            'dimensions' => isset($itemData['width'], $itemData['height']) ? [
                'width' => $itemData['width'],
                'height' => $itemData['height'],
                'unit' => $itemData['unit'] ?? 'ft'
            ] : null,
            'unit_price' => $unitPrice,
            'line_total' => $lineTotal,
            'pricing_rule_id' => $isOverridden ? null : $pricing['applied_rule'], // Clear pricing rule if overridden
            'override_reason' => $isOverridden ? ($itemData['override_reason'] ?? 'Price manually adjusted by staff') : null,
        ]);

        // Recalculate order totals
        $this->calculateTotals($order);

        return $orderItem;
    }

    /**
     * Update order status
     */
    public function updateStatus(Order $order, string $newStatus, User $user, ?string $reason = null): void
    {
        $oldStatus = $order->status;
        
        // Load customer to check type
        $order->load('customer');
        $isCreditInvoiceOrder = $order->order_type === 'invoice' && 
                               $order->customer && 
                               $order->customer->type === 'credit';
        
        // Validate status transition (with special handling for credit invoice orders)
        $this->validateStatusTransition($oldStatus, $newStatus, $isCreditInvoiceOrder);

        // Additional validation: Cannot move from IN_PRODUCTION to READY/RELEASED/COMPLETED if production is not complete
        // CANCELLED jobs are treated as "done" - the item won't be produced but order can proceed
        if ($oldStatus === 'IN_PRODUCTION' && in_array($newStatus, ['READY', 'RELEASED', 'COMPLETED'])) {
            $order->load('serviceJobs');
            $jobs = $order->serviceJobs;
            if ($jobs->isNotEmpty()) {
                $allCompleted = $jobs->every(function ($job) {
                    return in_array($job->status, ['COMPLETED', 'CANCELLED']);
                });
                if (!$allCompleted) {
                    throw new \Exception('Cannot change order status: Production is not complete. All service jobs must be completed or cancelled first.');
                }
            }
        }

        // Additional validation: RELEASED requires full payment
        // EXCEPTION: Credit customers with invoice orders can be released without payment
        // EXCEPTION: Orders with invoices can be released (payment deferred to invoice)
        $order->load('customer', 'invoice');
        $isInvoiceOrder = $order->order_type === 'invoice' && 
                         $order->customer && 
                         $order->customer->type === 'credit';
        
        // Allow release if:
        // 1. Order is fully paid (balance <= 0), OR
        // 2. It's an invoice order for credit customer, OR
        // 3. Order has an invoice (payment deferred to invoice)
        $canReleaseWithBalance = $isInvoiceOrder || $order->invoice;
        
        if ($newStatus === 'RELEASED' && $order->balance > 0 && !$canReleaseWithBalance) {
            throw new \Exception('Cannot release order with outstanding balance. Please record payment first or create an invoice.');
        }

        $order->update(['status' => $newStatus]);

        // Create service jobs if moving to IN_PRODUCTION
        if ($newStatus === 'IN_PRODUCTION') {
            // Reload order with items to ensure they're available
            $order->load('items');
            
            // Only create service jobs if order has items
            if ($order->items && $order->items->isNotEmpty()) {
                try {
                    $jobs = $this->serviceJobService->createFromOrder($order);
                    \Log::info("Created " . count($jobs) . " service jobs for order #{$order->order_number}");
                } catch (\Exception $e) {
                    \Log::error("Failed to create service jobs for order #{$order->order_number}: " . $e->getMessage());
                    // Don't fail the status update if job creation fails
                }
            } else {
                \Log::warning("Order #{$order->order_number} has no items, skipping service job creation");
            }
        }

        // Ensure invoice exists for orders when they reach certain statuses
        // For credit invoice orders: only create invoice after delivery (RELEASED)
        // For other orders: create invoice when PAID, PENDING_PAYMENT, or RELEASED
        $order->load('customer', 'invoice');
        $isCreditInvoiceOrder = $order->order_type === 'invoice' && 
                               $order->customer && 
                               $order->customer->type === 'credit';
        
        // Create draft invoice when order is RELEASED (for review and approval)
        // For immediate payment orders (PAID, PENDING_PAYMENT), create issued invoice directly
        if ($newStatus === 'RELEASED' && !$order->invoice) {
            try {
                $this->invoiceService->createDraftFromOrder($order->fresh());
            } catch (\Exception $e) {
                // Log error but don't fail status update
                \Log::warning('Failed to create draft invoice for order during status update: ' . $e->getMessage());
            }
        } elseif (in_array($newStatus, ['PAID', 'PENDING_PAYMENT']) && !$order->invoice) {
            // For immediate payment orders, create issued invoice directly (no review needed)
            try {
                $this->invoiceService->createFromOrder($order->fresh(), null, 'issued');
            } catch (\Exception $e) {
                // Log error but don't fail status update
                \Log::warning('Failed to create invoice for order during status update: ' . $e->getMessage());
            }
        }

        // Log status change in order history
        \App\Models\OrderStatusHistory::create([
            'order_id' => $order->id,
            'from_status' => $oldStatus,
            'to_status' => $newStatus,
            'changed_by' => $user->id,
            'action' => $this->getActionForStatus($newStatus),
            'notes' => $reason,
        ]);

        // Send notifications based on status
        $this->sendStatusNotifications($order, $newStatus);
    }

    /**
     * Get action description for status
     */
    protected function getActionForStatus(string $status): string
    {
        $actions = [
            'DRAFT' => 'Order created',
            'PENDING_PAYMENT' => 'Pay later - awaiting payment',
            'PAID' => 'Payment received',
            'IN_PRODUCTION' => 'Sent to production',
            'READY' => 'Production complete - ready',
            'RELEASED' => 'Released to customer',
            'COMPLETED' => 'Order completed',
            'CANCELLED' => 'Order cancelled',
        ];
        return $actions[$status] ?? 'Status updated';
    }

    /**
     * Calculate order totals
     */
    public function calculateTotals(Order $order): void
    {
        $subtotal = $order->items->sum('line_total');
        $discount = $order->discount ?? 0;
        
        // Get tax rate from settings, default to 10%
        $taxRatePercentage = Setting::where('key', 'tax_rate')->value('value') ?? 10;
        $taxRate = $taxRatePercentage / 100;
        
        $afterDiscount = $subtotal - $discount;
        $tax = $afterDiscount * $taxRate;
        $total = $afterDiscount + $tax;
        $balance = $total - $order->paid_amount;

        $order->update([
            'subtotal' => $subtotal,
            'tax' => $tax,
            'total' => $total,
            'balance' => $balance,
        ]);
    }

    /**
     * Apply discount to order
     */
    public function applyDiscount(Order $order, float $discount, string $reason, User $user): void
    {
        // Check if discount requires approval
        $discountPercentage = ($discount / $order->subtotal) * 100;
        
        if ($discountPercentage > 15 && !$user->hasRole(['admin', 'manager'])) {
            throw new \Exception('Discount above 15% requires manager approval');
        }

        $order->update(['discount' => $discount]);
        $this->calculateTotals($order);

        // Log discount
        \App\Models\AuditLog::create([
            'user_id' => $user->id,
            'action' => 'update',
            'entity_type' => 'Order',
            'entity_id' => $order->id,
            'old_values' => ['discount' => 0],
            'new_values' => ['discount' => $discount, 'reason' => $reason],
            'ip_address' => request()->ip(),
        ]);
    }

    /**
     * Cancel order
     */
    public function cancel(Order $order, User $user, string $reason): void
    {
        if (!in_array($order->status, ['DRAFT', 'PENDING_PAYMENT', 'PAID'])) {
            throw new \Exception('Cannot cancel order in current status');
        }

        $order->update(['status' => 'CANCELLED']);

        // Cancel related service jobs
        foreach ($order->serviceJobs as $job) {
            $this->serviceJobService->cancel($job, $user, $reason);
        }

        // Log cancellation
        \App\Models\AuditLog::create([
            'user_id' => $user->id,
            'action' => 'cancel',
            'entity_type' => 'Order',
            'entity_id' => $order->id,
            'new_values' => ['reason' => $reason],
            'ip_address' => request()->ip(),
        ]);
    }

    /**
     * Record a payment for an order
     */
    public function recordPayment(
        Order $order,
        float $amount,
        string $paymentMethod,
        User $user,
        ?string $referenceNumber = null,
        $paymentDate = null
    ): Payment {
        return DB::transaction(function () use ($order, $amount, $paymentMethod, $user, $referenceNumber, $paymentDate) {
            // Create payment record
            // customer_id can be null for walk-in orders
            $payment = Payment::create([
                'order_id' => $order->id,
                'customer_id' => $order->customer_id, // Can be null for walk-in customers
                'amount' => $amount,
                'payment_method' => $paymentMethod,
                'reference_number' => $referenceNumber,
                'received_by' => $user->id,
                'payment_date' => $paymentDate ?? now(),
            ]);

            // Update order paid amount and balance
            $newPaidAmount = $order->paid_amount + $amount;
            $newBalance = $order->total - $newPaidAmount;

            $order->update([
                'paid_amount' => $newPaidAmount,
                'balance' => $newBalance,
            ]);

            // If order has an invoice, update invoice as well
            $invoice = $order->invoice;
            if ($invoice) {
                $invoiceNewPaidAmount = $invoice->paid_amount + $amount;
                $invoiceNewBalance = $invoice->total - $invoiceNewPaidAmount;
                
                $invoice->update([
                    'paid_amount' => $invoiceNewPaidAmount,
                    'balance' => $invoiceNewBalance,
                ]);

                // Update invoice status
                if ($invoiceNewBalance <= 0) {
                    $invoice->update(['status' => 'paid']);
                } elseif ($invoiceNewPaidAmount > 0) {
                    $invoice->update(['status' => 'partial']);
                }

                // Update customer credit balance when order payment is made on invoice order
                if ($order->customer_id) {
                    $customer = Customer::find($order->customer_id);
                    if ($customer && $customer->type === 'credit') {
                        $newCreditBalance = max(0, $customer->credit_balance - $amount);
                        $customer->update(['credit_balance' => $newCreditBalance]);
                    }
                }
            }

            // Update customer credit balance for credit customers even if no invoice
            // (for cases where payment is made before invoice is created)
            if ($order->customer_id) {
                $customer = $order->customer;
                if ($customer && $customer->type === 'credit' && !$invoice) {
                    // Only update if it's a credit order that will have an invoice later
                    // For now, we'll update when invoice is created or payment is made
                }
            }

            // Auto-update status based on payment (but don't auto-release from READY)
            $oldStatus = $order->status;
            $newStatus = $oldStatus;

            // If fully paid and was PENDING_PAYMENT, change to PAID
            if ($newBalance <= 0 && $oldStatus === 'PENDING_PAYMENT') {
                $newStatus = 'PAID';
            }
            // If payment received at DRAFT, move to PAID
            elseif ($oldStatus === 'DRAFT' && $newPaidAmount > 0) {
                $newStatus = 'PAID';
            }
            // If order is READY, keep it as READY even if fully paid
            // User must explicitly release the order
            // This allows for: pay later -> production -> ready -> payment -> release workflow

            if ($newStatus !== $oldStatus) {
                $this->updateStatus($order, $newStatus, $user, "Payment received: {$paymentMethod}");
            }

            return $payment;
        });
    }

    /**
     * Validate status transition
     */
    protected function validateStatusTransition(string $from, string $to, bool $isCreditInvoiceOrder = false): void
    {
        // Workflow for regular orders:
        // DRAFT -> PENDING_PAYMENT (pay later) or PAID (pay now)
        // PENDING_PAYMENT -> PAID (payment received) or IN_PRODUCTION
        // PAID -> IN_PRODUCTION (if production needed) or READY (if not) or RELEASED (walk-in ready-to-pick)
        // IN_PRODUCTION -> READY (production complete)
        // READY -> RELEASED (if fully paid) or PAID (if payment received)
        // RELEASED -> COMPLETED
        
        // Workflow for credit invoice orders:
        // DRAFT -> IN_PRODUCTION (skip payment, go directly to production)
        // IN_PRODUCTION -> READY (production complete)
        // READY -> RELEASED (deliver, then invoice is created)
        // RELEASED -> COMPLETED
        
        $validTransitions = [
            'DRAFT' => $isCreditInvoiceOrder 
                ? ['IN_PRODUCTION', 'CANCELLED'] // Credit invoice orders can go directly to production
                : ['PENDING_PAYMENT', 'PAID', 'CANCELLED'], // Regular orders need payment first
            'PENDING_PAYMENT' => ['PAID', 'IN_PRODUCTION', 'READY', 'CANCELLED'],
            'PAID' => ['IN_PRODUCTION', 'READY', 'RELEASED', 'CANCELLED'], // Can go directly to RELEASED for walk-in ready-to-pick
            'IN_PRODUCTION' => ['READY', 'CANCELLED'],
            'READY' => $isCreditInvoiceOrder
                ? ['RELEASED', 'CANCELLED'] // Credit invoice orders: only release (no payment needed)
                : ['RELEASED', 'PAID', 'CANCELLED'], // Regular orders: can receive payment or release
            'RELEASED' => ['COMPLETED'],
            'COMPLETED' => [],
            'CANCELLED' => [],
        ];

        if (!isset($validTransitions[$from]) || !in_array($to, $validTransitions[$from])) {
            throw new \Exception("Invalid status transition from {$from} to {$to}");
        }
    }

    /**
     * Approve a draft order that exceeds credit limit
     */
    public function approveOrder(Order $order, User $approver): void
    {
        DB::transaction(function () use ($order, $approver) {
            // Mark order as approved
            $order->update([
                'approved_by' => $approver->id,
                'status' => 'PENDING_PAYMENT', // Move to next status
            ]);
            
            // Don't create invoice yet for credit invoice orders
            // Invoice will be created only after delivery (RELEASED status)
            
            // Log approval
            \App\Models\OrderStatusHistory::create([
                'order_id' => $order->id,
                'from_status' => 'DRAFT',
                'to_status' => $order->status,
                'changed_by' => $approver->id,
                'action' => 'Order approved (credit limit override)',
                'notes' => "Approved by {$approver->name} - Credit limit exceeded",
            ]);
        });
    }
    
    /**
     * Reject a draft order
     */
    public function rejectOrder(Order $order, User $rejector, ?string $reason = null): void
    {
        $order->update([
            'status' => 'CANCELLED',
            'approved_by' => $rejector->id,
        ]);
        
        // Log rejection
        \App\Models\OrderStatusHistory::create([
            'order_id' => $order->id,
            'from_status' => 'DRAFT',
            'to_status' => 'CANCELLED',
            'changed_by' => $rejector->id,
            'action' => 'Order rejected',
            'notes' => $reason ? "Rejected: {$reason}" : "Rejected by {$rejector->name}",
        ]);
    }

    /**
     * Send notifications based on status
     */
    protected function sendStatusNotifications(Order $order, string $status): void
    {
        // Notify counter staff when order is ready
        if ($status === 'READY') {
            $counterStaff = User::whereHas('role', fn($q) => $q->where('name', 'counter_staff'))->get();
            
            foreach ($counterStaff as $staff) {
                \App\Models\Notification::create([
                    'user_id' => $staff->id,
                    'type' => 'order_update',
                    'title' => 'Order Ready for Delivery',
                    'message' => "Order #{$order->order_number} is ready for delivery",
                    'data' => ['order_id' => $order->id],
                ]);
            }
        }
    }
}
