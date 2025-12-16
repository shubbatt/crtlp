import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/redux';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const user = useAppSelector((state) => state.auth.user);
    const [stats, setStats] = useState({
        todayOrders: 0,
        pendingOrders: 0,
        readyOrders: 0,
        todayRevenue: 0,
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.ORDERS);
            const orders = data.data || data;

            const today = new Date().toDateString();
            const todayOrders = orders.filter((o: any) =>
                new Date(o.created_at).toDateString() === today
            );

            setStats({
                todayOrders: todayOrders.length,
                pendingOrders: orders.filter((o: any) =>
                    ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED'].includes(o.status)
                ).length,
                readyOrders: orders.filter((o: any) => o.status === 'READY').length,
                todayRevenue: todayOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
            });
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Welcome, {user?.name}!</h1>
                <p>Counter Staff Dashboard</p>
            </div>

            <div className="quick-actions">
                <Link to="/counter/orders/new" className="action-card primary">
                    <div className="action-icon">🛒</div>
                    <h3>New Order</h3>
                    <p>Create a new customer order</p>
                </Link>

                <Link to="/counter/orders" className="action-card">
                    <div className="action-icon">📋</div>
                    <h3>View Orders</h3>
                    <p>Browse and manage orders</p>
                </Link>

                <Link to="/counter/customers" className="action-card">
                    <div className="action-icon">👥</div>
                    <h3>Customers</h3>
                    <p>Manage customer information</p>
                </Link>

                <div className="action-card">
                    <div className="action-icon">💰</div>
                    <h3>Payments</h3>
                    <p>Process payments</p>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h4>Today's Orders</h4>
                    <div className="stat-value">{stats.todayOrders}</div>
                    <div className="stat-change positive">Created today</div>
                </div>

                <div className="stat-card">
                    <h4>Pending Orders</h4>
                    <div className="stat-value">{stats.pendingOrders}</div>
                    <div className="stat-change">Awaiting action</div>
                </div>

                <div className="stat-card">
                    <h4>Ready for Pickup</h4>
                    <div className="stat-value">{stats.readyOrders}</div>
                    <div className="stat-change">Notify customers</div>
                </div>

                <div className="stat-card">
                    <h4>Today's Revenue</h4>
                    <div className="stat-value">{formatCurrency(stats.todayRevenue)}</div>
                    <div className="stat-change positive">Total value</div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
