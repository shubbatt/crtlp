import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './OrdersList.css';

interface Order {
    id: number;
    order_number: string;
    status: string;
    total: number;
    paid_amount: number;
    balance: number;
    customer?: { name: string };
    created_at: string;
    items?: any[];
}

const OrdersList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const { data } = await apiClient.get(API_ENDPOINTS.ORDERS, { params });
            setOrders(data.data || data);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        }
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: '#6b7280',
            PENDING_PAYMENT: '#f59e0b',
            CONFIRMED: '#3b82f6',
            IN_PRODUCTION: '#8b5cf6',
            QA: '#ec4899',
            READY: '#10b981',
            DELIVERED: '#06b6d4',
            COMPLETED: '#059669',
            CANCELLED: '#ef4444',
        };
        return colors[status] || '#6b7280';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    return (
        <div className="orders-list">
            <div className="orders-header">
                <h1>📋 Orders</h1>
                <Link to="/counter/orders/new" className="btn-new">
                    ➕ New Order
                </Link>
            </div>

            <div className="filters">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="status-filter"
                >
                    <option value="">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING_PAYMENT">Pending Payment</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="IN_PRODUCTION">In Production</option>
                    <option value="READY">Ready</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="COMPLETED">Completed</option>
                </select>
                <button onClick={fetchOrders} className="btn-refresh">🔄 Refresh</button>
            </div>

            {loading ? (
                <div className="loading">Loading orders...</div>
            ) : orders.length === 0 ? (
                <div className="empty">No orders found</div>
            ) : (
                <div className="orders-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Status</th>
                                <th>Customer</th>
                                <th>Total</th>
                                <th>Balance</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} onClick={() => navigate(`/counter/orders/${order.id}`)} style={{ cursor: 'pointer' }}>
                                    <td className="order-number">{order.order_number}</td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(order.status) }}
                                        >
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td>{order.customer?.name || 'Walk-in'}</td>
                                    <td className="amount">{formatCurrency(order.total)}</td>
                                    <td className={`amount ${Number(order.balance || 0) > 0 ? 'due' : ''}`}>
                                        {formatCurrency(order.balance)}
                                    </td>
                                    <td className="date">{formatDate(order.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default OrdersList;
