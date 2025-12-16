<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\Order;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ApprovalService
{
    /**
     * Create a discount approval request
     */
    public function requestDiscountApproval(Order $order, float $discount, string $reason, User $requestedBy): ApprovalRequest
    {
        return ApprovalRequest::create([
            'type' => 'discount',
            'status' => 'pending',
            'order_id' => $order->id,
            'customer_id' => $order->customer_id,
            'requested_by' => $requestedBy->id,
            'request_data' => [
                'discount' => $discount,
                'discount_percentage' => ($discount / $order->subtotal) * 100,
                'order_total' => $order->total,
                'order_subtotal' => $order->subtotal,
                'reason' => $reason,
            ],
        ]);
    }

    /**
     * Create a credit override approval request
     */
    public function requestCreditOverride(Customer $customer, float $orderTotal, string $reason, User $requestedBy): ApprovalRequest
    {
        return ApprovalRequest::create([
            'type' => 'credit_override',
            'status' => 'pending',
            'customer_id' => $customer->id,
            'requested_by' => $requestedBy->id,
            'request_data' => [
                'order_total' => $orderTotal,
                'current_credit_balance' => $customer->credit_balance,
                'credit_limit' => $customer->credit_limit,
                'available_credit' => $customer->credit_limit - $customer->credit_balance,
                'would_exceed_by' => ($customer->credit_balance + $orderTotal) - $customer->credit_limit,
                'reason' => $reason,
            ],
        ]);
    }

    /**
     * Approve a request
     */
    public function approve(ApprovalRequest $request, User $approver, ?string $notes = null): void
    {
        DB::transaction(function () use ($request, $approver, $notes) {
            $request->update([
                'status' => 'approved',
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'approver_notes' => $notes,
            ]);

            // Process the approval based on type
            if ($request->type === 'discount' && $request->order_id) {
                $order = Order::find($request->order_id);
                if ($order) {
                    $discount = $request->request_data['discount'];
                    $order->update(['discount' => $discount]);
                    // Recalculate totals
                    app(OrderService::class)->calculateTotals($order);
                }
            }
            // Credit override doesn't need processing - it just allows the order to proceed
        });
    }

    /**
     * Reject a request
     */
    public function reject(ApprovalRequest $request, User $rejector, string $reason): void
    {
        $request->update([
            'status' => 'rejected',
            'approved_by' => $rejector->id,
            'approved_at' => now(),
            'approver_notes' => $reason,
        ]);
    }
}

