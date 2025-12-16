<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceJob extends Model
{
    protected $fillable = [
        'job_number', 'order_id', 'order_item_id', 'status',
        'assigned_to', 'priority', 'due_date', 'started_at',
        'completed_at', 'delivered_at', 'notes', 'rework_count'
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    // Relationships
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function statusHistory()
    {
        return $this->hasMany(ServiceStatusHistory::class);
    }

    public function comments()
    {
        return $this->hasMany(ServiceJobComment::class)->orderBy('created_at', 'desc');
    }

    // Auto-generate job number
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($job) {
            if (!$job->job_number) {
                $job->job_number = 'JOB-' . date('Y') . '-' . str_pad(
                    static::whereYear('created_at', date('Y'))->count() + 1,
                    4,
                    '0',
                    STR_PAD_LEFT
                );
            }
        });
    }
}
