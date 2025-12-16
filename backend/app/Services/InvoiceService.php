<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    /**
     * Create draft invoice from order (for review and approval)
     */
    public function createDraftFromOrder(Order $order, ?int $creditPeriodDays = null): Invoice
    {
        return $this->createFromOrder($order, $creditPeriodDays, 'draft');
    }

    /**
     * Create invoice from order (for any order - credit customer, regular customer, or walk-in)
     * @param string $status Invoice status ('draft' or 'issued')
     */
    public function createFromOrder(Order $order, ?int $creditPeriodDays = null, string $status = 'issued'): Invoice
    {
        return DB::transaction(function () use ($order, $creditPeriodDays, $status) {
            // Check if invoice already exists for this order
            $existingInvoice = Invoice::where('order_id', $order->id)->first();
            if ($existingInvoice) {
                // Throw exception to prevent duplicate invoice creation
                throw new \Exception('An invoice already exists for this order. Invoice #: ' . $existingInvoice->invoice_number);
            }

            $customer = $order->customer;
            
            // Determine due date
            $dueDate = now();
            if ($customer) {
                if ($customer->type === 'credit') {
                    // For credit customers, use their credit period
                    $periodDays = $creditPeriodDays ?? $customer->credit_period_days ?? 30;
                    $dueDate = now()->addDays($periodDays);
                } else {
                    // For regular customers, default to 30 days if not specified
                    $periodDays = $creditPeriodDays ?? 30;
                    $dueDate = now()->addDays($periodDays);
                }
            } else {
                // For walk-in orders without customer, use 30 days default or provided period
                $periodDays = $creditPeriodDays ?? 30;
                $dueDate = now()->addDays($periodDays);
            }

            // Ensure we have fresh order data with calculated totals
            $order = $order->fresh(['items', 'serviceJobs']);
            
            // Calculate totals based only on items with completed (not cancelled) jobs
            // CANCELLED jobs mean the item won't be delivered, so exclude from invoice
            $orderService = app(\App\Services\OrderService::class);
            
            // Get order items that should be included in invoice (items with completed jobs, or no job requirement)
            $order->load('serviceJobs');
            $cancelledJobItemIds = $order->serviceJobs()
                ->where('status', 'CANCELLED')
                ->pluck('order_item_id')
                ->filter()
                ->toArray();
            
            // If there are cancelled jobs, recalculate totals excluding those items
            if (!empty($cancelledJobItemIds)) {
                // Calculate subtotal from items excluding cancelled job items
                $includedItems = $order->items()->whereNotIn('id', $cancelledJobItemIds)->get();
                $subtotal = $includedItems->sum('line_total');
                $discount = $order->discount ?? 0;
                $tax = ($subtotal - $discount) * 0.1; // 10% tax
                $total = $subtotal - $discount + $tax;
                
                // Use calculated totals for invoice
                $invoiceSubtotal = $subtotal;
                $invoiceTax = $tax;
                $invoiceTotal = $total;
            } else {
                // No cancelled jobs, use order totals as normal
                $orderService->calculateTotals($order);
                $order = $order->fresh();
                $invoiceSubtotal = $order->subtotal ?? 0;
                $invoiceTax = $order->tax ?? 0;
                $invoiceTotal = $order->total ?? 0;
            }

            // Create invoice with calculated totals (excluding cancelled job items)
            $invoice = Invoice::create([
                'outlet_id' => $order->outlet_id,
                'order_id' => $order->id,
                'customer_id' => $customer?->id, // Can be null for walk-in orders
                'status' => $status, // 'draft' or 'issued'
                'subtotal' => $invoiceSubtotal,
                'discount' => $order->discount ?? 0,
                'tax' => $invoiceTax,
                'total' => $invoiceTotal,
                'paid_amount' => 0, // Invoice starts with no payment
                'balance' => $invoiceTotal,
                'issue_date' => $status === 'issued' ? now() : null, // Only set issue_date when issued
                'due_date' => $dueDate,
            ]);

            // Only update customer credit balance for credit customers when invoice is issued (not draft)
            // Use invoice total (which excludes cancelled items) not order total
            if ($status === 'issued' && $customer && $customer->type === 'credit') {
                $customer->increment('credit_balance', $invoiceTotal);
            }

            return $invoice;
        });
    }

    /**
     * Record payment against invoice
     */
    public function recordPayment(Invoice $invoice, float $amount, string $paymentMethod, $user, ?string $referenceNumber = null): void
    {
        DB::transaction(function () use ($invoice, $amount, $paymentMethod, $user, $referenceNumber) {
            // Create payment record
            $payment = \App\Models\Payment::create([
                'invoice_id' => $invoice->id,
                'order_id' => $invoice->order_id,
                'customer_id' => $invoice->customer_id,
                'amount' => $amount,
                'payment_method' => $paymentMethod,
                'reference_number' => $referenceNumber,
                'received_by' => $user->id,
                'payment_date' => now(),
            ]);

            // Update invoice
            $newPaidAmount = $invoice->paid_amount + $amount;
            $newBalance = $invoice->total - $newPaidAmount;

            $invoice->update([
                'paid_amount' => $newPaidAmount,
                'balance' => $newBalance,
            ]);

            // Update invoice status
            if ($newBalance <= 0) {
                $invoice->update(['status' => 'paid']);
            } elseif ($newPaidAmount > 0) {
                $invoice->update(['status' => 'partial']);
            }

            // Update customer credit balance (reduce it)
            // When invoice payment is made, reduce the customer's credit balance
            if ($invoice->customer_id) {
                $customer = Customer::find($invoice->customer_id);
                if ($customer) {
                    // Decrement credit balance, ensuring it doesn't go below 0
                    $newCreditBalance = max(0, $customer->credit_balance - $amount);
                    $customer->update(['credit_balance' => $newCreditBalance]);
                }
            }

            // Also update order if exists
            if ($invoice->order_id) {
                // Use fresh() to ensure we get the latest order data
                $order = Order::find($invoice->order_id);
                if ($order) {
                    $newOrderPaidAmount = $order->paid_amount + $amount;
                    $newOrderBalance = $order->total - $newOrderPaidAmount;
                    
                    $order->update([
                        'paid_amount' => $newOrderPaidAmount,
                        'balance' => $newOrderBalance,
                    ]);
                }
            }
        });
    }

    /**
     * Update draft invoice (subtotal, discount, tax, total, or item-level overrides)
     */
    public function updateDraft(Invoice $invoice, array $data): Invoice
    {
        if ($invoice->status !== 'draft') {
            throw new \Exception('Only draft invoices can be updated.');
        }

        // If item_overrides are provided, calculate totals from items
        if (isset($data['item_overrides']) && is_array($data['item_overrides'])) {
            $invoice->load('order.items');
            $itemOverrides = $data['item_overrides'];
            $subtotal = 0;
            
            // Calculate subtotal from items with overrides
            foreach ($invoice->order->items as $item) {
                $itemId = $item->id;
                if (isset($itemOverrides[$itemId])) {
                    $override = $itemOverrides[$itemId];
                    $unitPrice = $override['unit_price'] ?? $item->unit_price;
                    $quantity = $item->quantity;
                    $lineSubtotal = $unitPrice * $quantity;
                    
                    // Apply discount (either percentage or fixed amount)
                    if (isset($override['discount_type']) && isset($override['discount_value'])) {
                        if ($override['discount_type'] === 'percentage') {
                            $discountAmount = $lineSubtotal * ($override['discount_value'] / 100);
                        } else {
                            $discountAmount = $override['discount_value'];
                        }
                        $lineSubtotal -= $discountAmount;
                    }
                    
                    $subtotal += $lineSubtotal;
                } else {
                    // Use original item price if no override
                    $subtotal += $item->line_total;
                }
            }
            
            $orderDiscount = $data['discount'] ?? $invoice->discount ?? 0;
            $tax = (($subtotal - $orderDiscount) * 0.1); // 10% tax
            $total = $subtotal - $orderDiscount + $tax;
            
            $invoice->update([
                'item_overrides' => $itemOverrides,
                'subtotal' => $subtotal,
                'discount' => $orderDiscount,
                'tax' => $tax,
                'total' => $total,
                'balance' => $total - ($invoice->paid_amount ?? 0),
            ]);
        } else {
            // Legacy: update totals directly
            $subtotal = $data['subtotal'] ?? $invoice->subtotal;
            $discount = $data['discount'] ?? $invoice->discount ?? 0;
            $tax = $data['tax'] ?? (($subtotal - $discount) * 0.1); // 10% tax
            $total = $subtotal - $discount + $tax;

            $invoice->update([
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'total' => $total,
                'balance' => $total - ($invoice->paid_amount ?? 0),
            ]);
        }

        return $invoice->fresh();
    }

    /**
     * Approve draft invoice (change status to issued)
     */
    public function approveDraft(Invoice $invoice): Invoice
    {
        if ($invoice->status !== 'draft') {
            throw new \Exception('Only draft invoices can be approved.');
        }

        return DB::transaction(function () use ($invoice) {
            // Update invoice status to issued
            $invoice->update([
                'status' => 'issued',
                'issue_date' => now(),
            ]);

            // Update customer credit balance for credit customers
            if ($invoice->customer_id) {
                $customer = \App\Models\Customer::find($invoice->customer_id);
                if ($customer && $customer->type === 'credit') {
                    $customer->increment('credit_balance', $invoice->total);
                }
            }

            return $invoice->fresh();
        });
    }

    /**
     * Check if invoice is overdue
     */
    public function checkOverdueInvoices(): void
    {
        $overdueInvoices = Invoice::where('status', '!=', 'paid')
            ->where('due_date', '<', now())
            ->get();

        foreach ($overdueInvoices as $invoice) {
            $invoice->update(['status' => 'overdue']);
        }
    }
}

