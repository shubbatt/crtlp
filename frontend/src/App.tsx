import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppSelector } from './hooks/redux';
import Login from './components/auth/Login';
import Layout from './components/layout/Layout';
import CounterApp from './apps/CounterApp';
import BackOfficeApp from './apps/BackOfficeApp';
import ManagerApp from './apps/ManagerApp';
import AdminApp from './apps/AdminApp';
import AccountsApp from './apps/AccountsApp';
import ReportsApp from './apps/ReportsApp';
import './App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
    children,
    allowedRoles
}) => {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" />;
    }

    return <>{children}</>;
};

// App Routes
const AppRoutes: React.FC = () => {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        );
    }

    // Redirect to role-appropriate dashboard
    const defaultRoute = user?.role === 'admin' ? '/admin'
        : user?.role === 'manager' ? '/manager'
            : user?.role === 'counter_staff' ? '/counter'
                : user?.role === 'back_office' ? '/backoffice'
                    : user?.role === 'accounts' ? '/accounts'
                        : '/counter';

    return (
        <Routes>
            <Route path="/" element={<Navigate to={defaultRoute} />} />
            <Route path="/login" element={<Navigate to={defaultRoute} />} />

            {/* Counter Staff Routes */}
            <Route
                path="/counter/*"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'counter_staff']}>
                        <Layout>
                            <CounterApp />
                        </Layout>
                    </ProtectedRoute>
                }
            />

            {/* Back Office Routes */}
            <Route
                path="/backoffice/*"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'back_office']}>
                        <Layout>
                            <BackOfficeApp />
                        </Layout>
                    </ProtectedRoute>
                }
            />

            {/* Manager Routes */}
            <Route
                path="/manager/*"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <Layout>
                            <ManagerApp />
                        </Layout>
                    </ProtectedRoute>
                }
            />

            {/* Admin Routes */}
            <Route
                path="/admin/*"
                element={
                    <ProtectedRoute allowedRoles={['admin']}>
                        <Layout>
                            <AdminApp />
                        </Layout>
                    </ProtectedRoute>
                }
            />

            {/* Accounts Routes */}
            <Route
                path="/accounts/*"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'accounts']}>
                        <Layout>
                            <AccountsApp />
                        </Layout>
                    </ProtectedRoute>
                }
            />

            {/* Reports Routes */}
            <Route
                path="/reports/*"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'accounts']}>
                        <Layout>
                            <ReportsApp />
                        </Layout>
                    </ProtectedRoute>
                }
            />

            <Route path="/unauthorized" element={
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h1>⛔ Unauthorized</h1>
                    <p>You don't have permission to access this page.</p>
                </div>
            } />

            <Route path="*" element={<Navigate to={defaultRoute} />} />
        </Routes>
    );
};

// Main App Component
const App: React.FC = () => {
    return (
        <Provider store={store}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </Provider>
    );
};

export default App;
