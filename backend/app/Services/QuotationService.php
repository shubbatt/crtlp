<?php

namespace App\Services;

use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Support\Facades\DB;

class QuotationService
{
    protected PricingEngine $pricingEngine;
    protected OrderService $orderService;

    public function __construct(PricingEngine $pricingEngine, OrderService $orderService)
    {
        $this->pricingEngine = $pricingEngine;
        $this->orderService = $orderService;
    }

    /**
     * Create a new quotation
     */
    public function create(array $data, User $user): Quotation
    {
        return DB::transaction(function () use ($data, $user) {
            $quotation = Quotation::create([
                'customer_id' => $data['customer_id'] ?? null,
                'outlet_id' => $data['outlet_id'] ?? null,
                'status' => 'draft', // Quotation is created (needs approval before converting)
                'valid_until' => isset($data['valid_until']) 
                    ? \Carbon\Carbon::parse($data['valid_until']) 
                    : now()->addDays(30),
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            // Add items if provided
            if (isset($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $itemData) {
                    $this->addItem($quotation, $itemData);
                }
            }

            // Recalculate totals
            $this->calculateTotals($quotation);

            return $quotation->fresh(['items', 'customer']);
        });
    }

    /**
     * Add item to quotation
     */
    public function addItem(Quotation $quotation, array $itemData): QuotationItem
    {
        $product = \App\Models\Product::findOrFail($itemData['product_id']);

        // Calculate pricing
        $pricing = $this->pricingEngine->calculate($product, [
            'quantity' => $itemData['quantity'] ?? 1,
            'width' => $itemData['width'] ?? null,
            'height' => $itemData['height'] ?? null,
            'customer_id' => $quotation->customer_id,
        ]);

        // Create quotation item
        $quotationItem = $quotation->items()->create([
            'product_id' => $product->id,
            'description' => $itemData['description'] ?? $product->name,
            'quantity' => $itemData['quantity'] ?? 1,
            'dimensions' => isset($itemData['width'], $itemData['height']) ? [
                'width' => $itemData['width'],
                'height' => $itemData['height'],
                'unit' => $itemData['unit'] ?? 'ft'
            ] : null,
            'unit_price' => $pricing['unit_price'],
            'line_total' => $pricing['line_total'],
        ]);

        // Recalculate quotation totals
        $this->calculateTotals($quotation);

        return $quotationItem;
    }

    /**
     * Update quotation item
     */
    public function updateItem(Quotation $quotation, QuotationItem $item, array $itemData): QuotationItem
    {
        // Only allow editing if quotation is in draft or sent status
        if (!in_array($quotation->status, ['draft', 'sent'])) {
            throw new \Exception('Quotation items cannot be edited. Only draft and sent quotations can be modified.');
        }

        $product = \App\Models\Product::findOrFail($itemData['product_id'] ?? $item->product_id);

        // Calculate pricing
        $pricing = $this->pricingEngine->calculate($product, [
            'quantity' => $itemData['quantity'] ?? $item->quantity,
            'width' => $itemData['width'] ?? ($item->dimensions['width'] ?? null),
            'height' => $itemData['height'] ?? ($item->dimensions['height'] ?? null),
            'customer_id' => $quotation->customer_id,
        ]);

        // Update quotation item
        $item->update([
            'product_id' => $product->id,
            'description' => $itemData['description'] ?? $item->description ?? $product->name,
            'quantity' => $itemData['quantity'] ?? $item->quantity,
            'dimensions' => isset($itemData['width'], $itemData['height']) ? [
                'width' => $itemData['width'],
                'height' => $itemData['height'],
                'unit' => $itemData['unit'] ?? 'ft'
            ] : $item->dimensions,
            'unit_price' => $pricing['unit_price'],
            'line_total' => $pricing['line_total'],
        ]);

        // Recalculate quotation totals
        $this->calculateTotals($quotation);

        return $item->fresh();
    }

    /**
     * Remove item from quotation
     */
    public function removeItem(Quotation $quotation, QuotationItem $item): void
    {
        // Only allow editing if quotation is in draft or sent status
        if (!in_array($quotation->status, ['draft', 'sent'])) {
            throw new \Exception('Quotation items cannot be removed. Only draft and sent quotations can be modified.');
        }

        $item->delete();

        // Recalculate quotation totals
        $this->calculateTotals($quotation);
    }

    /**
     * Calculate quotation totals
     */
    public function calculateTotals(Quotation $quotation): void
    {
        $quotation->load('items');
        
        $subtotal = $quotation->items->sum('line_total');
        $discount = $quotation->discount ?? 0;
        $taxRate = (Setting::where('key', 'tax_rate')->value('value') ?? 10) / 100;
        $tax = ($subtotal - $discount) * $taxRate;
        $total = $subtotal - $discount + $tax;

        $quotation->update([
            'subtotal' => $subtotal,
            'tax' => $tax,
            'total' => $total,
        ]);
    }

    /**
     * Check and expire quotations that have passed their valid_until date
     */
    public function expireQuotations(): int
    {
        $expiredCount = Quotation::where('status', '!=', 'expired')
            ->where('status', '!=', 'converted')
            ->where('valid_until', '<', now())
            ->update(['status' => 'expired']);
        
        return $expiredCount;
    }

    /**
     * Convert quotation to order
     */
    public function convertToOrder(Quotation $quotation, User $user, array $orderData = []): Order
    {
        return DB::transaction(function () use ($quotation, $user, $orderData) {
            // Check if quotation is approved
            if ($quotation->status !== 'approved') {
                throw new \Exception('Quotation must be approved before converting to order');
            }

            // Check if quotation has expired
            if ($quotation->valid_until && $quotation->valid_until->isPast()) {
                $quotation->update(['status' => 'expired']);
                throw new \Exception('Quotation has expired and cannot be converted to order');
            }

            // Determine order type based on customer type
            // Credit customer -> invoice order (follow credit procedure)
            // Cash/regular customer -> regular order (follow pay procedure)
            $customer = $quotation->customer;
            $orderType = 'walk_in'; // Default to walk-in
            
            if ($customer) {
                if ($customer->type === 'credit') {
                    // Credit customer: automatically use invoice order (credit procedure)
                    $orderType = 'invoice';
                } else {
                    // Regular/cash customer: use regular order (pay procedure)
                    $orderType = 'walk_in';
                }
            }
            
            // Allow override from orderData if provided
            if (isset($orderData['order_type'])) {
                $orderType = $orderData['order_type'];
            }

            // Create order from quotation
            // Include outlet_id from quotation to ensure order is associated with correct outlet
            $order = $this->orderService->create([
                'customer_id' => $quotation->customer_id,
                'outlet_id' => $quotation->outlet_id, // Pass outlet_id from quotation
                'order_type' => $orderType,
                'payment_terms' => $orderType === 'invoice' ? 'credit_30' : ($orderData['payment_terms'] ?? 'immediate'),
                'notes' => $quotation->notes,
                'items' => $quotation->items->map(function ($item) {
                    return [
                        'product_id' => $item->product_id,
                        'quantity' => $item->quantity,
                        'width' => $item->dimensions['width'] ?? null,
                        'height' => $item->dimensions['height'] ?? null,
                        'description' => $item->description,
                    ];
                })->toArray(),
            ], $user);

            // Don't create invoice yet for credit invoice orders
            // Invoice will be created after delivery (RELEASED status) as per new workflow

            // Ensure order has items loaded before moving to production
            $order = $order->fresh(['items']);
            
            if (!$order->items || $order->items->isEmpty()) {
                throw new \Exception('Cannot convert quotation to order: No items found in quotation');
            }

            // Move order to IN_PRODUCTION to send it to back office
            // This will automatically create service jobs for all items
            // For invoice orders (credit customers): DRAFT -> IN_PRODUCTION (skip payment, go directly to production)
            // For regular orders (cash customers): DRAFT -> PAID -> IN_PRODUCTION (payment collected)
            if ($orderType === 'invoice') {
                // Credit customer: Invoice order - follow credit procedure
                // DRAFT -> IN_PRODUCTION (skip payment, go directly to production)
                // Service jobs will be created automatically when status changes to IN_PRODUCTION
                // Invoice will be created after delivery (RELEASED)
                $this->orderService->updateStatus($order, 'IN_PRODUCTION', $user, 'Converted from approved quotation - credit customer');
            } else {
                // Cash/regular customer: Regular order - follow pay procedure
                // DRAFT -> PAID -> IN_PRODUCTION (payment collected)
                $this->orderService->updateStatus($order, 'PAID', $user, 'Converted from approved quotation - cash customer');
                // Now move to IN_PRODUCTION to create service jobs and send to back office
                $order = $order->fresh(['items']); // Reload items after status change
                $this->orderService->updateStatus($order, 'IN_PRODUCTION', $user, 'Converted from approved quotation');
            }

            // Update quotation
            $quotation->update([
                'status' => 'converted',
                'converted_order_id' => $order->id,
            ]);

            return $order->fresh();
        });
    }

    /**
     * Update quotation status
     */
    public function updateStatus(Quotation $quotation, string $status, ?User $approver = null): void
    {
        $quotation->update([
            'status' => $status,
            'approved_by' => $approver?->id,
        ]);
    }
}

