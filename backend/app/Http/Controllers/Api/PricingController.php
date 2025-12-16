<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\PricingEngine;
use Illuminate\Http\Request;

class PricingController extends Controller
{
    protected PricingEngine $pricingEngine;

    public function __construct(PricingEngine $pricingEngine)
    {
        $this->pricingEngine = $pricingEngine;
    }

    /**
     * Calculate price for a product
     */
    public function calculate(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'width' => 'nullable|numeric',
            'height' => 'nullable|numeric',
            'customer_id' => 'nullable|exists:customers,id',
        ]);

        $product = Product::findOrFail($validated['product_id']);

        $result = $this->pricingEngine->calculate($product, $validated);

        return response()->json([
            'product_id' => $product->id,
            'product_name' => $product->name,
            ...$result
        ]);
    }

    /**
     * Batch calculate pricing for multiple items
     */
    public function batchCalculate(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.width' => 'nullable|numeric',
            'items.*.height' => 'nullable|numeric',
        ]);

        $results = $this->pricingEngine->batchCalculate($validated['items']);

        return response()->json(['items' => $results]);
    }
}
