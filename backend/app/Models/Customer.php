<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'name', 'email', 'phone', 'address', 'type',
        'credit_limit', 'credit_balance', 'credit_period_days', 'tax_id', 'notes'
    ];

    protected $casts = [
        'credit_limit' => 'decimal:2',
        'credit_balance' => 'decimal:2',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function quotations()
    {
        return $this->hasMany(Quotation::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Check if customer can place an order on credit
     * Returns false if credit limit OR credit period exceeded
     */
    public function canPlaceOrder(float $orderTotal, bool $allowPayment = false): bool
    {
        // Non-credit customers can always place orders
        if ($this->type !== 'credit') {
            return true;
        }

        // If allowing payment, they can always place order (just can't use credit)
        if ($allowPayment) {
            return true;
        }

        // Check credit limit
        $wouldExceedLimit = ($this->credit_balance + $orderTotal) > $this->credit_limit;
        if ($wouldExceedLimit) {
            return false;
        }

        // Check for overdue invoices (credit period exceeded)
        $hasOverdueInvoices = $this->invoices()
            ->where('status', 'overdue')
            ->where('balance', '>', 0)
            ->exists();

        if ($hasOverdueInvoices) {
            return false;
        }

        return true;
    }

    /**
     * Get available credit amount
     */
    public function getAvailableCredit(): float
    {
        if ($this->type !== 'credit') {
            return 0;
        }

        return max(0, $this->credit_limit - $this->credit_balance);
    }

    /**
     * Check if customer has overdue invoices
     */
    public function hasOverdueInvoices(): bool
    {
        return $this->invoices()
            ->where('status', 'overdue')
            ->where('balance', '>', 0)
            ->exists();
    }
}
