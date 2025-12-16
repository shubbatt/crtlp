import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './CustomerDetail.css';

interface Customer {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    type: string;
    credit_limit: number;
    credit_balance: number;
    credit_period_days: number | null;
    tax_id: string | null;
    notes: string | null;
}

interface Invoice {
    id: number;
    invoice_number: string;
    status: string;
    total: number;
    balance: number;
    issue_date: string;
    due_date: string;
    order?: { order_number: string };
}

const CustomerDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchCustomer();
            fetchInvoices();
        }
    }, [id]);

    const fetchCustomer = async () => {
        try {
            const { data } = await apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${id}`);
            setCustomer(data);
        } catch (error) {
            console.error('Failed to fetch customer:', error);
            alert('Failed to load customer');
        }
        setLoading(false);
    };

    const fetchInvoices = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.INVOICES, {
                params: { customer_id: id }
            });
            setInvoices(data.data || data);
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: '#6b7280',
            issued: '#3b82f6',
            partial: '#f59e0b',
            paid: '#10b981',
            overdue: '#ef4444',
        };
        return colors[status] || '#6b7280';
    };

    if (loading) {
        return <div className="loading">Loading customer...</div>;
    }

    if (!customer) {
        return <div className="empty">Customer not found</div>;
    }

    const creditLimit = Number(customer.credit_limit || 0);
    const creditBalance = Number(customer.credit_balance || 0);
    const availableCredit = creditLimit - creditBalance;
    const creditUsagePercent = creditLimit > 0 
        ? (creditBalance / creditLimit) * 100 
        : 0;

    return (
        <div className="customer-detail">
            <div className="detail-header">
                <button className="btn-back" onClick={() => navigate('/counter/customers')}>
                    ← Back to Customers
                </button>
                <h1>{customer.name}</h1>
            </div>

            <div className="detail-content">
                <div className="detail-section">
                    <h2>Customer Information</h2>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>Type</label>
                            <span className={`type-badge ${customer.type}`}>
                                {customer.type.toUpperCase()}
                            </span>
                        </div>
                        {customer.email && (
                            <div className="info-item">
                                <label>Email</label>
                                <span>{customer.email}</span>
                            </div>
                        )}
                        {customer.phone && (
                            <div className="info-item">
                                <label>Phone</label>
                                <span>{customer.phone}</span>
                            </div>
                        )}
                        {customer.address && (
                            <div className="info-item">
                                <label>Address</label>
                                <span>{customer.address}</span>
                            </div>
                        )}
                        {customer.tax_id && (
                            <div className="info-item">
                                <label>Tax ID</label>
                                <span>{customer.tax_id}</span>
                            </div>
                        )}
                    </div>
                </div>

                {customer.type === 'credit' && (
                    <div className="detail-section credit-section">
                        <h2>💳 Credit Information</h2>
                        <div className="credit-dashboard">
                            <div className="credit-card">
                                <div className="credit-label">Credit Limit</div>
                                <div className="credit-value">{formatCurrency(creditLimit)}</div>
                            </div>
                            <div className="credit-card">
                                <div className="credit-label">Credit Used</div>
                                <div className="credit-value used">{formatCurrency(creditBalance)}</div>
                            </div>
                            <div className="credit-card">
                                <div className="credit-label">Available Credit</div>
                                <div className={`credit-value ${availableCredit < 0 ? 'negative' : 'available'}`}>
                                    {formatCurrency(availableCredit)}
                                </div>
                            </div>
                            {customer.credit_period_days && (
                                <div className="credit-card">
                                    <div className="credit-label">Credit Period</div>
                                    <div className="credit-value">{customer.credit_period_days} days</div>
                                </div>
                            )}
                        </div>
                        <div className="credit-bar-container">
                            <div className="credit-bar-label">
                                <span>Credit Usage</span>
                                <span>{creditUsagePercent.toFixed(1)}%</span>
                            </div>
                            <div className="credit-bar">
                                <div
                                    className="credit-fill"
                                    style={{
                                        width: `${Math.min(100, creditUsagePercent)}%`,
                                        backgroundColor: creditUsagePercent >= 100 
                                            ? '#ef4444' 
                                            : creditUsagePercent >= 80 
                                            ? '#f59e0b' 
                                            : '#10b981'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {customer.notes && (
                    <div className="detail-section">
                        <h2>Notes</h2>
                        <p className="notes-text">{customer.notes}</p>
                    </div>
                )}

                {customer.type === 'credit' && invoices.length > 0 && (
                    <div className="detail-section">
                        <h2>Invoice History</h2>
                        <table className="invoices-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Order #</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Balance</th>
                                    <th>Issue Date</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(invoice => (
                                    <tr 
                                        key={invoice.id}
                                        onClick={() => navigate(`/counter/invoices/${invoice.id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td className="invoice-number">{invoice.invoice_number}</td>
                                        <td>{invoice.order?.order_number || 'N/A'}</td>
                                        <td>
                                            <span
                                                className="status-badge"
                                                style={{ backgroundColor: getStatusColor(invoice.status) }}
                                            >
                                                {invoice.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="amount">${Number(invoice.total || 0).toFixed(2)}</td>
                                        <td className={`amount ${Number(invoice.balance || 0) > 0 ? 'due' : ''}`}>
                                            ${Number(invoice.balance || 0).toFixed(2)}
                                        </td>
                                        <td className="date">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                                        <td className={`date ${new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' ? 'overdue' : ''}`}>
                                            {new Date(invoice.due_date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDetail;

