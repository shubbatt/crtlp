<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceStatusHistory extends Model
{
    protected $table = 'service_status_history';
    
    public $timestamps = false; // Disable timestamps

    protected $fillable = [
        'service_job_id',
        'from_status',
        'to_status',
        'changed_by',
        'reason',
    ];

    public function serviceJob()
    {
        return $this->belongsTo(ServiceJob::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
