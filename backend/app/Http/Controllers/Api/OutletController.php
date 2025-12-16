<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use Illuminate\Http\Request;

class OutletController extends Controller
{
    /**
     * Get all active outlets
     */
    public function index()
    {
        $outlets = Outlet::where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json($outlets);
    }

    /**
     * Get a specific outlet
     */
    public function show($id)
    {
        $outlet = Outlet::findOrFail($id);

        return response()->json($outlet);
    }

    /**
     * Update outlet details
     */
    public function update(Request $request, $id)
    {
        $outlet = Outlet::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:50|unique:outlets,code,' . $id,
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'is_active' => 'sometimes|boolean',
        ]);

        $outlet->update($validated);

        return response()->json($outlet);
    }
}
