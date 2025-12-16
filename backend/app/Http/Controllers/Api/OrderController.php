<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    protected OrderService $orderService;

    public function __construct(OrderService $orderService)
    {
        $this->orderService = $orderService;
    }

    /**
     * Get all orders
     */
    public function index(Request $request)
    {
        $query = Order::with(['customer', 'items.product', 'creator', 'serviceJobs', 'invoice', 'outlet']);

        // Filter by outlet_id (from header or query param)
        $outletId = $request->header('X-Outlet-ID') ?? $request->query('outlet_id');
        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by customer
        if ($request->has('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        // Filter by date range
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $orders = $query->orderBy('created_at', 'desc')->paginate(20);

        // Add job status summary to each order
        $orders->getCollection()->transform(function ($order) {
            $order->job_status_summary = $this->getJobStatusSummary($order);
            return $order;
        });

        return response()->json($orders);
    }

    /**
     * Get job status summary for an order
     */
    protected function getJobStatusSummary(Order $order): array
    {
        $jobs = $order->serviceJobs;
        
        if ($jobs->isEmpty()) {
            return [
                'total_jobs' => 0,
                'completed_jobs' => 0,
                'in_progress_jobs' => 0,
                'pending_jobs' => 0,
                'all_completed' => false,
                'status_breakdown' => [],
            ];
        }

        $statusCounts = $jobs->groupBy('status')->map->count();
        
        return [
            'total_jobs' => $jobs->count(),
            'completed_jobs' => $statusCounts->get('COMPLETED', 0),
            'in_progress_jobs' => $statusCounts->get('IN_PROGRESS', 0) + $statusCounts->get('QA_REVIEW', 0) + $statusCounts->get('ACCEPTED', 0),
            'pending_jobs' => $statusCounts->get('PENDING', 0),
            'all_completed' => $jobs->every(fn($job) => $job->status === 'COMPLETED'),
            'status_breakdown' => $statusCounts->toArray(),
        ];
    }

    /**
     * Create a new order
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'order_type' => 'required|in:walk_in,quotation,invoice',
            'payment_terms' => 'required|in:immediate,credit_30,credit_60',
            'notes' => 'nullable|string',
            'outlet_id' => 'nullable|exists:outlets,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.width' => 'nullable|numeric',
            'items.*.height' => 'nullable|numeric',
            'items.*.description' => 'nullable|string',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.override_reason' => 'nullable|string|max:500',
        ]);

        // Get outlet_id from header if not in body
        if (!isset($validated['outlet_id'])) {
            $validated['outlet_id'] = $request->header('X-Outlet-ID');
        }

        try {
            $order = $this->orderService->create($validated, $request->user());

            return response()->json($order, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Get a specific order
     */
    public function show($id)
    {
        $order = Order::with([
            'customer',
            'items.product',
            'serviceJobs.orderItem.product',
            'serviceJobs.assignedUser',
            'serviceJobs.statusHistory',
            'statusHistory.user',
            'payments',
            'invoice', // Include invoice relationship
            'creator',
            'approver',
            'outlet'
        ])->findOrFail($id);

        // Add job status summary
        $order->job_status_summary = $this->getJobStatusSummary($order);

        return response()->json($order);
    }

    /**
     * Update an order
     */
    public function update(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        // Only allow updates for DRAFT orders
        if ($order->status !== 'DRAFT') {
            return response()->json(['error' => 'Can only update draft orders'], 400);
        }

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'payment_terms' => 'nullable|in:immediate,credit_30,credit_60',
        ]);

        $order->update($validated);

        return response()->json($order);
    }

    /**
     * Add item to order
     */
    public function addItem(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        if ($order->status !== 'DRAFT') {
            return response()->json(['error' => 'Can only add items to draft orders'], 400);
        }

        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'width' => 'nullable|numeric',
            'height' => 'nullable|numeric',
            'description' => 'nullable|string',
        ]);

        try {
            $item = $this->orderService->addItem($order, $validated);

            return response()->json([
                'item' => $item,
                'order' => $order->fresh(['items'])
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Approve draft order that exceeds credit limit
     */
    public function approve(Request $request, $id)
    {
        $order = Order::with(['customer', 'items'])->findOrFail($id);
        
        // Check if order is in DRAFT status
        if ($order->status !== 'DRAFT') {
            return response()->json([
                'error' => 'Only DRAFT orders can be approved'
            ], 400);
        }
        
        // Check if order has customer and is credit customer
        if (!$order->customer || $order->customer->type !== 'credit') {
            return response()->json([
                'error' => 'Only credit customer orders can be approved for credit override'
            ], 400);
        }
        
        try {
            $this->orderService->approveOrder($order, $request->user());
            
            return response()->json([
                'message' => 'Order approved successfully',
                'order' => $order->fresh(['customer', 'items', 'invoice'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
    
    /**
     * Reject draft order
     */
    public function reject(Request $request, $id)
    {
        $order = Order::findOrFail($id);
        
        if ($order->status !== 'DRAFT') {
            return response()->json([
                'error' => 'Only DRAFT orders can be rejected'
            ], 400);
        }
        
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);
        
        try {
            $this->orderService->rejectOrder($order, $request->user(), $validated['reason'] ?? null);
            
            return response()->json([
                'message' => 'Order rejected',
                'order' => $order->fresh(['customer'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Update order status
     */
    public function updateStatus(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string',
            'reason' => 'nullable|string',
        ]);

        try {
            $this->orderService->updateStatus(
                $order,
                $validated['status'],
                $request->user(),
                $validated['reason'] ?? null
            );

            return response()->json([
                'message' => 'Order status updated successfully',
                'order' => $order->fresh()
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Apply discount to order
     */
    public function applyDiscount(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        $validated = $request->validate([
            'discount' => 'required|numeric|min:0',
            'reason' => 'required|string',
        ]);

        try {
            $this->orderService->applyDiscount(
                $order,
                $validated['discount'],
                $validated['reason'],
                $request->user()
            );

            return response()->json([
                'message' => 'Discount applied successfully',
                'order' => $order->fresh()
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        }
    }

    /**
     * Cancel order
     */
    public function cancel(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        $validated = $request->validate([
            'reason' => 'required|string',
        ]);

        try {
            $this->orderService->cancel($order, $request->user(), $validated['reason']);

            return response()->json([
                'message' => 'Order cancelled successfully',
                'order' => $order->fresh()
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
