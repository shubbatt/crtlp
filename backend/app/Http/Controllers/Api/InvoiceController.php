<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Services\InvoiceService;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    protected InvoiceService $invoiceService;

    public function __construct(InvoiceService $invoiceService)
    {
        $this->invoiceService = $invoiceService;
    }

    /**
     * Filter order items to exclude those with only cancelled jobs
     */
    protected function filterInvoiceItems($invoice)
    {
        if (!$invoice->order || !$invoice->order->items) {
            return;
        }

        // Ensure service jobs are loaded
        $invoice->order->load('serviceJobs');
        
        // Filter items: exclude items that have ONLY cancelled jobs
        // Items without service jobs should be included
        // Items with at least one non-cancelled job should be included
        $filteredItems = $invoice->order->items->filter(function ($item) use ($invoice) {
            // Get all service jobs for this item
            $itemJobs = $invoice->order->serviceJobs->where('order_item_id', $item->id);
            
            // If item has no service jobs, include it
            if ($itemJobs->isEmpty()) {
                return true;
            }
            
            // If item has jobs, check if ALL are cancelled
            $allCancelled = $itemJobs->every(function ($job) {
                return $job->status === 'CANCELLED';
            });
            
            // Include if not all jobs are cancelled
            return !$allCancelled;
        })->values();
        
        // Replace the items collection with filtered items
        $invoice->order->setRelation('items', $filteredItems);
    }

    /**
     * Get all invoices
     */
    public function index(Request $request)
    {
        $query = Invoice::with(['customer', 'order', 'outlet']);

        // Filter by outlet_id (from header or query param)
        $outletId = $request->header('X-Outlet-ID') ?? $request->query('outlet_id');
        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        if ($request->has('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('overdue')) {
            $query->where('due_date', '<', now())
                  ->where('status', '!=', 'paid');
        }

        $invoices = $query->orderBy('created_at', 'desc')->paginate(50);

        return response()->json($invoices);
    }

    /**
     * Get a specific invoice
     */
    public function show($id)
    {
        $invoice = Invoice::with([
            'customer',
            'order.items.product',
            'order.serviceJobs',
            'payments.receiver',
            'outlet'
        ])->findOrFail($id);

        // Filter out order items that have cancelled service jobs
        $this->filterInvoiceItems($invoice);

        return response()->json($invoice);
    }

    /**
     * Create invoice from order
     */
    public function createFromOrder(Request $request, $orderId)
    {
        $order = Order::findOrFail($orderId);

        // Check if invoice already exists for this order
        $existingInvoice = Invoice::where('order_id', $order->id)->first();
        if ($existingInvoice) {
            return response()->json([
                'error' => 'duplicate',
                'message' => 'An invoice already exists for this order.',
                'invoice' => $existingInvoice->load(['customer', 'order'])
            ], 409); // 409 Conflict
        }

        $validated = $request->validate([
            'credit_period_days' => 'nullable|integer|min:1|max:365',
        ]);

        try {
            $invoice = $this->invoiceService->createFromOrder(
                $order,
                $validated['credit_period_days'] ?? null
            );

            return response()->json([
                'message' => 'Invoice created successfully',
                'invoice' => $invoice->load(['customer', 'order'])
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Record payment against invoice
     */
    public function recordPayment(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:cash,card,bank_transfer,credit',
            'reference_number' => 'nullable|string|max:255',
        ]);

        if ($validated['amount'] > $invoice->balance) {
            return response()->json([
                'error' => 'Payment amount cannot exceed invoice balance'
            ], 400);
        }

        try {
            $this->invoiceService->recordPayment(
                $invoice,
                $validated['amount'],
                $validated['payment_method'],
                $request->user(),
                $validated['reference_number'] ?? null
            );

            // Refresh invoice with all relationships
            $invoice = $invoice->fresh(['payments', 'customer', 'order']);
            
            return response()->json([
                'message' => 'Payment recorded successfully',
                'invoice' => $invoice,
                'order' => $invoice->order, // Include updated order
                'customer' => $invoice->customer // Include updated customer with refreshed credit balance
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Update invoice (e.g., purchase order number)
     */
    public function update(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);

        $validated = $request->validate([
            'purchase_order_number' => 'nullable|string|max:255',
        ]);

        $invoice->update($validated);

        return response()->json([
            'message' => 'Invoice updated successfully',
            'invoice' => $invoice->fresh(['customer', 'order', 'payments'])
        ]);
    }

    /**
     * Update draft invoice
     */
    public function updateDraft(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);

        if ($invoice->status !== 'draft') {
            return response()->json([
                'error' => 'Only draft invoices can be updated.'
            ], 400);
        }

        $validated = $request->validate([
            'subtotal' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'item_overrides' => 'nullable|array',
            'item_overrides.*.unit_price' => 'required_with:item_overrides|numeric|min:0',
            'item_overrides.*.discount_type' => 'nullable|in:percentage,fixed',
            'item_overrides.*.discount_value' => 'nullable|numeric|min:0',
        ]);

        try {
            $invoice = $this->invoiceService->updateDraft($invoice, $validated);
            // Reload with all relationships
            $invoice = $invoice->load(['customer', 'order.items.product', 'order.serviceJobs', 'outlet']);
            // Apply filtering logic
            $this->filterInvoiceItems($invoice);
            return response()->json($invoice, 200);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Approve draft invoice
     */
    public function approveDraft($id)
    {
        $invoice = Invoice::findOrFail($id);

        if ($invoice->status !== 'draft') {
            return response()->json([
                'error' => 'Only draft invoices can be approved.'
            ], 400);
        }

        try {
            $invoice = $this->invoiceService->approveDraft($invoice);
            // Reload with all relationships
            $invoice = $invoice->load(['customer', 'order.items.product', 'order.serviceJobs', 'outlet']);
            // Apply filtering logic
            $this->filterInvoiceItems($invoice);
            return response()->json($invoice, 200);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }
}
