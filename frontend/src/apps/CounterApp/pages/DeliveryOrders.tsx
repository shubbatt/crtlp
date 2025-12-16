import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './DeliveryOrders.css';

interface Order {
    id: number;
    order_number: string;
    status: string;
    total: number;
    balance: number;
    customer?: { name: string; phone: string };
    created_at: string;
}

const DeliveryOrders: React.FC = () => {
    const [readyOrders, setReadyOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchReadyOrders();
    }, []);

    const fetchReadyOrders = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.ORDERS, {
                params: { status: 'READY' }
            });
            setReadyOrders(data.data || data);
        } catch (error) {
            console.error('Failed to fetch ready orders:', error);
        }
        setLoading(false);
    };

    const handleMarkDelivered = async (orderId: number) => {
        if (!confirm('Mark this order as delivered/released?')) return;

        try {
            await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(orderId), {
                status: 'RELEASED'
            });
            alert('✅ Order marked as delivered!');
            fetchReadyOrders();
        } catch (error: any) {
            alert('Failed to mark as delivered: ' + (error.response?.data?.error || error.message));
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <div className="delivery-orders">
            <div className="delivery-header">
                <h1>🚚 Ready for Delivery</h1>
                <button className="btn-refresh" onClick={fetchReadyOrders}>
                    🔄 Refresh
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading orders...</div>
            ) : readyOrders.length === 0 ? (
                <div className="empty">
                    <div className="empty-icon">📦</div>
                    <h2>No orders ready for delivery</h2>
                    <p>Orders will appear here when they're marked as READY</p>
                </div>
            ) : (
                <div className="delivery-grid">
                    {readyOrders.map(order => (
                        <div key={order.id} className="delivery-card">
                            <div className="card-header">
                                <div className="order-number">{order.order_number}</div>
                                <span className="status-badge ready">READY</span>
                            </div>
                            
                            <div className="card-body">
                                <div className="info-row">
                                    <span className="label">Customer:</span>
                                    <span className="value">{order.customer?.name || 'Walk-in'}</span>
                                </div>
                                {order.customer?.phone && (
                                    <div className="info-row">
                                        <span className="label">Phone:</span>
                                        <span className="value">{order.customer.phone}</span>
                                    </div>
                                )}
                                <div className="info-row">
                                    <span className="label">Total:</span>
                                    <span className="value amount">{formatCurrency(order.total)}</span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Balance:</span>
                                    <span className={`value ${Number(order.balance || 0) > 0 ? 'balance-due' : 'paid'}`}>
                                        {formatCurrency(order.balance)}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Created:</span>
                                    <span className="value">{formatDate(order.created_at)}</span>
                                </div>
                            </div>

                            <div className="card-actions">
                                <button
                                    className="btn-view"
                                    onClick={() => navigate(`/counter/orders/${order.id}`)}
                                >
                                    📋 View Details
                                </button>
                                {Number(order.balance || 0) <= 0 && (
                                    <button
                                        className="btn-deliver"
                                        onClick={() => handleMarkDelivered(order.id)}
                                    >
                                        ✅ Mark Delivered
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DeliveryOrders;

