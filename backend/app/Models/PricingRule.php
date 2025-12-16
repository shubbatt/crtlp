<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PricingRule extends Model
{
    protected $fillable = [
        'product_id', 'rule_type', 'config', 'priority',
        'valid_from', 'valid_until'
    ];

    protected $casts = [
        'config' => 'array',
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Check if pricing rule is currently valid
     */
    public function isValid(): bool
    {
        $now = now();

        if ($this->valid_from && $now->lt($this->valid_from)) {
            return false;
        }

        if ($this->valid_until && $now->gt($this->valid_until)) {
            return false;
        }

        return true;
    }
}
