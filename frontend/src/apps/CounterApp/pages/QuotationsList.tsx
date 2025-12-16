import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './QuotationsList.css';

interface Quotation {
    id: number;
    quote_number: string;
    status: string;
    total: number;
    valid_until: string;
    customer?: { name: string };
    created_at: string;
    converted_order_id?: number;
}

const QuotationsList: React.FC = () => {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchQuotations();
    }, [statusFilter]);

    const fetchQuotations = async () => {
        setLoading(true);
        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const { data } = await apiClient.get(API_ENDPOINTS.QUOTATIONS, { params });
            setQuotations(data.data || data);
        } catch (error) {
            console.error('Failed to fetch quotations:', error);
        }
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: '#6b7280',
            sent: '#3b82f6',
            approved: '#10b981',
            expired: '#f59e0b',
            converted: '#8b5cf6',
        };
        return colors[status] || '#6b7280';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    const isExpired = (quotation: Quotation) => {
        return quotation.status !== 'converted' && 
               quotation.valid_until && 
               new Date(quotation.valid_until) < new Date();
    };

    return (
        <div className="quotations-list">
            <div className="quotations-header">
                <h1>📄 Quotations</h1>
                <Link to="/counter/quotations/new" className="btn-new">
                    ➕ New Quotation
                </Link>
            </div>

            <div className="filters">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="expired">Expired</option>
                    <option value="converted">Converted</option>
                </select>
                <button className="btn-refresh" onClick={fetchQuotations}>
                    🔄 Refresh
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading quotations...</div>
            ) : quotations.length === 0 ? (
                <div className="empty">No quotations found</div>
            ) : (
                <div className="quotations-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Quote #</th>
                                <th>Status</th>
                                <th>Customer</th>
                                <th>Total</th>
                                <th>Valid Until</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotations.map(quotation => (
                                <tr 
                                    key={quotation.id}
                                    className={isExpired(quotation) ? 'expired-row' : ''}
                                >
                                    <td className="quote-number">{quotation.quote_number}</td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(quotation.status) }}
                                        >
                                            {quotation.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{quotation.customer?.name || 'Walk-in'}</td>
                                    <td className="amount">{formatCurrency(quotation.total)}</td>
                                    <td className={`date ${isExpired(quotation) ? 'expired' : ''}`}>
                                        {quotation.valid_until ? formatDate(quotation.valid_until) : 'N/A'}
                                        {isExpired(quotation) && ' ⚠️'}
                                    </td>
                                    <td className="date">{formatDate(quotation.created_at)}</td>
                                    <td>
                                        <button
                                            className="btn-view"
                                            onClick={() => navigate(`/counter/quotations/${quotation.id}`)}
                                        >
                                            View
                                        </button>
                                        {quotation.status === 'approved' && !quotation.converted_order_id && (
                                            <button
                                                className="btn-convert"
                                                onClick={() => navigate(`/counter/quotations/${quotation.id}`)}
                                            >
                                                Convert to Order
                                            </button>
                                        )}
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

export default QuotationsList;

