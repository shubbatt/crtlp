<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\OrderService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    protected OrderService $orderService;

    public function __construct(OrderService $orderService)
    {
        $this->orderService = $orderService;
    }

    /**
     * Record a payment for an order
     */
    public function store(Request $request, $orderId)
    {
        $order = Order::findOrFail($orderId);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:cash,card,bank_transfer,credit',
            'reference_number' => 'nullable|string|max:255',
            'payment_date' => 'nullable|date',
        ]);

        // For cash payments, allow overpayment (customer pays more than balance - change is given)
        // For other payment methods, payment cannot exceed balance
        if ($validated['payment_method'] !== 'cash' && $validated['amount'] > $order->balance) {
            return response()->json([
                'error' => 'Payment amount cannot exceed order balance'
            ], 400);
        }

        try {
            $payment = $this->orderService->recordPayment(
                $order,
                $validated['amount'],
                $validated['payment_method'],
                $request->user(),
                $validated['reference_number'] ?? null,
                $validated['payment_date'] ?? now()
            );

            return response()->json([
                'message' => 'Payment recorded successfully',
                'payment' => $payment,
                'order' => $order->fresh(['payments', 'invoice', 'customer'])
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Get all payments for an order
     */
    public function index($orderId)
    {
        $order = Order::findOrFail($orderId);
        $payments = Payment::where('order_id', $orderId)
            ->with('receiver')
            ->orderBy('payment_date', 'desc')
            ->get();

        return response()->json($payments);
    }
}
