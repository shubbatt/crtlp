import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import PaymentModal, { PaymentData } from '../../../components/shared/PaymentModal';
import { generateReceiptHTML, generateInvoiceHTML, printHTML } from '../../../components/shared/templates/printTemplates';
import './OrderDetail.css';

interface StatusHistory {
    id: number;
    from_status: string | null;
    to_status: string;
    action: string;
    notes: string | null;
    created_at: string;
    user?: { name: string };
}

interface Payment {
    id: number;
    amount: number;
    payment_method: string;
    payment_date: string;
    reference_number?: string;
}

interface ServiceJob {
    id: number;
    job_number: string;
    status: string;
    orderItem?: { description: string; product?: { name: string } };
    assignedUser?: { name: string };
}

interface JobStatusSummary {
    total_jobs: number;
    completed_jobs: number;
    in_progress_jobs: number;
    pending_jobs: number;
    all_completed: boolean;
    status_breakdown: Record<string, number>;
}

interface Order {
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
    customer?: { id: number; name: string; email: string; phone: string; type?: string };
    outlet?: { id: number; name: string; code: string; address?: string; phone?: string; email?: string };
    items?: OrderItem[];
    payments?: Payment[];
    status_history?: StatusHistory[];
    service_jobs?: ServiceJob[];
    serviceJobs?: ServiceJob[];
    job_status_summary?: JobStatusSummary;
    creator?: { name: string };
    invoice?: {
        id: number;
        invoice_number: string;
        status: string;
    };
    created_at: string;
    updated_at: string;
}

interface OrderItem {
    id: number;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product?: { name: string; sku: string };
}

const OrderDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [creatingInvoice, setCreatingInvoice] = useState(false);

    useEffect(() => {
        if (id) {
            fetchOrder();
        }
    }, [id]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get(`${API_ENDPOINTS.ORDERS}/${id}`);
            setOrder(data);
            
            // If order has invoice, fetch full invoice details with payments
            if (data.invoice?.id) {
                try {
                    const invoiceResponse = await apiClient.get(`${API_ENDPOINTS.INVOICES}/${data.invoice.id}`);
                    setOrder({ ...data, invoice: invoiceResponse.data });
                } catch (error) {
                    console.error('Failed to fetch invoice details:', error);
                }
            }
        } catch (error) {
            console.error('Failed to fetch order:', error);
        }
        setLoading(false);
    };

    const updateStatus = async (newStatus: string) => {
        try {
            const response = await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(Number(id)), { status: newStatus });
            fetchOrder();
            return response;
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
            console.error('Status update error:', error.response?.data || error);
            alert(`Failed to update status to ${newStatus}: ${errorMessage}`);
            throw error;
        }
    };

    const recordPayment = async (paymentData: PaymentData) => {
        if (!order) return;

        const amount = paymentData.amount;
        const balance = Number(order.balance || 0);
        if (amount > balance) {
            alert('Payment amount cannot exceed order balance');
            return;
        }

        // Build reference number with payment type info for card/transfer
        let finalReferenceNumber = null;
        if (paymentData.method === 'card' || paymentData.method === 'transfer') {
            finalReferenceNumber = `${paymentData.bank} - ${paymentData.reference_number}`;
        } else if (paymentData.reference_number) {
            finalReferenceNumber = paymentData.reference_number;
        }

        // Map frontend payment method to backend format
        const backendPaymentMethod = paymentData.method === 'transfer' ? 'bank_transfer' : paymentData.method;

        try {
            await apiClient.post(API_ENDPOINTS.ORDER_PAYMENTS(Number(id)), {
                amount: amount,
                payment_method: backendPaymentMethod,
                reference_number: finalReferenceNumber,
            });
            
            setShowPaymentModal(false);
            
            // Refresh order to get updated balance
            await fetchOrder();
            
            // If order is now fully paid and status is READY, offer to release
            const updatedOrder = await apiClient.get(`${API_ENDPOINTS.ORDERS}/${id}`);
            if (updatedOrder.data.status === 'READY' && (updatedOrder.data.balance || 0) <= 0) {
                const release = confirm(
                    `✅ Payment of ${formatCurrency(amount)} recorded successfully!\n\n` +
                    `Order is now fully paid and ready to release.\n\n` +
                    `Would you like to release it now?`
                );
                if (release) {
                    try {
                        await updateStatus('RELEASED');
                    } catch (error: any) {
                        alert('Payment recorded, but failed to release: ' + (error.response?.data?.error || error.message));
                    }
                }
            } else {
                alert(`✅ Payment of ${formatCurrency(amount)} recorded successfully!`);
            }
        } catch (error: any) {
            alert('Failed to record payment: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleCreateInvoice = async () => {
        if (!order || !id) return;
        
        // Check if invoice already exists
        if (order.invoice) {
            alert(`⚠️ An invoice already exists for this order.\n\nInvoice #: ${order.invoice.invoice_number}\n\nWould you like to view it?`);
            return;
        }
        
        setCreatingInvoice(true);
        try {
            const { data } = await apiClient.post(API_ENDPOINTS.ORDER_INVOICE(Number(id)));
            await fetchOrder(); // Refresh order to get invoice data
            alert('✅ Invoice created successfully!');
            
            // Automatically print invoice
            if (data.invoice) {
                printInvoice(data.invoice);
            }
        } catch (error: any) {
            if (error.response?.status === 409 && error.response?.data?.error === 'duplicate') {
                const existingInvoice = error.response?.data?.invoice;
                alert(`⚠️ An invoice already exists for this order.\n\nInvoice #: ${existingInvoice?.invoice_number || 'N/A'}\n\nPlease use the existing invoice.`);
                await fetchOrder(); // Refresh to get the invoice
            } else {
                alert('Failed to create invoice: ' + (error.response?.data?.error || error.message));
            }
        }
        setCreatingInvoice(false);
    };

    const printInvoice = async (invoice?: any) => {
        const invoiceToPrint = invoice || order?.invoice;
        if (!invoiceToPrint) {
            // Fetch invoice if not provided
            if (!order?.invoice?.id) return;
            try {
                const { data } = await apiClient.get(`${API_ENDPOINTS.INVOICES}/${order.invoice.id}`);
                const invoiceHTML = generateInvoiceHTML(data);
                printHTML(invoiceHTML);
            } catch (error: any) {
                alert('Failed to load invoice: ' + (error.response?.data?.error || error.message));
            }
        } else {
            const invoiceHTML = generateInvoiceHTML(invoiceToPrint);
            printHTML(invoiceHTML);
        }
    };


    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: '#6b7280',
            PENDING_PAYMENT: '#f59e0b',
            PAID: '#3b82f6',
            IN_PRODUCTION: '#8b5cf6',
            READY: '#10b981',
            RELEASED: '#06b6d4',
            COMPLETED: '#059669',
            CANCELLED: '#ef4444',
        };
        return colors[status] || '#6b7280';
    };

    const getNextStatus = (currentStatus: string, jobSummary?: JobStatusSummary, order?: Order) => {
        // Check if this is a credit invoice order
        const isCreditInvoiceOrder = order?.order_type === 'invoice' && 
                                    order?.customer?.type === 'credit';

        // If order is in production, only allow status change if all jobs are completed
        if (currentStatus === 'IN_PRODUCTION') {
            if (!jobSummary || !jobSummary.all_completed) {
                return null; // Don't allow status change until all jobs are complete
            }
            return 'READY'; // Production complete, can mark as ready
        }
        
        // Credit invoice orders workflow: DRAFT -> IN_PRODUCTION -> READY -> RELEASED -> COMPLETED
        // No payment required, invoice created automatically on RELEASED
        if (isCreditInvoiceOrder) {
            const creditFlow: Record<string, string> = {
                DRAFT: 'IN_PRODUCTION', // Skip payment, go directly to production
                READY: 'RELEASED', // Deliver (invoice will be created automatically on release)
                RELEASED: 'COMPLETED',
            };
            return creditFlow[currentStatus] || null;
        }
        
        // Regular orders workflow: DRAFT -> PENDING_PAYMENT/PAID -> IN_PRODUCTION -> READY -> RELEASED -> COMPLETED
        const flow: Record<string, string> = {
            DRAFT: 'PENDING_PAYMENT',
            PENDING_PAYMENT: 'PAID',
            PAID: 'IN_PRODUCTION',
            READY: 'RELEASED', // Can release if fully paid
            RELEASED: 'COMPLETED',
        };
        return flow[currentStatus] || null;
    };

    const canRelease = (order: Order): boolean => {
        // Can release if balance is 0 or less (fully paid)
        // OR if it's an invoice order (credit customer) - they pay via invoice
        const isInvoiceOrder = order.order_type === 'invoice' && 
                              order.customer && 
                              order.customer.type === 'credit';
        return order.status === 'READY' && 
               (Number(order.balance || 0) <= 0 || !!isInvoiceOrder);
    };

    const handlePrintReceipt = () => {
        if (!order) return;
        // Transform order to match template interface
        const orderForPrint = {
            ...order,
            payments: order.payments?.map((p: Payment) => ({
                method: p.payment_method,
                amount: p.amount,
                created_at: p.payment_date
            }))
        };
        const receiptHTML = generateReceiptHTML(orderForPrint as any);
        printHTML(receiptHTML);
    };


    const handleRelease = async () => {
        if (!order) return;

        // Check if payment is required
        // Exception: Credit customers with invoice orders can be released without payment
        const isInvoiceOrder = order.order_type === 'invoice' && 
                              order.customer && 
                              order.customer.type === 'credit';
        
        const balance = Number(order.balance || 0);
        if (balance > 0 && !isInvoiceOrder) {
            const proceed = confirm(
                `This order has an outstanding balance of ${formatCurrency(balance)}.\n\n` +
                `Payment must be recorded before releasing the order.\n\n` +
                `Would you like to record payment now?`
            );
            
            if (proceed) {
                setShowPaymentModal(true);
            }
            return;
        }

        // For invoice orders or fully paid orders, can release directly
        try {
            await updateStatus('RELEASED');
            // Refresh order to get the newly created draft invoice
            await fetchOrder();
            if (isInvoiceOrder) {
                alert('✅ Order released! Draft invoice has been created. Please review and approve it before it is issued.');
            } else {
                alert('✅ Order released! Draft invoice has been created. Please review and approve it.');
            }
        } catch (error: any) {
            alert('Failed to release order: ' + (error.response?.data?.error || error.message));
        }
    };

    const getActionIcon = (action: string) => {
        const icons: Record<string, string> = {
            'Order created': '📝',
            'Pay later - awaiting payment': '⏳',
            'Payment received': '💵',
            'Sent to production': '📦',
            'Production complete - ready': '✅',
            'Released to customer': '🚚',
            'Order completed': '🎉',
            'Order cancelled': '❌',
        };
        return icons[action] || '🔄';
    };

    if (loading) {
        return <div className="order-detail-loading">Loading order...</div>;
    }

    if (!order) {
        return <div className="order-detail-error">Order not found</div>;
    }

    const nextStatus = getNextStatus(order.status, order.job_status_summary, order);

    return (
        <div className="order-detail">
            <div className="detail-header">
                <button onClick={() => navigate(-1)} className="btn-back">
                    ← Back
                </button>
                <div className="header-info">
                    <h1>{order.order_number}</h1>
                    <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                        {order.status.replace('_', ' ')}
                    </span>
                </div>
                {nextStatus && (
                    <button
                        className="btn-next-status"
                        onClick={() => updateStatus(nextStatus)}
                    >
                        Move to {nextStatus.replace('_', ' ')} →
                    </button>
                )}
                {order.status === 'IN_PRODUCTION' && order.job_status_summary && !order.job_status_summary.all_completed && (
                    <div className="production-warning">
                        ⏳ Waiting for production ({order.job_status_summary.completed_jobs}/{order.job_status_summary.total_jobs} items ready)
                    </div>
                )}
            </div>

            <div className="detail-grid">
                {/* Order Info */}
                <div className="detail-card info">
                    <h2>Order Information</h2>
                    <div className="info-row">
                        <span>Type:</span>
                        <span>
                            {order.order_type === 'invoice' 
                                ? 'Invoice (Credit)' 
                                : order.customer 
                                ? `Customer Order (${order.customer.name})` 
                                : 'Walk-in'}
                        </span>
                    </div>
                    <div className="info-row">
                        <span>Created by:</span>
                        <span>{order.creator?.name || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                        <span>Created:</span>
                        <span>{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    {order.notes && (
                        <div className="notes">
                            <span>Notes:</span>
                            <p>{order.notes}</p>
                        </div>
                    )}
                </div>

                {/* Customer Info */}
                <div className="detail-card customer">
                    <h2>Customer</h2>
                    {order.customer ? (
                        <>
                            <div className="customer-name">{order.customer.name}</div>
                            {order.customer.email && <div className="customer-contact">📧 {order.customer.email}</div>}
                            {order.customer.phone && <div className="customer-contact">📱 {order.customer.phone}</div>}
                        </>
                    ) : (
                        <div className="walk-in">Walk-in</div>
                    )}
                </div>

                {/* Payment Info */}
                <div className="detail-card payment">
                    <h2>Payment</h2>
                    <div className="payment-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="payment-row">
                        <span>Discount:</span>
                        <span>-{formatCurrency(order.discount)}</span>
                    </div>
                    <div className="payment-row">
                        <span>Tax:</span>
                        <span>{formatCurrency(order.tax)}</span>
                    </div>
                    <div className="payment-row total">
                        <span>Total:</span>
                        <span>{formatCurrency(order.total)}</span>
                    </div>
                    <div className="payment-row paid">
                        <span>Paid:</span>
                        <span>{formatCurrency(order.paid_amount)}</span>
                    </div>
                    <div className={`payment-row balance ${Number(order.balance || 0) > 0 ? 'due' : ''}`}>
                        <span>Balance:</span>
                        <span>{formatCurrency(order.balance)}</span>
                    </div>
                    {order.status === 'READY' && Number(order.balance || 0) > 0 && (
                        <>
                            {/* Don't show payment warning for invoice orders (credit customers) */}
                            {!(order.order_type === 'invoice' && order.customer?.type === 'credit') && (
                                <div className="payment-warning">
                                    ⚠️ Payment required before release
                                </div>
                            )}
                            {/* Show payment button only for non-invoice orders */}
                            {!(order.order_type === 'invoice' && order.customer?.type === 'credit') && (
                                <button 
                                    className="btn-payment"
                                    onClick={() => setShowPaymentModal(true)}
                                >
                                    💵 Record Payment
                                </button>
                            )}
                        </>
                    )}
                    {order.status === 'READY' && Number(order.balance || 0) <= 0 && (
                        <div className="payment-success">
                            ✅ Fully paid - ready to release
                        </div>
                    )}
                    {/* Show payment button for any status with balance > 0 (except READY which is handled above)
                        Don't show for invoice orders (credit customers) as they don't need payment */}
                    {Number(order.balance || 0) > 0 && 
                     order.status !== 'CANCELLED' && 
                     order.status !== 'READY' && 
                     order.status !== 'COMPLETED' &&
                     !(order.order_type === 'invoice' && order.customer?.type === 'credit') && (
                        <button 
                            className="btn-payment"
                            onClick={() => setShowPaymentModal(true)}
                        >
                            💵 Record Payment
                        </button>
                    )}
                    
                    {/* Invoice Section - Show for all orders */}
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                        {/* For credit invoice orders, show info message */}
                        {order.order_type === 'invoice' && order.customer?.type === 'credit' && !order.invoice && (
                            <div style={{ 
                                padding: '12px', 
                                background: '#f0f9ff', 
                                borderRadius: '8px',
                                marginBottom: '10px',
                                fontSize: '14px',
                                color: '#0369a1'
                            }}>
                                ℹ️ Invoice will be created automatically when order is delivered (RELEASED)
                            </div>
                        )}
                        {order.invoice ? (
                            <div>
                                <div style={{ marginBottom: '10px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ color: '#3b82f6', fontWeight: '600' }}>
                                        📄 Invoice: {order.invoice.invoice_number}
                                    </span>
                                    <span 
                                        style={{ 
                                            padding: '4px 8px', 
                                            background: order.invoice.status === 'draft' ? '#fef3c7' : '#d1fae5',
                                            color: order.invoice.status === 'draft' ? '#92400e' : '#065f46',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        {order.invoice.status === 'draft' ? 'DRAFT - Needs Approval' : order.invoice.status.toUpperCase()}
                                    </span>
                                </div>
                                <button 
                                    className="btn-payment"
                                    onClick={() => {
                                        // Navigate to invoice detail in same view
                                        if (order.invoice?.id) {
                                            navigate(`/counter/invoices/${order.invoice.id}`);
                                        }
                                    }}
                                    style={{ marginRight: '10px' }}
                                >
                                    📄 View Invoice {order.invoice.status === 'draft' ? '(Review & Approve)' : ''}
                                </button>
                                {order.invoice.status !== 'draft' && (
                                    <button 
                                        className="btn-payment"
                                        onClick={() => printInvoice()}
                                    >
                                        🖨️ Print Invoice
                                    </button>
                                )}
                            </div>
                        ) : (
                            // Only show "Create Invoice" button for non-credit orders
                            // Credit invoice orders will have invoice created automatically on RELEASED
                            !(order.order_type === 'invoice' && order.customer?.type === 'credit') && (
                                <button 
                                    className="btn-payment"
                                    onClick={handleCreateInvoice}
                                    disabled={creatingInvoice || order.status === 'CANCELLED'}
                                >
                                    {creatingInvoice ? 'Creating...' : '📄 Create Invoice'}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Job Status (if order has jobs) */}
            {order.job_status_summary && order.job_status_summary.total_jobs > 0 && (
                <div className="detail-card jobs">
                    <h2>📦 Production Status</h2>
                    <div className="job-status-summary">
                        <div className="job-status-row">
                            <span className="job-status-label">Total Jobs:</span>
                            <span className="job-status-value">{order.job_status_summary.total_jobs}</span>
                        </div>
                        <div className="job-status-row">
                            <span className="job-status-label">✅ Completed:</span>
                            <span className="job-status-value completed">{order.job_status_summary.completed_jobs}</span>
                        </div>
                        <div className="job-status-row">
                            <span className="job-status-label">⚙️ In Progress:</span>
                            <span className="job-status-value in-progress">{order.job_status_summary.in_progress_jobs}</span>
                        </div>
                        <div className="job-status-row">
                            <span className="job-status-label">⏳ Pending:</span>
                            <span className="job-status-value pending">{order.job_status_summary.pending_jobs}</span>
                        </div>
                        <div className="job-status-progress">
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill"
                                    style={{ 
                                        width: `${(order.job_status_summary.completed_jobs / order.job_status_summary.total_jobs) * 100}%`,
                                        backgroundColor: order.job_status_summary.all_completed ? '#10b981' : '#3b82f6'
                                    }}
                                />
                            </div>
                            <div className="progress-text">
                                {order.job_status_summary.completed_jobs} of {order.job_status_summary.total_jobs} items ready
                            </div>
                        </div>
                        {order.job_status_summary.all_completed && order.status === 'IN_PRODUCTION' && (
                            <div className="job-status-alert success">
                                ✅ All items completed! Order will be marked as READY.
                            </div>
                        )}
                    </div>
                    {(order.service_jobs || order.serviceJobs) && (order.service_jobs || order.serviceJobs)!.length > 0 && (
                        <div className="job-list">
                            <h3>Job Details</h3>
                            <table className="jobs-table">
                                <thead>
                                    <tr>
                                        <th>Job #</th>
                                        <th>Item</th>
                                        <th>Status</th>
                                        <th>Assigned To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(order.service_jobs || order.serviceJobs)!.map(job => (
                                        <tr key={job.id}>
                                            <td>{job.job_number}</td>
                                            <td>{job.orderItem?.description || job.orderItem?.product?.name || 'N/A'}</td>
                                            <td>
                                                <span className="job-status-badge" style={{
                                                    backgroundColor: job.status === 'COMPLETED' ? '#10b981' :
                                                                    job.status === 'IN_PROGRESS' ? '#3b82f6' :
                                                                    job.status === 'QA_REVIEW' ? '#f59e0b' :
                                                                    '#6b7280'
                                                }}>
                                                    {job.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>{job.assignedUser?.name || 'Unassigned'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Order Items */}
            <div className="detail-card items">
                <h2>Order Items ({order.items?.length || 0})</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items?.map(item => (
                            <tr key={item.id}>
                                <td className="product-name">{item.product?.name || 'N/A'}</td>
                                <td>{item.description}</td>
                                <td>{item.quantity}</td>
                                <td>{formatCurrency(item.unit_price)}</td>
                                <td className="line-total">{formatCurrency(item.line_total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Activity Timeline */}
            <div className="detail-card activity">
                <h2>📋 Activity Log</h2>
                <div className="timeline">
                    {(!order.status_history || order.status_history.length === 0) ? (
                        <div className="timeline-item">
                            <div className="timeline-icon">📝</div>
                            <div className="timeline-content">
                                <div className="timeline-message">Order created</div>
                                <div className="timeline-time">
                                    {new Date(order.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        order.status_history.map((history) => (
                            <div key={history.id} className="timeline-item">
                                <div className="timeline-icon">{getActionIcon(history.action)}</div>
                                <div className="timeline-content">
                                    <div className="timeline-message">
                                        <strong>{history.action}</strong>
                                        {history.from_status && (
                                            <span className="status-change">
                                                {' '}({history.from_status} → {history.to_status})
                                            </span>
                                        )}
                                    </div>
                                    <div className="timeline-meta">
                                        <span className="timeline-user">
                                            👤 {history.user?.name || 'System'}
                                        </span>
                                        <span className="timeline-time">
                                            {new Date(history.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    {history.notes && (
                                        <div className="timeline-notes">💬 {history.notes}</div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="detail-actions">
                <button className="btn-print" onClick={handlePrintReceipt}>
                    🖨️ Print Receipt
                </button>
                {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                    <>
                        {order.status === 'READY' ? (
                            // Special handling for READY status - check payment
                            <button
                                className={canRelease(order) ? "btn-next" : "btn-payment"}
                                onClick={handleRelease}
                                title={(() => {
                                    const isInvoiceOrder = order.order_type === 'invoice' && 
                                                          order.customer && 
                                                          order.customer.type === 'credit';
                                    if (canRelease(order)) {
                                        return isInvoiceOrder 
                                            ? "Release order (invoice will be created/updated)" 
                                            : "Release order (fully paid)";
                                    }
                                    return "Payment required before release";
                                })()}
                            >
                                {canRelease(order) ? '🚚 Release Order' : '💵 Pay & Release'}
                            </button>
                        ) : getNextStatus(order.status, order.job_status_summary, order) ? (
                            <button
                                className="btn-next"
                                onClick={() => updateStatus(getNextStatus(order.status, order.job_status_summary, order)!)}
                            >
                                ➡️ {getNextStatus(order.status, order.job_status_summary, order)}
                            </button>
                        ) : null}
                        <button
                            className="btn-cancel"
                            onClick={() => updateStatus('CANCELLED')}
                        >
                            ❌ Cancel Order
                        </button>
                    </>
                )}
            </div>

            {/* Payment Modal */}
            {order && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    onSubmit={recordPayment}
                    amount={order.balance}
                    orderNumber={order.order_number}
                    title="Record Payment"
                    submitButtonText="Record Payment"
                />
            )}
        </div>
    );
};

export default OrderDetail;
