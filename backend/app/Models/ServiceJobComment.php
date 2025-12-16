<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceJobComment extends Model
{
    protected $fillable = [
        'service_job_id',
        'user_id',
        'comment'
    ];

    // Relationships
    public function serviceJob()
    {
        return $this->belongsTo(ServiceJob::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
