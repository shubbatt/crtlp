import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import PaymentModal, { PaymentData } from '../../../components/shared/PaymentModal';
import { generateInvoiceHTML, generateDeliveryNoteHTML, printHTML } from '../../../components/shared/templates/printTemplates';
import './InvoiceDetail.css';

interface Invoice {
    id: number;
    invoice_number: string;
    purchase_order_number?: string | null;
    status: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    issue_date: string;
    due_date: string;
    item_overrides?: Record<number, {
        unit_price: number;
        discount_type?: 'percentage' | 'fixed';
        discount_value?: number;
    }>;
    customer?: { id: number; name: string; email: string; phone: string };
    outlet?: { id: number; name: string; code: string; address?: string; phone?: string; email?: string };
    order?: {
        id: number;
        order_number: string;
        items?: Array<{
            id: number;
            description: string;
            quantity: number;
            unit_price: number;
            line_total: number;
        }>;
    };
    payments?: Array<{
        id: number;
        amount: number;
        payment_method: string;
        payment_date: string;
        reference_number?: string;
    }>;
}

const InvoiceDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPO, setEditingPO] = useState(false);
    const [poNumber, setPONumber] = useState('');
    const [currentUser, setCurrentUser] = useState<{ name: string } | null>(null);
    const [isEditingDraft, setIsEditingDraft] = useState(false);
    const [draftSubtotal, setDraftSubtotal] = useState(0);
    const [draftDiscount, setDraftDiscount] = useState(0);
    const [draftTax, setDraftTax] = useState(0);
    const [savingDraft, setSavingDraft] = useState(false);
    const [taxRate, setTaxRate] = useState(10); // Default 10%
    const [approving, setApproving] = useState(false);
    const [itemEdits, setItemEdits] = useState<Record<number, {
        unit_price: number;
        discount_type: 'percentage' | 'fixed';
        discount_value: number;
    }>>({});

    useEffect(() => {
        if (id) {
            fetchInvoice();
        }
        fetchSettings();
        // Get current user from localStorage or API
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
            } catch (e) {
                // If parsing fails, try to get from API
                apiClient.get(API_ENDPOINTS.ME).then(({ data }) => {
                    setCurrentUser(data);
                }).catch(() => { });
            }
        } else {
            // Try to get from API
            apiClient.get(API_ENDPOINTS.ME).then(({ data }) => {
                setCurrentUser(data);
            }).catch(() => { });
        }
    }, [id]);

    const fetchInvoice = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get(`${API_ENDPOINTS.INVOICES}/${id}`);
            setInvoice(data);
            setPONumber(data.purchase_order_number || '');
            // Initialize draft editing fields
            if (data.status === 'draft') {
                setDraftSubtotal(Number(data.subtotal || 0));
                setDraftDiscount(Number(data.discount || 0));
                setDraftTax(Number(data.tax || 0));
            }
        } catch (error) {
            console.error('Failed to fetch invoice:', error);
            alert('Failed to load invoice');
        }
        setLoading(false);
    };

    const fetchSettings = async () => {
        try {
            const { data } = await apiClient.get('/settings');
            if (data && data.tax_rate) {
                setTaxRate(parseFloat(data.tax_rate));
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const handleUpdatePO = async () => {
        if (!invoice) return;

        try {
            await apiClient.put(API_ENDPOINTS.INVOICE_UPDATE(invoice.id), {
                purchase_order_number: poNumber || null,
            });
            setEditingPO(false);
            fetchInvoice();
            alert('✅ Purchase Order Number updated!');
        } catch (error: any) {
            alert('Failed to update: ' + (error.response?.data?.error || error.message));
        }
    };

    const handlePrintInvoice = () => {
        if (!invoice) return;
        const invoiceHTML = generateInvoiceHTML(invoice as any);
        printHTML(invoiceHTML);
    };


    const handlePrintDeliveryNote = () => {
        if (!invoice || !currentUser) return;
        const deliveryNoteHTML = generateDeliveryNoteHTML(invoice as any, currentUser.name);
        printHTML(deliveryNoteHTML);
    };


    const handleRecordPayment = async (paymentData: PaymentData) => {
        if (!invoice) return;

        const amount = paymentData.amount;
        const invoiceBalance = Number(invoice.balance || 0);
        if (amount <= 0 || amount > invoiceBalance) {
            alert('Invalid payment amount');
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
            await apiClient.post(API_ENDPOINTS.INVOICE_PAYMENTS(invoice.id), {
                amount: amount,
                payment_method: backendPaymentMethod,
                reference_number: finalReferenceNumber,
            });

            alert('✅ Payment recorded successfully!');
            setShowPaymentModal(false);
            fetchInvoice();
        } catch (error: any) {
            alert('Failed to record payment: ' + (error.response?.data?.error || error.message));
        }
    };

    const calculateItemLineTotal = (item: any, itemId: number) => {
        const edit = itemEdits[itemId];
        if (!edit) return item.line_total;

        const baseTotal = edit.unit_price * item.quantity;
        let discountAmount = 0;

        if (edit.discount_value > 0) {
            if (edit.discount_type === 'percentage') {
                discountAmount = baseTotal * (edit.discount_value / 100);
            } else {
                discountAmount = edit.discount_value;
            }
        }

        return baseTotal - discountAmount;
    };

    const calculateTotals = () => {
        if (!invoice?.order?.items) return { subtotal: 0, tax: 0, total: 0 };

        let subtotal = 0;
        invoice.order.items.forEach((item) => {
            subtotal += calculateItemLineTotal(item, item.id);
        });

        const discount = draftDiscount;
        const tax = (subtotal - discount) * (taxRate / 100);
        const total = subtotal - discount + tax;

        return { subtotal, tax, total };
    };

    const handleSaveDraft = async () => {
        if (!invoice) return;

        setSavingDraft(true);
        try {
            // Build item_overrides object
            const itemOverrides: Record<number, any> = {};
            if (invoice.order?.items) {
                invoice.order.items.forEach((item) => {
                    const edit = itemEdits[item.id];
                    if (edit && (edit.unit_price !== item.unit_price || edit.discount_value > 0)) {
                        itemOverrides[item.id] = {
                            unit_price: edit.unit_price,
                            discount_type: edit.discount_type,
                            discount_value: edit.discount_value || 0,
                        };
                    }
                });
            }

            // Calculate totals from items
            const totals = calculateTotals();

            const { data } = await apiClient.put(API_ENDPOINTS.INVOICE_DRAFT_UPDATE(invoice.id), {
                item_overrides: Object.keys(itemOverrides).length > 0 ? itemOverrides : undefined,
                discount: draftDiscount,
            });

            setInvoice(data);
            setIsEditingDraft(false);
            // Update local state with new totals
            setDraftSubtotal(totals.subtotal);
            setDraftTax(totals.tax);
            alert('✅ Draft invoice updated successfully!');
        } catch (error: any) {
            alert('Failed to update draft: ' + (error.response?.data?.error || error.message));
        }
        setSavingDraft(false);
    };

    const handleApproveDraft = async () => {
        if (!invoice) return;

        if (!confirm('Are you sure you want to approve this draft invoice? Once approved, it will be issued and customer credit balance will be updated.')) {
            return;
        }

        setApproving(true);
        try {
            const { data } = await apiClient.post(API_ENDPOINTS.INVOICE_APPROVE(invoice.id));
            setInvoice(data);
            alert('✅ Invoice approved and issued successfully!');
        } catch (error: any) {
            alert('Failed to approve invoice: ' + (error.response?.data?.error || error.message));
        }
        setApproving(false);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: '#6b7280',
            issued: '#3b82f6',
            partial: '#f59e0b',
            paid: '#10b981',
            overdue: '#ef4444',
            disputed: '#ec4899',
        };
        return colors[status] || '#6b7280';
    };

    const isOverdue = invoice && invoice.status !== 'paid' && new Date(invoice.due_date) < new Date();

    if (loading) {
        return <div className="loading">Loading invoice...</div>;
    }

    if (!invoice) {
        return <div className="empty">Invoice not found</div>;
    }

    return (
        <div className="invoice-detail">
            <div className="detail-header">
                <button className="btn-back" onClick={() => navigate('/counter/invoices')}>
                    ← Back to Invoices
                </button>
                <h1>Invoice: {invoice.invoice_number}</h1>
            </div>

            <div className="detail-content">
                <div className="detail-section">
                    <h2>Invoice Information</h2>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>Status</label>
                            <span
                                className="status-badge"
                                style={{ backgroundColor: getStatusColor(invoice.status) }}
                            >
                                {invoice.status.toUpperCase()}
                            </span>
                        </div>
                        <div className="info-item">
                            <label>Issue Date</label>
                            <span>{new Date(invoice.issue_date).toLocaleDateString()}</span>
                        </div>
                        <div className="info-item">
                            <label>Due Date</label>
                            <span className={isOverdue ? 'overdue' : ''}>
                                {new Date(invoice.due_date).toLocaleDateString()}
                                {isOverdue && ' ⚠️ OVERDUE'}
                            </span>
                        </div>
                        {invoice.order && (
                            <div className="info-item">
                                <label>Order Number</label>
                                <span
                                    style={{ cursor: 'pointer', color: '#667eea' }}
                                    onClick={() => navigate(`/counter/orders/${invoice.order?.id}`)}
                                >
                                    {invoice.order.order_number}
                                </span>
                            </div>
                        )}
                        <div className="info-item">
                            <label>Purchase Order #</label>
                            {editingPO ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        value={poNumber}
                                        onChange={(e) => setPONumber(e.target.value)}
                                        placeholder="Enter PO Number"
                                        style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                                    />
                                    <button
                                        onClick={handleUpdatePO}
                                        style={{ padding: '4px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingPO(false);
                                            setPONumber(invoice.purchase_order_number || '');
                                        }}
                                        style={{ padding: '4px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <span
                                    style={{ cursor: 'pointer', color: invoice.purchase_order_number ? '#333' : '#999' }}
                                    onClick={() => setEditingPO(true)}
                                    title="Click to edit"
                                >
                                    {invoice.purchase_order_number || 'Click to add PO Number'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {invoice.customer && (
                    <div className="detail-section">
                        <h2>Customer Information</h2>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Name</label>
                                <span>{invoice.customer.name}</span>
                            </div>
                            {invoice.customer.email && (
                                <div className="info-item">
                                    <label>Email</label>
                                    <span>{invoice.customer.email}</span>
                                </div>
                            )}
                            {invoice.customer.phone && (
                                <div className="info-item">
                                    <label>Phone</label>
                                    <span>{invoice.customer.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {invoice.order?.items && invoice.order.items.length > 0 && (
                    <div className="detail-section">
                        <h2>Items</h2>
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    {isEditingDraft && invoice.status === 'draft' && <th>Discount</th>}
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.order.items.map((item, index) => {
                                    const edit = itemEdits[item.id] || { unit_price: item.unit_price, discount_type: 'fixed' as const, discount_value: 0 };
                                    const lineTotal = isEditingDraft && invoice.status === 'draft'
                                        ? calculateItemLineTotal(item, item.id)
                                        : item.line_total;

                                    return (
                                        <tr key={index}>
                                            <td>{item.description}</td>
                                            <td>{item.quantity}</td>
                                            <td>
                                                {isEditingDraft && invoice.status === 'draft' ? (
                                                    <input
                                                        type="number"
                                                        value={edit.unit_price}
                                                        onChange={(e) => {
                                                            const price = Number(e.target.value) || 0;
                                                            setItemEdits({
                                                                ...itemEdits,
                                                                [item.id]: { ...edit, unit_price: price }
                                                            });
                                                            // Auto-update totals
                                                            const totals = calculateTotals();
                                                            setDraftSubtotal(totals.subtotal);
                                                            setDraftTax(totals.tax);
                                                        }}
                                                        min="0"
                                                        step="0.01"
                                                        style={{
                                                            width: '100px',
                                                            padding: '4px',
                                                            border: '1px solid #3b82f6',
                                                            borderRadius: '4px'
                                                        }}
                                                    />
                                                ) : (
                                                    formatCurrency(item.unit_price)
                                                )}
                                            </td>
                                            {isEditingDraft && invoice.status === 'draft' && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <select
                                                            value={edit.discount_type}
                                                            onChange={(e) => {
                                                                setItemEdits({
                                                                    ...itemEdits,
                                                                    [item.id]: {
                                                                        ...edit,
                                                                        discount_type: e.target.value as 'percentage' | 'fixed',
                                                                        discount_value: 0
                                                                    }
                                                                });
                                                            }}
                                                            style={{
                                                                padding: '4px',
                                                                border: '1px solid #3b82f6',
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            <option value="fixed">Amount</option>
                                                            <option value="percentage">%</option>
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={edit.discount_value || ''}
                                                            onChange={(e) => {
                                                                const value = Number(e.target.value) || 0;
                                                                setItemEdits({
                                                                    ...itemEdits,
                                                                    [item.id]: { ...edit, discount_value: value }
                                                                });
                                                                // Auto-update totals
                                                                const totals = calculateTotals();
                                                                setDraftSubtotal(totals.subtotal);
                                                                setDraftTax(totals.tax);
                                                            }}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0"
                                                            style={{
                                                                width: '80px',
                                                                padding: '4px',
                                                                border: '1px solid #3b82f6',
                                                                borderRadius: '4px'
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                            )}
                                            <td>{formatCurrency(lineTotal)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2>Summary</h2>
                        {invoice.status === 'draft' && !isEditingDraft && (
                            <button
                                onClick={() => setIsEditingDraft(true)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                ✏️ Edit Draft
                            </button>
                        )}
                    </div>
                    <div className="summary-box">
                        {isEditingDraft && invoice.status === 'draft' ? (
                            <>
                                <div className="summary-row">
                                    <span>Subtotal (from items):</span>
                                    <span>{formatCurrency(calculateTotals().subtotal)}</span>
                                </div>
                                <div className="summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                    <label style={{ fontWeight: '600' }}>Order Discount:</label>
                                    <input
                                        type="number"
                                        value={draftDiscount}
                                        onChange={(e) => {
                                            const discount = Number(e.target.value) || 0;
                                            setDraftDiscount(discount);
                                            // Auto-update totals
                                            const totals = calculateTotals();
                                            setDraftSubtotal(totals.subtotal);
                                            setDraftTax(totals.tax);
                                        }}
                                        min="0"
                                        step="0.01"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '2px solid #3b82f6',
                                            borderRadius: '4px',
                                            fontSize: '16px'
                                        }}
                                    />
                                </div>
                                <div className="summary-row">
                                    <span>Tax ({taxRate}%):</span>
                                    <span>{formatCurrency(calculateTotals().tax)}</span>
                                </div>
                                <div className="summary-row grand-total">
                                    <span>Total:</span>
                                    <span>{formatCurrency(calculateTotals().total)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={savingDraft}
                                        style={{
                                            padding: '10px 20px',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: savingDraft ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            flex: 1
                                        }}
                                    >
                                        {savingDraft ? 'Saving...' : '💾 Save Draft'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingDraft(false);
                                            // Reset to original values
                                            setDraftSubtotal(Number(invoice.subtotal || 0));
                                            setDraftDiscount(Number(invoice.discount || 0));
                                            setDraftTax(Number(invoice.tax || 0));
                                            // Reset item edits
                                            const edits: Record<number, { unit_price: number; discount_type: 'percentage' | 'fixed'; discount_value: number }> = {};
                                            if (invoice.order?.items) {
                                                invoice.order.items.forEach((item: any) => {
                                                    if (invoice.item_overrides && invoice.item_overrides[item.id]) {
                                                        const override = invoice.item_overrides[item.id];
                                                        edits[item.id] = {
                                                            unit_price: override.unit_price || item.unit_price,
                                                            discount_type: override.discount_type || 'fixed',
                                                            discount_value: override.discount_value || 0,
                                                        };
                                                    } else {
                                                        edits[item.id] = {
                                                            unit_price: item.unit_price,
                                                            discount_type: 'fixed',
                                                            discount_value: 0,
                                                        };
                                                    }
                                                });
                                            }
                                            setItemEdits(edits);
                                        }}
                                        disabled={savingDraft}
                                        style={{
                                            padding: '10px 20px',
                                            background: '#6b7280',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: savingDraft ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            flex: 1
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="summary-row">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                {Number(invoice.discount || 0) > 0 && (
                                    <div className="summary-row">
                                        <span>Discount:</span>
                                        <span>-{formatCurrency(invoice.discount)}</span>
                                    </div>
                                )}
                                <div className="summary-row">
                                    <span>Tax:</span>
                                    <span>{formatCurrency(invoice.tax)}</span>
                                </div>
                                <div className="summary-row grand-total">
                                    <span>Total:</span>
                                    <span>{formatCurrency(invoice.total)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Paid:</span>
                                    <span>{formatCurrency(invoice.paid_amount)}</span>
                                </div>
                                <div className={`summary-row ${Number(invoice.balance || 0) > 0 ? 'balance-due' : ''}`}>
                                    <span>Balance:</span>
                                    <span>{formatCurrency(invoice.balance)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {invoice.payments && invoice.payments.length > 0 && (
                    <div className="detail-section">
                        <h2>Payment History</h2>
                        <table className="payments-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.payments.map(payment => (
                                    <tr key={payment.id}>
                                        <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                                        <td>{formatCurrency(payment.amount)}</td>
                                        <td>{payment.payment_method.toUpperCase()}</td>
                                        <td>{payment.reference_number || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="detail-actions">
                    {invoice.status === 'draft' ? (
                        <>
                            <button
                                className="btn-approve"
                                onClick={handleApproveDraft}
                                disabled={approving || isEditingDraft}
                                style={{
                                    padding: '12px 24px',
                                    background: approving ? '#9ca3af' : '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: approving || isEditingDraft ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    fontSize: '16px'
                                }}
                            >
                                {approving ? 'Approving...' : '✅ Approve & Issue Invoice'}
                            </button>
                            <div style={{
                                padding: '12px 16px',
                                background: '#fef3c7',
                                border: '1px solid #fbbf24',
                                borderRadius: '6px',
                                color: '#92400e',
                                fontSize: '14px'
                            }}>
                                ⚠️ This is a draft invoice. Review and edit amounts if needed, then approve to issue.
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn-print"
                                onClick={handlePrintInvoice}
                            >
                                🖨️ Print Invoice
                            </button>
                            <button
                                className="btn-print"
                                onClick={handlePrintDeliveryNote}
                            >
                                📦 Print Delivery Note
                            </button>
                            {Number(invoice.balance || 0) > 0 && (
                                <button
                                    className="btn-payment"
                                    onClick={() => setShowPaymentModal(true)}
                                >
                                    💵 Record Payment
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {invoice && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    onSubmit={handleRecordPayment}
                    amount={invoice.balance}
                    orderNumber={invoice.invoice_number}
                    title="Record Payment"
                    submitButtonText="Record Payment"
                />
            )}
        </div>
    );
};

export default InvoiceDetail;

