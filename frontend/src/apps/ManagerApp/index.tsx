import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { formatCurrency } from '../../utils/currency';
import './ManagerApp.css';

interface Stats {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: number;
    todayOrders: number;
    todayRevenue: number;
    ordersByStatus: Record<string, number>;
}

const ManagerApp: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalRevenue: 0,
        todayOrders: 0,
        todayRevenue: 0,
        ordersByStatus: {},
    });
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.ORDERS);
            const orders = data.data || data;

            const today = new Date().toDateString();
            const todayOrders = orders.filter((o: any) =>
                new Date(o.created_at).toDateString() === today
            );

            const statusCounts: Record<string, number> = {};
            orders.forEach((o: any) => {
                statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
            });

            setStats({
                totalOrders: orders.length,
                pendingOrders: orders.filter((o: any) =>
                    ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION'].includes(o.status)
                ).length,
                completedOrders: orders.filter((o: any) => o.status === 'COMPLETED').length,
                totalRevenue: orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
                todayOrders: todayOrders.length,
                todayRevenue: todayOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
                ordersByStatus: statusCounts,
            });

            setRecentOrders(orders.slice(0, 10));
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }
        setLoading(false);
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

    if (loading) {
        return <div className="manager-loading">Loading dashboard...</div>;
    }

    return (
        <div className="manager-app">
            <div className="manager-header">
                <h1>📊 Manager Dashboard</h1>
                <button onClick={fetchDashboardData} className="btn-refresh">🔄 Refresh</button>
            </div>

            {/* Key Metrics */}
            <div className="metrics-grid">
                <div className="metric-card primary">
                    <div className="metric-icon">📦</div>
                    <div className="metric-content">
                        <h3>Total Orders</h3>
                        <div className="metric-value">{stats.totalOrders}</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon">⏳</div>
                    <div className="metric-content">
                        <h3>Pending</h3>
                        <div className="metric-value">{stats.pendingOrders}</div>
                    </div>
                </div>

                <div className="metric-card success">
                    <div className="metric-icon">✅</div>
                    <div className="metric-content">
                        <h3>Completed</h3>
                        <div className="metric-value">{stats.completedOrders}</div>
                    </div>
                </div>

                <div className="metric-card revenue">
                    <div className="metric-icon">💰</div>
                    <div className="metric-content">
                        <h3>Total Revenue</h3>
                        <div className="metric-value">{formatCurrency(stats.totalRevenue)}</div>
                    </div>
                </div>
            </div>

            {/* Today's Stats */}
            <div className="today-stats">
                <h2>📅 Today's Performance</h2>
                <div className="today-grid">
                    <div className="today-card">
                        <span className="today-label">Orders</span>
                        <span className="today-value">{stats.todayOrders}</span>
                    </div>
                    <div className="today-card">
                        <span className="today-label">Revenue</span>
                        <span className="today-value">{formatCurrency(stats.todayRevenue)}</span>
                    </div>
                    <div className="today-card">
                        <span className="today-label">Avg Order Value</span>
                        <span className="today-value">
                            ${stats.todayOrders > 0 ? (stats.todayRevenue / stats.todayOrders).toFixed(2) : '0.00'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Orders by Status */}
            <div className="status-breakdown">
                <h2>📈 Orders by Status</h2>
                <div className="status-bars">
                    {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                        <div key={status} className="status-bar-item">
                            <div className="status-label">
                                <span
                                    className="status-dot"
                                    style={{ backgroundColor: getStatusColor(status) }}
                                />
                                {status.replace('_', ' ')}
                            </div>
                            <div className="status-bar-container">
                                <div
                                    className="status-bar-fill"
                                    style={{
                                        width: `${(count / stats.totalOrders) * 100}%`,
                                        backgroundColor: getStatusColor(status)
                                    }}
                                />
                            </div>
                            <span className="status-count">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="recent-orders">
                <h2>🕐 Recent Orders</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentOrders.map(order => (
                            <tr key={order.id}>
                                <td className="order-number">{order.order_number}</td>
                                <td>
                                    <span
                                        className="status-badge"
                                        style={{ backgroundColor: getStatusColor(order.status) }}
                                    >
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="amount">{formatCurrency(order.total)}</td>
                                <td className="date">{new Date(order.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManagerApp;
