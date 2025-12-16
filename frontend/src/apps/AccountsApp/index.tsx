import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { formatCurrency } from '../../utils/currency';
import './AccountsApp.css';

interface Order {
    id: number;
    order_number: string;
    status: string;
    total: number;
    paid_amount: number;
    balance: number;
    customer?: { name: string };
    created_at: string;
}

interface Invoice {
    id: number;
    invoice_number: string;
    status: string;
    total: number;
    paid_amount: number;
    balance: number;
    issue_date: string;
    due_date: string;
    customer?: { id: number; name: string };
}

interface CreditCustomer {
    id: number;
    name: string;
    credit_limit: number;
    credit_balance: number;
    credit_period_days: number | null;
}

const AccountsApp: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'invoices' | 'ar-aging' | 'credit-customers'>('pending');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [outletFilter, setOutletFilter] = useState<number | 'all'>('all');
    const [outlets, setOutlets] = useState<Array<{ id: number; name: string }>>([]);

    useEffect(() => {
        fetchOutlets();
        fetchOrders();
        if (activeTab === 'invoices' || activeTab === 'ar-aging') {
            fetchInvoices();
        }
        if (activeTab === 'credit-customers') {
            fetchCreditCustomers();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'invoices' || activeTab === 'ar-aging') {
            fetchInvoices();
        }
    }, [outletFilter]);

    const fetchOutlets = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.OUTLETS);
            setOutlets(data || []);
        } catch (error) {
            console.error('Failed to fetch outlets:', error);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.ORDERS);
            setOrders(data.data || data);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        }
        setLoading(false);
    };

    const fetchInvoices = async () => {
        try {
            const params: any = {};
            if (outletFilter !== 'all') {
                params.outlet_id = outletFilter;
            }
            const { data } = await apiClient.get(API_ENDPOINTS.INVOICES, { params });
            setInvoices(data.data || data);
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        }
    };

    const fetchCreditCustomers = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { type: 'credit' }
            });
            setCreditCustomers(data.data || data);
        } catch (error) {
            console.error('Failed to fetch credit customers:', error);
        }
    };

    const filteredOrders = orders.filter(order => {
        const balance = Number(order.balance || 0);
        if (activeTab === 'pending') return balance > 0;
        return true;
    });

    const totalPending = orders.reduce((sum, o) => sum + Number(o.balance || 0), 0);
    const totalReceived = orders.reduce((sum, o) => sum + Number(o.paid_amount || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const handlePayment = async () => {
        if (!selectedOrder || !paymentAmount) return;

        // Note: Payment endpoint would need to be implemented in backend
        alert(`💰 Payment of ${formatCurrency(paymentAmount)} recorded for ${selectedOrder.order_number}`);
        setSelectedOrder(null);
        setPaymentAmount('');
        fetchOrders();
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: '#6b7280',
            PENDING_PAYMENT: '#f59e0b',
            CONFIRMED: '#3b82f6',
            IN_PRODUCTION: '#8b5cf6',
            READY: '#10b981',
            COMPLETED: '#059669',
            CANCELLED: '#ef4444',
        };
        return colors[status] || '#6b7280';
    };

    return (
        <div className="accounts-app">
            <div className="accounts-header">
                <h1>💰 Accounts Dashboard</h1>
                <button onClick={fetchOrders} className="btn-refresh">🔄 Refresh</button>
            </div>

            {/* Financial Overview */}
            <div className="finance-overview">
                <div className="finance-card revenue">
                    <div className="finance-icon">📊</div>
                    <div className="finance-content">
                        <h3>Total Revenue</h3>
                        <div className="finance-value">{formatCurrency(totalRevenue)}</div>
                    </div>
                </div>

                <div className="finance-card received">
                    <div className="finance-icon">✅</div>
                    <div className="finance-content">
                        <h3>Received</h3>
                        <div className="finance-value">{formatCurrency(totalReceived)}</div>
                    </div>
                </div>

                <div className="finance-card pending">
                    <div className="finance-icon">⏳</div>
                    <div className="finance-content">
                        <h3>Pending</h3>
                        <div className="finance-value">{formatCurrency(totalPending)}</div>
                    </div>
                </div>

                <div className="finance-card collection">
                    <div className="finance-icon">📈</div>
                    <div className="finance-content">
                        <h3>Collection Rate</h3>
                        <div className="finance-value">
                            {totalRevenue > 0 ? ((totalReceived / totalRevenue) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="accounts-tabs">
                <button
                    className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    ⏳ Pending Payment ({orders.filter(o => Number(o.balance || 0) > 0).length})
                </button>
                <button
                    className={`tab ${activeTab === 'invoices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invoices')}
                >
                    📄 Invoices ({invoices.length})
                </button>
                <button
                    className={`tab ${activeTab === 'ar-aging' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ar-aging')}
                >
                    📊 A/R Aging
                </button>
                <button
                    className={`tab ${activeTab === 'credit-customers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('credit-customers')}
                >
                    💳 Credit Customers ({creditCustomers.length})
                </button>
            </div>

            {/* Content based on active tab */}
            {loading && activeTab === 'pending' ? (
                <div className="loading">Loading...</div>
            ) : activeTab === 'pending' ? (
                <div className="orders-table-container">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(order => (
                                <tr key={order.id}>
                                    <td className="order-number">{order.order_number}</td>
                                    <td>{order.customer?.name || 'Walk-in'}</td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(order.status) }}
                                        >
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="amount">{formatCurrency(order.total)}</td>
                                    <td className="amount paid">{formatCurrency(order.paid_amount)}</td>
                                    <td className={`amount ${Number(order.balance || 0) > 0 ? 'due' : 'clear'}`}>
                                        {formatCurrency(order.balance)}
                                    </td>
                                    <td>
                                        {Number(order.balance || 0) > 0 && (
                                            <button
                                                className="btn-pay"
                                                onClick={() => {
                                                    setSelectedOrder(order);
                                                    setPaymentAmount(String(order.balance || 0));
                                                }}
                                            >
                                                💵 Record Payment
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : activeTab === 'invoices' ? (
                <div className="invoices-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Invoices</h3>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <label style={{ fontWeight: 500 }}>Filter by Outlet:</label>
                            <select
                                value={outletFilter}
                                onChange={(e) => setOutletFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                style={{
                                    padding: '8px 12px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Outlets</option>
                                {outlets.map(outlet => (
                                    <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Issue Date</th>
                                <th>Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(invoice => {
                                const daysOverdue = invoice.due_date 
                                    ? Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
                                    : 0;
                                const isOverdue = invoice.status !== 'paid' && daysOverdue > 0;
                                
                                return (
                                    <tr key={invoice.id} className={isOverdue ? 'overdue-row' : ''}>
                                        <td className="invoice-number">{invoice.invoice_number}</td>
                                        <td>{invoice.customer?.name || 'N/A'}</td>
                                        <td>
                                            <span className="status-badge" style={{
                                                backgroundColor: invoice.status === 'paid' ? '#10b981' : 
                                                                invoice.status === 'overdue' ? '#ef4444' : 
                                                                invoice.status === 'partial' ? '#f59e0b' : '#3b82f6'
                                            }}>
                                                {invoice.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="amount">{formatCurrency(invoice.total)}</td>
                                        <td className="amount paid">{formatCurrency(invoice.paid_amount)}</td>
                                        <td className={`amount ${Number(invoice.balance || 0) > 0 ? 'due' : 'clear'}`}>
                                            {formatCurrency(invoice.balance)}
                                        </td>
                                        <td>{new Date(invoice.issue_date).toLocaleDateString()}</td>
                                        <td className={isOverdue ? 'overdue' : ''}>
                                            {new Date(invoice.due_date).toLocaleDateString()}
                                            {isOverdue && ` (${daysOverdue} days)`}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : activeTab === 'ar-aging' ? (
                <div className="ar-aging-section">
                    <div className="aging-buckets">
                        {['0-30', '31-60', '61-90', '90+'].map(bucket => {
                            const [min, max] = bucket === '90+' 
                                ? [90, Infinity] 
                                : bucket.split('-').map(Number);
                            
                            const bucketInvoices = invoices.filter(inv => {
                                if (inv.status === 'paid' || !inv.due_date) return false;
                                const days = Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
                                return days >= min && days <= max;
                            });
                            
                            const bucketTotal = bucketInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
                            
                            return (
                                <div key={bucket} className="aging-bucket">
                                    <div className="bucket-header">
                                        <h3>{bucket} Days</h3>
                                        <span className="bucket-count">{bucketInvoices.length} invoices</span>
                                    </div>
                                    <div className="bucket-total">{formatCurrency(bucketTotal)}</div>
                                    <div className="bucket-invoices">
                                        {bucketInvoices.map(inv => (
                                            <div key={inv.id} className="bucket-invoice">
                                                <span>{inv.invoice_number}</span>
                                                <span>{formatCurrency(inv.balance)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : activeTab === 'credit-customers' ? (
                <div className="credit-customers-section">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Credit Limit</th>
                                <th>Credit Used</th>
                                <th>Available</th>
                                <th>Credit Period</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {creditCustomers.map(customer => {
                                const available = Number(customer.credit_limit || 0) - Number(customer.credit_balance || 0);
                                const usagePercent = Number(customer.credit_limit || 0) > 0 
                                    ? (Number(customer.credit_balance || 0) / Number(customer.credit_limit || 0)) * 100 
                                    : 0;
                                
                                return (
                                    <tr key={customer.id}>
                                        <td><strong>{customer.name}</strong></td>
                                        <td className="amount">{formatCurrency(customer.credit_limit)}</td>
                                        <td className="amount">{formatCurrency(customer.credit_balance)}</td>
                                        <td className={`amount ${available < 0 ? 'negative' : ''}`}>
                                            {formatCurrency(available)}
                                        </td>
                                        <td>{customer.credit_period_days || 'N/A'} days</td>
                                        <td>
                                            <span className="status-badge" style={{
                                                backgroundColor: usagePercent >= 100 ? '#ef4444' : 
                                                                usagePercent >= 80 ? '#f59e0b' : '#10b981'
                                            }}>
                                                {usagePercent.toFixed(0)}% Used
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {/* Payment Modal */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Record Payment</h2>
                        <p className="order-ref">Order: <strong>{selectedOrder.order_number}</strong></p>
                        <p className="balance-info">
                            Outstanding Balance: <strong>{formatCurrency(selectedOrder.balance)}</strong>
                        </p>

                        <div className="form-group">
                            <label>Payment Amount</label>
                            <input
                                type="number"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                max={selectedOrder.balance}
                                step="0.01"
                            />
                        </div>

                        <div className="form-group">
                            <label>Payment Method</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                            >
                                <option value="cash">💵 Cash</option>
                                <option value="card">💳 Card</option>
                                <option value="transfer">🏦 Bank Transfer</option>
                                <option value="cheque">📝 Cheque</option>
                            </select>
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => setSelectedOrder(null)} className="btn-cancel">
                                Cancel
                            </button>
                            <button onClick={handlePayment} className="btn-confirm">
                                ✅ Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountsApp;
