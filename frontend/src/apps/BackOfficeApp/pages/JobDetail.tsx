import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './JobDetail.css';

interface StatusHistory {
    id: number;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
    changed_by?: { name: string };
}

interface OrderItem {
    id: number;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product?: { name: string; sku: string };
}

interface Comment {
    id: number;
    comment: string;
    created_at: string;
    user?: {
        id: number;
        name: string;
    };
}

interface ServiceJob {
    id: number;
    job_number: string;
    status: string;
    priority: string;
    due_date: string | null;
    started_at: string | null;
    completed_at: string | null;
    notes: string | null;
    rework_count: number;
    comments?: Comment[];
    order?: {
        id: number;
        order_number: string;
        status: string;
        order_type: string;
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
        paid_amount: number;
        balance: number;
        notes: string | null;
        customer?: {
            id: number;
            name: string;
            email?: string;
            phone?: string;
            type?: string;
        };
        items?: OrderItem[];
        creator?: { name: string };
        created_at: string;
    };
    orderItem?: {
        id: number;
        description: string;
        quantity: number;
        unit_price: number;
        line_total: number;
        product?: {
            id: number;
            name: string;
            sku: string;
        };
    };
    assignedUser?: {
        id: number;
        name: string;
    };
    statusHistory?: StatusHistory[];
}

const JobDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [job, setJob] = useState<ServiceJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);

    useEffect(() => {
        if (id) {
            fetchJob();
        }
    }, [id]);

    const fetchJob = async () => {
        try {
            const { data } = await apiClient.get(`${API_ENDPOINTS.SERVICE_JOBS}/${id}`);
            setJob(data);
            if (data.comments) {
                setComments(data.comments);
            }
            // Also fetch comments separately to ensure we have the latest
            fetchComments();
        } catch (error) {
            console.error('Failed to fetch job:', error);
            alert('Failed to load job details');
        }
        setLoading(false);
    };

    const fetchComments = async () => {
        if (!id) return;
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.SERVICE_COMMENTS(Number(id)));
            const commentsList = Array.isArray(data) ? data : [];
            // Sort comments by date (newest first - recent comments on top)
            commentsList.sort((a: Comment, b: Comment) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setComments(commentsList);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    };

    const handleAddComment = async () => {
        if (!job || !newComment.trim()) return;

        setSavingComment(true);
        try {
            const { data } = await apiClient.post(API_ENDPOINTS.SERVICE_COMMENTS(job.id), {
                comment: newComment.trim()
            });
            // Add the new comment to the top of the list (newest first)
            setComments([data.comment, ...comments]);
            setNewComment('');
            alert('✅ Comment added successfully');
        } catch (error: any) {
            alert('Failed to add comment: ' + (error.response?.data?.error || error.message));
        }
        setSavingComment(false);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: '#6b7280',
            ACCEPTED: '#3b82f6',
            IN_PROGRESS: '#8b5cf6',
            QA_REVIEW: '#ec4899',
            COMPLETED: '#10b981',
            CANCELLED: '#ef4444',
            REJECTED: '#f59e0b',
            ON_HOLD: '#f97316',
        };
        return colors[status] || '#6b7280';
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

    if (loading) {
        return <div className="job-detail-loading">Loading job details...</div>;
    }

    if (!job) {
        return <div className="job-detail-error">Job not found</div>;
    }

    return (
        <div className="job-detail">
            <div className="detail-header">
                <button onClick={() => navigate('/backoffice')} className="btn-back">
                    ← Back to Production Board
                </button>
                <div className="header-info">
                    <h1>Job {job.job_number}</h1>
                    <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(job.status) }}
                    >
                        {job.status.replace('_', ' ')}
                    </span>
                </div>
            </div>

            <div className="detail-content">
                {/* Job Information */}
                <div className="info-section">
                    <h2>Job Information</h2>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="label">Job Number:</span>
                            <span className="value">{job.job_number}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Status:</span>
                            <span className="value status-value" style={{ color: getStatusColor(job.status) }}>
                                {job.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="label">Priority:</span>
                            <span className="value priority-value" style={{ color: getPriorityColor(job.priority) }}>
                                {job.priority.toUpperCase()}
                            </span>
                        </div>
                        {job.assignedUser && (
                            <div className="info-item">
                                <span className="label">Assigned To:</span>
                                <span className="value">👤 {job.assignedUser.name}</span>
                            </div>
                        )}
                        {job.due_date && (
                            <div className="info-item">
                                <span className="label">Due Date:</span>
                                <span className="value">📅 {new Date(job.due_date).toLocaleDateString()}</span>
                            </div>
                        )}
                        {job.started_at && (
                            <div className="info-item">
                                <span className="label">Started At:</span>
                                <span className="value">⏱️ {new Date(job.started_at).toLocaleString()}</span>
                            </div>
                        )}
                        {job.completed_at && (
                            <div className="info-item">
                                <span className="label">Completed At:</span>
                                <span className="value">✅ {new Date(job.completed_at).toLocaleString()}</span>
                            </div>
                        )}
                        {job.rework_count > 0 && (
                            <div className="info-item">
                                <span className="label">Rework Count:</span>
                                <span className="value">⚠️ {job.rework_count}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Job Item Details */}
                {job.orderItem && (
                    <div className="info-section">
                        <h2>Job Item</h2>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Product:</span>
                                <span className="value">{job.orderItem.product?.name || job.orderItem.description}</span>
                            </div>
                            {job.orderItem.product?.sku && (
                                <div className="info-item">
                                    <span className="label">SKU:</span>
                                    <span className="value">{job.orderItem.product.sku}</span>
                                </div>
                            )}
                            <div className="info-item">
                                <span className="label">Quantity:</span>
                                <span className="value">{job.orderItem.quantity}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Unit Price:</span>
                                <span className="value">{formatCurrency(job.orderItem.unit_price)}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Line Total:</span>
                                <span className="value">{formatCurrency(job.orderItem.line_total)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Comments/Notes Section */}
                <div className="info-section">
                    <h2>Comments & Notes</h2>
                    <div className="notes-section">
                        <textarea
                            className="notes-textarea"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment or note about this job..."
                            rows={4}
                        />
                        <button
                            className="btn-save-notes"
                            onClick={handleAddComment}
                            disabled={savingComment || !newComment.trim()}
                        >
                            {savingComment ? 'Adding...' : '💬 Add Comment'}
                        </button>
                        
                        {/* Comments Timeline */}
                        {comments.length > 0 && (
                            <div className="comments-timeline">
                                <h3 style={{ marginTop: '20px', marginBottom: '15px', fontSize: '16px', color: '#3b82f6' }}>
                                    Comments Timeline
                                </h3>
                                {comments.map((comment, index) => (
                                    <div key={comment.id} className="comment-item">
                                        <div className="comment-header">
                                            <div className="comment-user">
                                                👤 {comment.user?.name || 'Unknown User'}
                                            </div>
                                            <div className="comment-date">
                                                📅 {new Date(comment.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="comment-content">
                                            {comment.comment}
                                        </div>
                                        {index < comments.length - 1 && <div className="comment-divider" />}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {comments.length === 0 && (
                            <div style={{ marginTop: '20px', color: '#6b7280', fontStyle: 'italic' }}>
                                No comments yet. Add your first comment above.
                            </div>
                        )}
                    </div>
                </div>

                {/* Status History */}
                {job.statusHistory && job.statusHistory.length > 0 && (
                    <div className="info-section">
                        <h2>Status History</h2>
                        <div className="status-history">
                            {job.statusHistory.map((history, index) => (
                                <div key={history.id} className="history-item">
                                    <div className="history-header">
                                        <span className="history-status" style={{ color: getStatusColor(history.to_status) }}>
                                            {history.to_status.replace('_', ' ')}
                                        </span>
                                        <span className="history-date">
                                            {new Date(history.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    {history.changed_by && (
                                        <div className="history-user">
                                            By: {history.changed_by.name}
                                        </div>
                                    )}
                                    {history.reason && (
                                        <div className="history-reason">
                                            {history.reason}
                                        </div>
                                    )}
                                    {index < job.statusHistory!.length - 1 && <div className="history-divider" />}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Order Details */}
                {job.order && (
                    <div className="info-section">
                        <h2>Order Details</h2>
                        <div className="order-details">
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="label">Order Number:</span>
                                    <span className="value">
                                        <a 
                                            href={`/counter/orders/${job.order.id}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigate(`/counter/orders/${job.order!.id}`);
                                            }}
                                            className="order-link"
                                        >
                                            📦 {job.order.order_number}
                                        </a>
                                    </span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Order Status:</span>
                                    <span className="value">{job.order.status.replace('_', ' ')}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Order Type:</span>
                                    <span className="value">{job.order.order_type.replace('_', ' ')}</span>
                                </div>
                                {job.order.customer && (
                                    <div className="info-item">
                                        <span className="label">Customer:</span>
                                        <span className="value">
                                            {job.order.customer.name}
                                            {job.order.customer.type && ` (${job.order.customer.type})`}
                                        </span>
                                    </div>
                                )}
                                {job.order.customer?.phone && (
                                    <div className="info-item">
                                        <span className="label">Customer Phone:</span>
                                        <span className="value">📞 {job.order.customer.phone}</span>
                                    </div>
                                )}
                                {job.order.customer?.email && (
                                    <div className="info-item">
                                        <span className="label">Customer Email:</span>
                                        <span className="value">📧 {job.order.customer.email}</span>
                                    </div>
                                )}
                                {job.order.creator && (
                                    <div className="info-item">
                                        <span className="label">Created By:</span>
                                        <span className="value">👤 {job.order.creator.name}</span>
                                    </div>
                                )}
                                <div className="info-item">
                                    <span className="label">Created At:</span>
                                    <span className="value">📅 {new Date(job.order.created_at).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Order Items */}
                            {job.order.items && job.order.items.length > 0 && (
                                <div className="order-items-table">
                                    <h3>Order Items</h3>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Description</th>
                                                <th>Quantity</th>
                                                <th>Unit Price</th>
                                                <th>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {job.order.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{item.description || item.product?.name || 'Item'}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{formatCurrency(item.unit_price)}</td>
                                                    <td>{formatCurrency(item.line_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={3}><strong>Subtotal:</strong></td>
                                                <td><strong>{formatCurrency(job.order.subtotal)}</strong></td>
                                            </tr>
                                            {job.order.discount > 0 && (
                                                <tr>
                                                    <td colSpan={3}><strong>Discount:</strong></td>
                                                    <td><strong>-{formatCurrency(job.order.discount)}</strong></td>
                                                </tr>
                                            )}
                                            <tr>
                                                <td colSpan={3}><strong>Tax:</strong></td>
                                                <td><strong>{formatCurrency(job.order.tax)}</strong></td>
                                            </tr>
                                            <tr className="grand-total">
                                                <td colSpan={3}><strong>Total:</strong></td>
                                                <td><strong>{formatCurrency(job.order.total)}</strong></td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3}><strong>Paid:</strong></td>
                                                <td>{formatCurrency(job.order.paid_amount)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3}><strong>Balance:</strong></td>
                                                <td>{formatCurrency(job.order.balance)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {job.order.notes && (
                                <div className="order-notes">
                                    <strong>Order Notes:</strong>
                                    <p>{job.order.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobDetail;

