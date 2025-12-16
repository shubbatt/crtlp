<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * Get all products
     */
    public function index(Request $request)
    {
        $query = Product::with('pricingRules', 'outlets');

        // Filter by outlet_id (from header or query param)
        $outletId = $request->header('X-Outlet-ID') ?? $request->query('outlet_id');
        if ($outletId) {
            $query->whereHas('outlets', function ($q) use ($outletId) {
                $q->where('outlets.id', $outletId);
            });
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('sku', 'like', "%{$request->search}%");
            });
        }

        $products = $query->orderBy('name')->paginate(50);

        return response()->json($products);
    }

    /**
     * Get a specific product
     */
    public function show($id)
    {
        $product = Product::with('pricingRules', 'outlets')->findOrFail($id);

        return response()->json($product);
    }

    /**
     * Create a new product
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'sku' => 'required|string|unique:products,sku',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'type' => 'required|in:inventory,service,dimension',
            'unit_cost' => 'required|numeric|min:0',
            'stock_qty' => 'nullable|integer|min:0',
            'min_stock_alert' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
            'outlet_ids' => 'nullable|array',
            'outlet_ids.*' => 'exists:outlets,id',
        ]);

        $product = Product::create($validated);

        // Sync outlets if provided
        if ($request->has('outlet_ids')) {
            $product->outlets()->sync($request->outlet_ids);
        }

        return response()->json($product->load('outlets'), 201);
    }

    /**
     * Update a product
     */
    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string',
            'description' => 'nullable|string',
            'unit_cost' => 'sometimes|numeric|min:0',
            'stock_qty' => 'sometimes|integer|min:0',
            'min_stock_alert' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'outlet_ids' => 'nullable|array',
            'outlet_ids.*' => 'exists:outlets,id',
        ]);

        $product->update($validated);

        // Sync outlets if provided
        if ($request->has('outlet_ids')) {
            $product->outlets()->sync($request->outlet_ids);
        }

        return response()->json($product->load('outlets'));
    }
}
