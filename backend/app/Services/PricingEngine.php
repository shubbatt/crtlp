<?php

namespace App\Services;

use App\Models\Product;
use App\Models\PricingRule;

class PricingEngine
{
    /**
     * Calculate price for a product based on various parameters
     * 
     * @param Product $product
     * @param array $params - quantity, width, height, customer_id
     * @return array ['unit_price' => X, 'line_total' => Y, 'applied_rule' => Z]
     */
    public function calculate(Product $product, array $params): array
    {
        $quantity = $params['quantity'] ?? 1;
        $width = $params['width'] ?? null;
        $height = $params['height'] ?? null;
        $customerId = $params['customer_id'] ?? null;

        // Get all valid pricing rules for this product, ordered by priority (desc)
        $rules = $product->pricingRules()
            ->where(function ($query) {
                $query->whereNull('valid_from')->orWhere('valid_from', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('valid_until')->orWhere('valid_until', '>=', now());
            })
            ->orderBy('priority', 'desc')
            ->get();

        // Priority: Customer-specific → Dimension → Quantity-tier → Base price
        $appliedRule = null;
        
        // For dimension products, unit_cost should be price per square unit
        // For other products, unit_cost is the base price
        $unitPrice = $product->unit_cost;

        foreach ($rules as $rule) {
            $result = $this->applyRule($rule, $quantity, $width, $height, $customerId);
            
            if ($result !== null) {
                $unitPrice = $result;
                $appliedRule = $rule->id;
                break; // Use first matching rule (highest priority)
            }
        }

        // For dimension products without a dimension rule, ensure unit_cost is used as price per sq ft
        // This ensures dimension products always have a valid price
        if ($product->type === 'dimension' && !$appliedRule && $unitPrice > 0) {
            // unit_cost is already price per square unit, which is correct
        }

        // Calculate line total based on product type
        $lineTotal = $this->calculateLineTotal($product->type, $unitPrice, $quantity, $width, $height);

        return [
            'unit_price' => round($unitPrice, 2),
            'line_total' => round($lineTotal, 2),
            'applied_rule' => $appliedRule,
        ];
    }

    /**
     * Apply a specific pricing rule
     */
    protected function applyRule(PricingRule $rule, int $quantity, ?float $width, ?float $height, ?int $customerId): ?float
    {
        switch ($rule->rule_type) {
            case 'customer_specific':
                return $this->applyCustomerSpecific($rule, $customerId);
            
            case 'dimension':
                return $this->applyDimension($rule, $width, $height);
            
            case 'quantity_tier':
                return $this->applyQuantityTier($rule, $quantity);
            
            case 'fixed':
                return $this->applyFixed($rule);
            
            default:
                return null;
        }
    }

    /**
     * Customer-specific pricing
     */
    protected function applyCustomerSpecific(PricingRule $rule, ?int $customerId): ?float
    {
        if (!$customerId) {
            return null;
        }

        $config = $rule->config;
        
        if (isset($config['customer_id']) && $config['customer_id'] == $customerId) {
            // Check if it's a discount percentage or fixed price
            if (isset($config['discount_pct'])) {
                // This would need the base price, so we skip for now
                return null;
            }
            
            if (isset($config['price'])) {
                return $config['price'];
            }
        }

        return null;
    }

    /**
     * Dimension-based pricing (e.g., per square foot)
     */
    protected function applyDimension(PricingRule $rule, ?float $width, ?float $height): ?float
    {
        if (!$width || !$height) {
            return null;
        }

        $config = $rule->config;
        $basePrice = $config['base_price'] ?? 0;
        $minSize = $config['min_size'] ?? 0;
        
        // Calculate area
        $area = $width * $height;
        
        // Apply minimum size
        if ($area < $minSize) {
            $area = $minSize;
        }

        return $basePrice; // Price per unit area
    }

    /**
     * Quantity-tier pricing
     */
    protected function applyQuantityTier(PricingRule $rule, int $quantity): ?float
    {
        $config = $rule->config;
        
        if (!is_array($config)) {
            return null;
        }

        // Find the appropriate tier
        $applicableTier = null;
        
        foreach ($config as $tier) {
            $minQty = $tier['min_qty'] ?? 0;
            $maxQty = $tier['max_qty'] ?? PHP_INT_MAX;
            
            if ($quantity >= $minQty && $quantity <= $maxQty) {
                $applicableTier = $tier;
                break;
            }
        }

        return $applicableTier['price'] ?? null;
    }

    /**
     * Fixed pricing
     */
    protected function applyFixed(PricingRule $rule): ?float
    {
        $config = $rule->config;
        return $config['price'] ?? null;
    }

    /**
     * Calculate line total based on product type
     */
    protected function calculateLineTotal(string $productType, float $unitPrice, int $quantity, ?float $width, ?float $height): float
    {
        switch ($productType) {
            case 'dimension':
                // For dimension-based, unit price is per square unit
                // Line total = (price per sq ft) * (width * height) * quantity
                if ($width && $height && $width > 0 && $height > 0) {
                    $area = $width * $height;
                    return $unitPrice * $area * $quantity;
                }
                // If dimensions not provided, fallback to unit_price * quantity
                // This prevents 0 totals when dimensions are missing
                \Log::warning("Dimension product missing dimensions, using fallback calculation: unit_price * quantity");
                return $unitPrice * $quantity;
            
            case 'inventory':
            case 'service':
            default:
                // Standard quantity * unit price
                return $unitPrice * $quantity;
        }
    }

    /**
     * Batch calculate pricing for multiple items
     */
    public function batchCalculate(array $items): array
    {
        $results = [];
        
        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            
            if (!$product) {
                continue;
            }

            $results[] = array_merge(
                ['product_id' => $product->id],
                $this->calculate($product, $item)
            );
        }

        return $results;
    }
}
