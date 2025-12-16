<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceJob;
use App\Models\User;
use App\Services\ServiceJobService;
use Illuminate\Http\Request;

class ServiceJobController extends Controller
{
    protected ServiceJobService $serviceJobService;

    public function __construct(ServiceJobService $serviceJobService)
    {
        $this->serviceJobService = $serviceJobService;
    }

    /**
     * Get service queue
     */
    public function queue(Request $request)
    {
        $status = $request->get('status', 'PENDING');
        $jobs = $this->serviceJobService->getQueueByPriority($status);

        return response()->json($jobs);
    }

    /**
     * Get all service jobs
     */
    public function index(Request $request)
    {
        $query = ServiceJob::with(['order.customer', 'orderItem.product', 'assignedUser']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        // Filter by outlet if provided
        // Note: If outlet_id is null in order, it should still be visible (for backward compatibility)
        $outletId = $request->header('X-Outlet-ID') ?? $request->get('outlet_id');
        if ($outletId) {
            $query->whereHas('order', function ($q) use ($outletId) {
                $q->where(function($subQ) use ($outletId) {
                    $subQ->where('outlet_id', $outletId)
                         ->orWhereNull('outlet_id'); // Include orders with null outlet_id for backward compatibility
                });
            });
        }

        // For kanban board, return all jobs without pagination
        if ($request->has('all') || $request->get('all') === 'true') {
            $jobs = $query->orderBy('due_date', 'asc')->get();
            return response()->json($jobs);
        }

        $jobs = $query->orderBy('due_date', 'asc')->paginate(50);

        return response()->json($jobs);
    }

    /**
     * Get a specific job
     */
    public function show($id)
    {
        $job = ServiceJob::with([
            'order.customer',
            'orderItem.product',
            'assignedUser',
            'statusHistory.changedBy',
            'comments.user'
        ])->findOrFail($id);

        return response()->json($job);
    }

    /**
     * Assign job to user
     */
    public function assign(Request $request, $id)
    {
        $job = ServiceJob::findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $assignee = User::findOrFail($validated['user_id']);

        try {
            $this->serviceJobService->assign($job, $assignee, $request->user());

            return response()->json([
                'message' => 'Job assigned successfully',
                'job' => $job->fresh(['assignedUser'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Update job status
     */
    public function updateStatus(Request $request, $id)
    {
        $job = ServiceJob::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string',
            'reason' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $this->serviceJobService->updateStatus(
                $job,
                $validated['status'],
                $user,
                $validated['reason'] ?? null
            );

            return response()->json([
                'message' => 'Job status updated successfully',
                'job' => $job->fresh()
            ]);
        } catch (\Exception $e) {
            \Log::error('Service job status update failed', [
                'job_id' => $id,
                'status' => $validated['status'],
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Update job priority
     */
    public function updatePriority(Request $request, $id)
    {
        $job = ServiceJob::findOrFail($id);

        $validated = $request->validate([
            'priority' => 'required|in:low,normal,high,urgent',
        ]);

        $job->update(['priority' => $validated['priority']]);

        return response()->json([
            'message' => 'Priority updated successfully',
            'job' => $job
        ]);
    }

    /**
     * Add a comment to a job
     */
    public function addComment(Request $request, $id)
    {
        $job = ServiceJob::findOrFail($id);

        $validated = $request->validate([
            'comment' => 'required|string|max:2000',
        ]);

        $comment = \App\Models\ServiceJobComment::create([
            'service_job_id' => $job->id,
            'user_id' => $request->user()->id,
            'comment' => $validated['comment'],
        ]);

        return response()->json([
            'message' => 'Comment added successfully',
            'comment' => $comment->load('user')
        ], 201);
    }

    /**
     * Get all comments for a job
     */
    public function getComments($id)
    {
        $job = ServiceJob::findOrFail($id);
        $comments = $job->comments()->with('user')->orderBy('created_at', 'desc')->get();

        return response()->json($comments);
    }
}
