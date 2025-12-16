import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './InvoicesList.css';

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
    order?: { order_number: string };
}

const InvoicesList: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchInvoices();
    }, [statusFilter, customerFilter]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (statusFilter) params.status = statusFilter;
            if (customerFilter) params.customer_id = customerFilter;
            
            const { data } = await apiClient.get(API_ENDPOINTS.INVOICES, { params });
            setInvoices(data.data || data);
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        }
        setLoading(false);
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    const isOverdue = (invoice: Invoice) => {
        return invoice.status !== 'paid' && new Date(invoice.due_date) < new Date();
    };

    return (
        <div className="invoices-list">
            <div className="invoices-header">
                <h1>📄 Invoices</h1>
                <button className="btn-refresh" onClick={fetchInvoices}>
                    🔄 Refresh
                </button>
            </div>

            <div className="filters">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                </select>
            </div>

            {loading ? (
                <div className="loading">Loading invoices...</div>
            ) : invoices.length === 0 ? (
                <div className="empty">No invoices found</div>
            ) : (
                <div className="invoices-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Status</th>
                                <th>Customer</th>
                                <th>Order #</th>
                                <th>Total</th>
                                <th>Paid</th>
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
                                    className={isOverdue(invoice) ? 'overdue-row' : ''}
                                >
                                    <td className="invoice-number">{invoice.invoice_number}</td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(invoice.status) }}
                                        >
                                            {invoice.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{invoice.customer?.name || 'N/A'}</td>
                                    <td>{invoice.order?.order_number || 'N/A'}</td>
                                    <td className="amount">{formatCurrency(invoice.total)}</td>
                                    <td className="amount">{formatCurrency(invoice.paid_amount)}</td>
                                    <td className={`amount ${Number(invoice.balance || 0) > 0 ? 'due' : ''}`}>
                                        {formatCurrency(invoice.balance)}
                                    </td>
                                    <td className="date">{formatDate(invoice.issue_date)}</td>
                                    <td className={`date ${isOverdue(invoice) ? 'overdue' : ''}`}>
                                        {formatDate(invoice.due_date)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default InvoicesList;

