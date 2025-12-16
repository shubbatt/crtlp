<?php

namespace App\Services;

use App\Models\ServiceJob;
use App\Models\Order;
use App\Models\User;
use App\Models\ServiceStatusHistory;

class ServiceJobService
{
    /**
     * Create service jobs from order items that require production
     */
    public function createFromOrder(Order $order): array
    {
        $jobs = [];

        foreach ($order->items as $item) {
            // Create jobs for all items (removed type check - counter staff decides via toggle)
            $jobs[] = $this->createFromOrderItem($item);
        }

        return $jobs;
    }

    /**
     * Create a service job from an order item
     */
    public function createFromOrderItem($orderItem): ServiceJob
    {
        $dueDate = now()->addDays(3); // Default 3 days (make configurable)

        $job = ServiceJob::create([
            'order_id' => $orderItem->order_id,
            'order_item_id' => $orderItem->id,
            'status' => 'PENDING',
            'priority' => 'normal',
            'due_date' => $dueDate,
        ]);

        // Log initial status
        $this->logStatusChange($job, null, 'PENDING', null, 'Job created');

        return $job;
    }

    /**
     * Assign job to a user
     */
    public function assign(ServiceJob $job, User $user, User $assignedBy): void
    {
        $oldStatus = $job->status;
        
        $job->update([
            'assigned_to' => $user->id,
            'status' => 'ACCEPTED', // Changed from ASSIGNED to match workflow
        ]);

        $this->logStatusChange($job, $oldStatus, 'ACCEPTED', $assignedBy, "Assigned to {$user->name}");

        // Notify assignee
        \App\Models\Notification::create([
            'user_id' => $user->id,
            'type' => 'service_status',
            'title' => 'New Job Assigned',
            'message' => "Job #{$job->job_number} has been assigned to you",
            'data' => ['job_id' => $job->id],
        ]);
    }

    /**
     * Update job status
     */
    public function updateStatus(ServiceJob $job, string $newStatus, User $user, ?string $reason = null): void
    {
        $oldStatus = $job->status;

        // Validate transition
        $this->validateStatusTransition($oldStatus, $newStatus);

        // Update timestamps based on status
        $updates = ['status' => $newStatus];
        
        if ($newStatus === 'IN_PROGRESS' && !$job->started_at) {
            $updates['started_at'] = now();
        }
        
        if ($newStatus === 'COMPLETED') {
            $updates['completed_at'] = now();
        }
        
        if ($newStatus === 'DELIVERED') {
            $updates['delivered_at'] = now();
        }

        // Handle QA rejection
        if ($newStatus === 'REJECTED') {
            $updates['rework_count'] = $job->rework_count + 1;
            $updates['status'] = 'IN_PROGRESS'; // Reset to in progress
            $updates['notes'] = $reason ? "QA Fail: {$reason}" : 'QA Rejected - needs rework';
            
            // Alert if too many reworks
            if ($updates['rework_count'] > 2) {
                $this->alertManager($job, 'Job has failed QA more than twice');
            }
        }

        $job->update($updates);

        $this->logStatusChange($job, $oldStatus, $newStatus, $user, $reason);

        // Check if all jobs for this order are completed or cancelled, then update order status
        if ($newStatus === 'COMPLETED' || $newStatus === 'CANCELLED') {
            $this->checkAndUpdateOrderStatus($job);
        }

        // Send notifications
        $this->sendStatusNotifications($job, $newStatus);
    }

    /**
     * Check if all jobs for an order are completed and update order status to READY
     */
    protected function checkAndUpdateOrderStatus(ServiceJob $job): void
    {
        $order = $job->order;
        if (!$order) {
            return;
        }

        // Get all jobs for this order
        $allJobs = ServiceJob::where('order_id', $order->id)->get();
        
        if ($allJobs->isEmpty()) {
            return;
        }

        // Check if all jobs are completed or cancelled
        // CANCELLED jobs are treated as "done" - the item won't be produced but order can proceed
        $allCompleted = $allJobs->every(function ($job) {
            return in_array($job->status, ['COMPLETED', 'CANCELLED']);
        });

        // If all jobs are completed and order is in production, mark order as READY
        if ($allCompleted && $order->status === 'IN_PRODUCTION') {
            $orderService = app(\App\Services\OrderService::class);
            $systemUser = \App\Models\User::whereHas('role', fn($q) => $q->where('name', 'admin'))->first();
            
            if ($systemUser) {
                try {
                    $orderService->updateStatus($order, 'READY', $systemUser, 'All service jobs completed');
                } catch (\Exception $e) {
                    \Log::warning("Failed to auto-update order status to READY: " . $e->getMessage());
                }
            }
        }
    }

