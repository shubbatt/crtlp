<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quotation extends Model
{
    protected $table = 'quotations';
    protected $fillable = [
        'quote_number', 'customer_id', 'outlet_id', 'version', 'status',
        'subtotal', 'discount', 'tax', 'total', 'valid_until',
        'notes', 'converted_order_id', 'created_by', 'approved_by'
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'valid_until' => 'datetime',
    ];

    // Relationships
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function convertedOrder()
    {
        return $this->belongsTo(Order::class, 'converted_order_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function outlet()
    {
        return $this->belongsTo(Outlet::class);
    }

    // Auto-generate quote number
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($quotation) {
            if (!$quotation->quote_number) {
                $quotation->quote_number = 'QUO-' . date('Y') . '-' . str_pad(
                    static::whereYear('created_at', date('Y'))->count() + 1,
                    4,
                    '0',
                    STR_PAD_LEFT
                );
            }
        });
    }
}
