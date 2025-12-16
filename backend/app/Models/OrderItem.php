<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_id', 'item_type', 'description',
        'quantity', 'dimensions', 'unit_price', 'line_total',
        'pricing_rule_id', 'override_reason'
    ];

    protected $casts = [
        'dimensions' => 'array',
        'unit_price' => 'decimal:2',
        'line_total' => 'decimal:2',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function pricingRule()
    {
        return $this->belongsTo(PricingRule::class);
    }

    public function serviceJob()
    {
        return $this->hasOne(ServiceJob::class);
    }
}
