<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'sku', 'name', 'description', 'category_id', 'type',
        'unit_cost', 'stock_qty', 'min_stock_alert', 'is_active'
    ];

    protected $casts = [
        'unit_cost' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function pricingRules()
    {
        return $this->hasMany(PricingRule::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Outlets where this product is available
     */
    public function outlets()
    {
        return $this->belongsToMany(Outlet::class, 'product_outlets')
            ->withTimestamps();
    }
}
