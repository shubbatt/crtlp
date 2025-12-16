import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { login, clearError } from '../../features/auth/authSlice';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import './Login.css';

interface Outlet {
    id: number;
    name: string;
    code: string;
}

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [outletId, setOutletId] = useState<number | ''>('');
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [loadingOutlets, setLoadingOutlets] = useState(true);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { isLoading, error } = useAppSelector((state) => state.auth);

    useEffect(() => {
        fetchOutlets();
    }, []);

    const fetchOutlets = async () => {
        setLoadingOutlets(true);
        try {
            console.log('Fetching outlets from:', API_ENDPOINTS.OUTLETS);
            const response = await apiClient.get(API_ENDPOINTS.OUTLETS);
            console.log('Outlets response:', response);
            const data = response.data || response;
            console.log('Outlets data:', data);
            setOutlets(Array.isArray(data) ? data : []);
            if (Array.isArray(data) && data.length > 0) {
                setOutletId(data[0].id);
            } else {
                console.warn('No outlets found. Please create outlets in the database.');
            }
        } catch (error: any) {
            console.error('Failed to fetch outlets:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                url: error.config?.url
            });
            setOutlets([]);
            // Show user-friendly error
            if (error.response?.status === 404 || error.response?.status === 500) {
                console.error('Outlets endpoint not available. Make sure outlets are seeded in the database.');
            }
        } finally {
            setLoadingOutlets(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!outletId) {
            alert('Please select an outlet');
            return;
        }

        const result = await dispatch(login({ email, password, outlet_id: outletId as number }));

        if (login.fulfilled.match(result)) {
            // Get user role and redirect to appropriate dashboard
            const user = result.payload.user;
            const roleRoutes: Record<string, string> = {
                admin: '/admin',
                manager: '/manager',
                counter_staff: '/counter',
                back_office: '/backoffice',
                accounts: '/accounts',
            };

            navigate(roleRoutes[user.role] || '/counter');
        }
    };

    const handleQuickLogin = (userEmail: string) => {
        setEmail(userEmail);
        setPassword('password');
        if (outlets.length > 0 && !outletId) {
            setOutletId(outlets[0].id);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>🖨️ Print Shop POS</h1>
                    <p>Sign in to continue</p>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                        <button onClick={() => dispatch(clearError())} className="close-btn">×</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="outlet">Select Outlet</label>
                        {loadingOutlets ? (
                            <div className="outlet-loading">Loading outlets...</div>
                        ) : outlets.length > 0 ? (
                            <select
                                id="outlet"
                                value={outletId}
                                onChange={(e) => setOutletId(Number(e.target.value))}
                                required
                                className="outlet-select"
                            >
                                <option value="">-- Select Outlet --</option>
                                {outlets.map((outlet) => (
                                    <option key={outlet.id} value={outlet.id}>
                                        {outlet.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="outlet-error">
                                <p>⚠️ No outlets available. Please contact administrator.</p>
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Outlets need to be created in the database.
                                </p>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn-primary" disabled={isLoading || !outletId}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="quick-login">
                    <p>Quick login (demo):</p>
                    <div className="quick-login-buttons">
                        <button onClick={() => handleQuickLogin('admin@printshop.com')} className="quick-btn">
                            Admin
                        </button>
                        <button onClick={() => handleQuickLogin('manager@printshop.com')} className="quick-btn">
                            Manager
                        </button>
                        <button onClick={() => handleQuickLogin('counter@printshop.com')} className="quick-btn">
                            Counter
                        </button>
                        <button onClick={() => handleQuickLogin('production@printshop.com')} className="quick-btn">
                            Production
                        </button>
                        <button onClick={() => handleQuickLogin('accounts@printshop.com')} className="quick-btn">
                            Accounts
                        </button>
                    </div>
                    <p className="hint">Password: password</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
