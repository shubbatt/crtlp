<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Outlet extends Model
{
    protected $fillable = [
        'name',
        'code',
        'address',
        'phone',
        'email',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Products available at this outlet
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_outlets')
            ->withTimestamps();
    }

    /**
     * Orders for this outlet
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Invoices for this outlet
     */
    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}
