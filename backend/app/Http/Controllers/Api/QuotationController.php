<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quotation;
use App\Services\QuotationService;
use Illuminate\Http\Request;

class QuotationController extends Controller
{
    protected QuotationService $quotationService;

    public function __construct(QuotationService $quotationService)
    {
        $this->quotationService = $quotationService;
    }

    /**
     * Get all quotations
     */
    public function index(Request $request)
    {
        $outletId = $this->getOutletId($request);
        
        // Auto-expire quotations before fetching
        $this->quotationService->expireQuotations();
        
        $query = Quotation::with(['customer', 'items.product', 'outlet']);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        $quotations = $query->orderBy('created_at', 'desc')->paginate(50);

        return response()->json($quotations);
    }

    /**
     * Get a specific quotation
     */
    public function show($id)
    {
        $quotation = Quotation::with([
            'customer',
            'items.product',
            'creator',
            'approver',
            'convertedOrder',
            'outlet'
        ])->findOrFail($id);

        // Check and expire if needed
        if ($quotation->valid_until && $quotation->valid_until->isPast() && $quotation->status !== 'expired' && $quotation->status !== 'converted') {
            $quotation->update(['status' => 'expired']);
            $quotation->refresh();
        }

        return response()->json($quotation);
    }

    /**
     * Create a new quotation
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'outlet_id' => 'nullable|exists:outlets,id',
            'valid_until' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.width' => 'nullable|numeric',
            'items.*.height' => 'nullable|numeric',
            'items.*.description' => 'nullable|string',
        ]);

        // If outlet_id not provided, get from header
        if (!isset($validated['outlet_id'])) {
            $outletId = $this->getOutletId($request);
            if ($outletId) {
                $validated['outlet_id'] = $outletId;
            }
        }

        try {
            $quotation = $this->quotationService->create($validated, $request->user());

            return response()->json($quotation, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Get outlet ID from request header or query parameter
     */
    private function getOutletId(Request $request): ?int
    {
        $outletId = $request->header('X-Outlet-ID') ?? $request->query('outlet_id');
        return $outletId ? (int) $outletId : null;
    }

    /**
     * Update quotation
     */
    public function update(Request $request, $id)
    {
        $quotation = Quotation::findOrFail($id);

        // Only allow editing if quotation is in draft or sent status
        if (!in_array($quotation->status, ['draft', 'sent'])) {
            return response()->json([
                'error' => 'Quotation cannot be edited. Only draft and sent quotations can be modified.'
            ], 400);
        }

        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'notes' => 'nullable|string',
            'valid_until' => 'nullable|date',
            'discount' => 'nullable|numeric|min:0',
        ]);

        $quotation->update($validated);
        $this->quotationService->calculateTotals($quotation->fresh());

        return response()->json($quotation->fresh(['items', 'customer']));
    }

    /**
     * Add item to quotation
     */
    public function addItem(Request $request, $id)
    {
        $quotation = Quotation::findOrFail($id);

        // Only allow editing if quotation is in draft or sent status
        if (!in_array($quotation->status, ['draft', 'sent'])) {
            return response()->json([
                'error' => 'Items cannot be added. Only draft and sent quotations can be modified.'
            ], 400);
        }

        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'width' => 'nullable|numeric',
            'height' => 'nullable|numeric',
            'description' => 'nullable|string',
        ]);

        try {
            $item = $this->quotationService->addItem($quotation, $validated);

            return response()->json([
                'item' => $item,
                'quotation' => $quotation->fresh(['items', 'customer'])
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Update quotation item
     */
    public function updateItem(Request $request, $id, $itemId)
    {
        $quotation = Quotation::findOrFail($id);
        $item = \App\Models\QuotationItem::where('quotation_id', $id)->findOrFail($itemId);

        $validated = $request->validate([
            'product_id' => 'sometimes|exists:products,id',
            'quantity' => 'sometimes|integer|min:1',
            'width' => 'nullable|numeric',
            'height' => 'nullable|numeric',
            'description' => 'nullable|string',
        ]);

        try {
            $item = $this->quotationService->updateItem($quotation, $item, $validated);

            return response()->json([
                'item' => $item,
                'quotation' => $quotation->fresh(['items', 'customer'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Remove item from quotation
     */
    public function removeItem(Request $request, $id, $itemId)
    {
        $quotation = Quotation::findOrFail($id);
        $item = \App\Models\QuotationItem::where('quotation_id', $id)->findOrFail($itemId);

        try {
            $this->quotationService->removeItem($quotation, $item);

            return response()->json([
                'message' => 'Item removed successfully',
                'quotation' => $quotation->fresh(['items', 'customer'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Update quotation status
     */
    public function updateStatus(Request $request, $id)
    {
        $quotation = Quotation::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:draft,sent,approved,expired,converted',
        ]);

        $user = $request->user()->load('role');

        // Only managers and admins can approve quotations
        if ($validated['status'] === 'approved' && !$user->hasRole(['admin', 'manager'])) {
            return response()->json([
                'error' => 'Only managers and admins can approve quotations'
            ], 403);
        }

        try {
            $approver = $validated['status'] === 'approved' ? $user : null;
            $this->quotationService->updateStatus(
                $quotation,
                $validated['status'],
                $approver
            );

            return response()->json([
                'message' => 'Quotation status updated',
                'quotation' => $quotation->fresh(['approver', 'customer'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Convert quotation to order
     */
    public function convertToOrder(Request $request, $id)
    {
        $quotation = Quotation::with('customer')->findOrFail($id);

        // Check and expire if needed
        if ($quotation->valid_until && $quotation->valid_until->isPast() && $quotation->status !== 'expired') {
            $quotation->update(['status' => 'expired']);
            $quotation->refresh();
        }

        if ($quotation->status === 'converted') {
            return response()->json([
                'error' => 'Quotation has already been converted to an order'
            ], 400);
        }

        if ($quotation->status === 'expired') {
            return response()->json([
                'error' => 'Quotation has expired and cannot be converted to order'
            ], 400);
        }

        if ($quotation->status !== 'approved') {
            return response()->json([
                'error' => 'Quotation must be approved before converting to order'
            ], 400);
        }

        $validated = $request->validate([
            'payment_terms' => 'nullable|in:immediate,credit_30,credit_60',
            'order_type' => 'nullable|in:quotation,walk_in,invoice',
        ]);

        try {
            // Order type is automatically determined based on customer type:
            // - Credit customer -> invoice order (credit procedure)
            // - Cash/regular customer -> walk_in order (pay procedure)
            $order = $this->quotationService->convertToOrder(
                $quotation,
                $request->user(),
                $validated
            );

            $customer = $quotation->customer;
            $orderTypeMessage = $customer && $customer->type === 'credit' 
                ? 'Credit customer - Invoice order created (invoice will be generated after delivery)'
                : 'Cash customer - Order created with payment';

            return response()->json([
                'message' => 'Quotation converted to order successfully',
                'order_type_message' => $orderTypeMessage,
                'order' => $order->load(['items', 'customer']),
                'quotation' => $quotation->fresh()
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