    /**
     * Get jobs in queue by status
     */
    public function getQueueByPriority(string $status = 'PENDING'): \Illuminate\Database\Eloquent\Collection
    {
        return ServiceJob::where('status', $status)
            ->with(['order', 'orderItem.product', 'assignedUser'])
            ->orderBy('priority', 'asc')
            ->orderBy('due_date', 'asc')
            ->get();
    }

    /**
     * Cancel a service job
     */
    public function cancel(ServiceJob $job, User $user, string $reason): void
    {
        $oldStatus = $job->status;
        $job->delete();

        try {
            \App\Models\AuditLog::create([
                'user_id' => $user->id,
                'action' => 'delete',
                'entity_type' => 'ServiceJob',
                'entity_id' => $job->id,
                'old_values' => json_encode(['status' => $oldStatus]),
                'new_values' => json_encode(['reason' => $reason]),
                'ip_address' => request()->ip(),
            ]);
        } catch (\Exception $e) {
            \Log::warning('Audit log failed: ' . $e->getMessage());
        }
    }

    /**
     * Check for overdue jobs and escalate
     */
    public function checkOverdueJobs(): void
    {
        $overdueJobs = ServiceJob::where('status', 'PENDING')
            ->where('due_date', '<', now()->subHours(24))
            ->get();

        foreach ($overdueJobs as $job) {
            $this->alertManager($job, 'Job has been pending for more than 24 hours');
        }
    }

    /**
     * Log status change in history
     */
    protected function logStatusChange(ServiceJob $job, ?string $fromStatus, string $toStatus, ?User $user, ?string $reason): void
    {
        ServiceStatusHistory::create([
            'service_job_id' => $job->id,
            'from_status' => $fromStatus, // Allow NULL
            'to_status' => $toStatus,
            'changed_by' => $user?->id, // Allow NULL for system
            'reason' => $reason,
        ]);
    }

    /**
     * Validate status transition
     */
    protected function validateStatusTransition(string $from, string $to): void
    {
        // New workflow: PENDING -> ACCEPTED -> IN_PROGRESS -> QA_REVIEW -> COMPLETED -> DELIVERED
        // Once ACCEPTED, cannot go back to PENDING
        $validTransitions = [
            'PENDING' => ['ACCEPTED', 'CANCELLED'], // Can accept or reject/cancel
            'ACCEPTED' => ['IN_PROGRESS'], // Cannot go back to PENDING
            'IN_PROGRESS' => ['QA_REVIEW', 'ACCEPTED', 'ON_HOLD'],
            'ON_HOLD' => ['IN_PROGRESS'],
            'QA_REVIEW' => ['COMPLETED', 'REJECTED', 'IN_PROGRESS'],
            'REJECTED' => ['IN_PROGRESS'],
            'CANCELLED' => [], // Terminal state for rejected pending jobs
            'COMPLETED' => ['DELIVERED'], // Can be delivered individually
            'DELIVERED' => [], // Terminal state for delivered jobs
        ];

        if (!isset($validTransitions[$from]) || !in_array($to, $validTransitions[$from])) {
            throw new \Exception("Invalid status transition from {$from} to {$to}");
        }
    }

    /**
     * Send notifications based on status
     */
    protected function sendStatusNotifications(ServiceJob $job, string $status): void
    {
        // Notify counter staff when job is completed or on hold
        if (in_array($status, ['COMPLETED', 'ON_HOLD', 'REJECTED'])) {
            $order = $job->order;
            if ($order && $order->created_by) {
                \App\Models\Notification::create([
                    'user_id' => $order->created_by,
                    'type' => 'service_status',
                    'title' => 'Service Job Update',
                    'message' => "Job #{$job->job_number} status changed to {$status}",
                    'data' => ['job_id' => $job->id, 'order_id' => $order->id],
                ]);
            }
        }
    }

    /**
     * Alert manager about issues
     */
    protected function alertManager(ServiceJob $job, string $message): void
    {
        $managers = User::whereHas('role', fn($q) => $q->whereIn('name', ['manager', 'admin']))->get();

        foreach ($managers as $manager) {
            \App\Models\Notification::create([
                'user_id' => $manager->id,
                'type' => 'service_status',
                'title' => 'Service Job Alert',
                'message' => "{$message} - Job #{$job->job_number}",
                'data' => ['job_id' => $job->id],
            ]);
        }
    }
}
