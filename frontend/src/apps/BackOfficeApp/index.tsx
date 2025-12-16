import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import JobDetail from './pages/JobDetail';
import './BackOfficeApp.css';

interface ServiceJob {
    id: number;
    job_number: string;
    status: string;
    priority: string;
    due_date: string | null;
    completed_at?: string | null;
    order?: {
        order_number: string;
        customer?: { name: string };
    };
    order_item?: { description: string; product?: { name: string } };
    orderItem?: { description: string; product?: { name: string } };
    assigned_user?: { name: string };
    assignedUser?: { name: string };
    notes?: string;
}

const COLUMNS = [
    { id: 'PENDING', title: '📥 Pending', color: '#6b7280' },
    { id: 'ACCEPTED', title: '👤 Accepted', color: '#3b82f6' },
    { id: 'IN_PROGRESS', title: '🔧 In Progress', color: '#8b5cf6' },
    { id: 'QA_REVIEW', title: '🔍 QA Review', color: '#ec4899' },
    { id: 'COMPLETED', title: '✅ Completed', color: '#10b981' },
];

const BackOfficeBoard: React.FC = () => {
    const navigate = useNavigate();
    const [allJobs, setAllJobs] = useState<ServiceJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    // Reject modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingJob, setRejectingJob] = useState<ServiceJob | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        fetchAllJobs();

        // Auto-refresh every 10 seconds
        const interval = setInterval(() => {
            fetchAllJobs();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const fetchAllJobs = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.SERVICE_JOBS, {
                params: { all: true }
            });
            // Handle both paginated and non-paginated responses
            const jobs = Array.isArray(data) ? data : (data.data || []);
            setAllJobs(jobs);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        }
        setLoading(false);
    };

    const updateStatus = async (jobId: number, newStatus: string, reason?: string) => {
        try {
            const payload: { status: string; reason?: string } = {
                status: newStatus
            };

            // Only include reason if it's provided and not empty
            if (reason && reason.trim()) {
                payload.reason = reason.trim();
            }

            await apiClient.patch(API_ENDPOINTS.SERVICE_STATUS(jobId), payload);
            fetchAllJobs();
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
            alert('Failed to update: ' + errorMessage);
            console.error('Status update error:', error.response?.data || error);
        }
    };

    const handleReject = () => {
        if (!rejectingJob || !rejectReason.trim()) {
            alert('Please enter a rejection reason');
            return;
        }

        // For PENDING jobs, reject moves them to CANCELLED status
        // For QA_REVIEW jobs, reject moves them back to IN_PROGRESS (handled by backend)
        const newStatus = rejectingJob.status === 'PENDING' ? 'CANCELLED' : 'REJECTED';

        updateStatus(rejectingJob.id, newStatus, rejectReason);
        setShowRejectModal(false);
        setRejectingJob(null);
        setRejectReason('');
    };

    const openRejectModal = (job: ServiceJob) => {
        setRejectingJob(job);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const getJobsByStatus = (status: string) => {
        let jobs = allJobs.filter(job => job.status === status);

        // Apply search filter if search term exists
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            jobs = jobs.filter(job => {
                // Search by job number
                const jobNumber = job.job_number?.toLowerCase() || '';
                if (jobNumber.includes(term)) return true;

                // Search by order number
                const orderNumber = job.order?.order_number?.toLowerCase() || '';
                if (orderNumber.includes(term)) return true;

                // Search by customer name
                const customerName = job.order?.customer?.name?.toLowerCase() || '';
                if (customerName.includes(term)) return true;

                return false;
            });
        }

        // Sort completed jobs in descending order (most recent first)
        if (status === 'COMPLETED') {
            jobs.sort((a, b) => {
                const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                return dateB - dateA; // Descending order
            });
        }

        return jobs;
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            urgent: '#ef4444',
            high: '#f59e0b',
            normal: '#3b82f6',
            low: '#6b7280',
        };
        return colors[priority] || '#6b7280';
    };

    const getNextStatus = (current: string) => {
        const flow: Record<string, string> = {
            PENDING: 'ACCEPTED',
            ACCEPTED: 'IN_PROGRESS',
            IN_PROGRESS: 'QA_REVIEW',
            QA_REVIEW: 'COMPLETED',
        };
        return flow[current];
    };

    const getPrevStatus = (current: string) => {
        // Once accepted, cannot go back to pending
        const flow: Record<string, string> = {
            IN_PROGRESS: 'ACCEPTED',
            QA_REVIEW: 'IN_PROGRESS',
        };
        return flow[current];
    };

    if (loading) {
        return (
            <div className="kanban-loading">
                <div className="spinner"></div>
                <p>Loading production queue...</p>
            </div>
        );
    }

    return (
        <div className="kanban-board">
            <div className="kanban-header">
                <h1>🏭 Production Board</h1>
                <div className="header-actions">
                    <div className="search-container" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginRight: '20px'
                    }}>
                        <input
                            type="text"
                            placeholder="🔍 Search by Job ID, Order #, or Customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px',
                                minWidth: '300px',
                                fontFamily: 'inherit'
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{
                                    padding: '6px 10px',
                                    background: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                ✕ Clear
                            </button>
                        )}
                    </div>
                    <span className="job-count">{allJobs.length} Jobs</span>
                    <span className="last-update">
                        Updated: {lastUpdate.toLocaleTimeString()}
                    </span>
                    <button onClick={fetchAllJobs} className="btn-refresh">🔄 Refresh</button>
                </div>
            </div>

            <div className="kanban-columns">
                {COLUMNS.map(column => {
                    const columnJobs = getJobsByStatus(column.id);
                    return (
                        <div key={column.id} className="kanban-column">
                            <div className="column-header" style={{ borderTopColor: column.color }}>
                                <span className="column-title">{column.title}</span>
                                <span className="column-count" style={{ backgroundColor: column.color }}>
                                    {columnJobs.length}
                                </span>
                            </div>

                            <div className="column-content">
                                {columnJobs.length === 0 ? (
                                    <div className="empty-column">No jobs</div>
                                ) : (
                                    columnJobs.map(job => (
                                        <div
                                            key={job.id}
                                            className="kanban-card"
                                            onClick={() => navigate(`/backoffice/jobs/${job.id}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="card-header">
                                                <span className="job-number">{job.job_number}</span>
                                                <span
                                                    className="priority-dot"
                                                    style={{ backgroundColor: getPriorityColor(job.priority) }}
                                                    title={job.priority}
                                                />
                                            </div>

                                            <div className="card-body">
                                                <div className="product-name">
                                                    {(job.orderItem || job.order_item)?.product?.name ||
                                                        (job.orderItem || job.order_item)?.description ||
                                                        'Item'}
                                                </div>
                                                <div className="order-ref">
                                                    📦 {job.order?.order_number || 'N/A'}
                                                </div>
                                                {(job.assignedUser || job.assigned_user) && (
                                                    <div className="assignee">
                                                        👤 {(job.assignedUser || job.assigned_user)?.name}
                                                    </div>
                                                )}
                                                {job.due_date && (
                                                    <div className="due-date">
                                                        📅 {new Date(job.due_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {job.notes && (
                                                    <div className="job-notes">
                                                        💬 {job.notes}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                                                {getPrevStatus(job.status) && (
                                                    <button
                                                        className="btn-move prev"
                                                        onClick={() => updateStatus(job.id, getPrevStatus(job.status)!)}
                                                        title="Move back"
                                                    >
                                                        ← Back
                                                    </button>
                                                )}
                                                {getNextStatus(job.status) && (
                                                    <button
                                                        className="btn-move next"
                                                        onClick={() => updateStatus(job.id, getNextStatus(job.status)!)}
                                                        title="Move forward"
                                                    >
                                                        Next →
                                                    </button>
                                                )}
                                                {job.status === 'PENDING' && (
                                                    <button
                                                        className="btn-reject"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openRejectModal(job);
                                                        }}
                                                        title="Reject with comment"
                                                    >
                                                        ✗ Reject
                                                    </button>
                                                )}
                                                {job.status === 'QA_REVIEW' && (
                                                    <button
                                                        className="btn-reject"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openRejectModal(job);
                                                        }}
                                                        title="Reject with comment"
                                                    >
                                                        ✗ Fail
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Reject Modal */}
            {showRejectModal && rejectingJob && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <h2>{rejectingJob.status === 'PENDING' ? '🔴 Reject Job' : '🔴 QA Rejection'}</h2>
                        <p className="job-ref">
                            Rejecting: <strong>{rejectingJob.job_number}</strong>
                        </p>
                        <p className="product-ref">
                            {(rejectingJob.orderItem || rejectingJob.order_item)?.product?.name ||
                                (rejectingJob.orderItem || rejectingJob.order_item)?.description}
                        </p>

                        <div className="form-group">
                            <label>Rejection Reason *</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder={rejectingJob.status === 'PENDING'
                                    ? "Enter reason for rejecting this job..."
                                    : "Describe the issue that caused QA failure..."}
                                rows={4}
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowRejectModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-confirm-reject"
                                onClick={handleReject}
                                disabled={!rejectReason.trim()}
                            >
                                {rejectingJob.status === 'PENDING' ? '✗ Reject Job' : '✗ Reject & Send Back'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const BackOfficeApp: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<BackOfficeBoard />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
    );
};

export default BackOfficeApp;
