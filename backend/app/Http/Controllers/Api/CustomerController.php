<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * Get all customers
     */
    public function index(Request $request)
    {
        $query = Customer::query();

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%")
                  ->orWhere('phone', 'like', "%{$request->search}%");
            });
        }

        $customers = $query->orderBy('name')->paginate(50);

        return response()->json($customers);
    }

    /**
     * Get a specific customer
     */
    public function show($id)
    {
        $customer = Customer::with(['orders', 'invoices', 'payments'])
            ->withCount('orders')
            ->findOrFail($id);

        return response()->json($customer);
    }

    /**
     * Create a new customer
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'email' => 'nullable|email',
            'phone' => 'required|string',
            'address' => 'nullable|string',
            'type' => 'required|in:walk_in,regular,credit',
            'credit_limit' => 'nullable|numeric|min:0',
            'credit_period_days' => 'nullable|integer|min:1|max:365',
            'tax_id' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        // Check for duplicate customer by name OR phone
        $name = trim($validated['name']);
        $phone = trim($validated['phone']);
        
        // Check for same name OR same phone
        $existingByName = Customer::where('name', '=', $name)->first();
        $existingByPhone = Customer::where('phone', '=', $phone)->first();
        
        if ($existingByName) {
            return response()->json([
                'error' => 'duplicate',
                'message' => 'A customer with the same name already exists.',
                'existing_customer' => $existingByName,
                'duplicate_field' => 'name'
            ], 409);
        }
        
        if ($existingByPhone) {
            return response()->json([
                'error' => 'duplicate',
                'message' => 'A customer with the same phone number already exists.',
                'existing_customer' => $existingByPhone,
                'duplicate_field' => 'phone'
            ], 409);
        }

        $customer = Customer::create($validated);

        return response()->json($customer, 201);
    }

    /**
     * Update a customer
     */
    public function update(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'type' => 'sometimes|in:walk_in,regular,credit',
            'credit_limit' => 'nullable|numeric|min:0',
            'credit_period_days' => 'nullable|integer|min:1|max:365',
            'notes' => 'nullable|string',
        ]);

        $customer->update($validated);

        return response()->json($customer);
    }

    /**
     * Get customer credit history
     */
    public function creditHistory($id)
    {
        $customer = Customer::findOrFail($id);

        $history = [
            'credit_limit' => $customer->credit_limit,
            'credit_balance' => $customer->credit_balance,
            'available_credit' => $customer->credit_limit - $customer->credit_balance,
            'orders' => $customer->orders()
                ->where('payment_terms', 'like', 'credit_%')
                ->with('payments')
                ->orderBy('created_at', 'desc')
                ->limit(20)
                ->get(),
        ];

        return response()->json($history);
    }

    /**
     * Update customer credit limit (requires manager/admin)
     */
    public function updateCreditLimit(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        $validated = $request->validate([
            'credit_limit' => 'required|numeric|min:0',
        ]);

        $customer->update(['credit_limit' => $validated['credit_limit']]);

        return response()->json([
            'message' => 'Credit limit updated successfully',
            'customer' => $customer
        ]);
    }
}
