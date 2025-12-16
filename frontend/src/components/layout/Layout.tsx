import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { logout } from '../../features/auth/authSlice';
import './Layout.css';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = async () => {
        await dispatch(logout());
        navigate('/login');
    };

    const getNavLinks = () => {
        const role = user?.role;

        const baseLinks = [
            { path: '/counter', label: 'Dashboard', icon: '🏠', roles: ['admin', 'manager', 'counter_staff'] },
            { path: '/counter/orders/new', label: 'New Order', icon: '➕', roles: ['admin', 'manager', 'counter_staff'] },
            { path: '/counter/orders', label: 'Orders', icon: '📋', roles: ['admin', 'manager', 'counter_staff'] },
            { path: '/counter/quotations', label: 'Quotations', icon: '📄', roles: ['admin', 'manager', 'counter_staff'] },
            { path: '/counter/delivery', label: 'Delivery', icon: '🚚', roles: ['admin', 'manager', 'counter_staff'] },
            { path: '/counter/invoices', label: 'Invoices', icon: '📄', roles: ['admin', 'manager', 'counter_staff', 'accounts'] },
            { path: '/counter/customers', label: 'Customers', icon: '👥', roles: ['admin', 'manager', 'counter_staff'] },
            { path: '/backoffice', label: 'Production Queue', icon: '⚙️', roles: ['admin', 'manager', 'back_office'] },
            { path: '/manager', label: 'Analytics', icon: '📊', roles: ['admin', 'manager'] },
            { path: '/accounts', label: 'Finance', icon: '💰', roles: ['admin', 'manager', 'accounts'] },
            { path: '/reports', label: 'Reports', icon: '📈', roles: ['admin', 'manager', 'accounts'] },
            { path: '/admin', label: 'Admin', icon: '⚡', roles: ['admin'] },
        ];

        return baseLinks.filter(link => role && link.roles.includes(role));
    };

    const isActive = (path: string) => {
        return location.pathname.startsWith(path);
    };

    // Close menu when route changes on mobile
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Close menu when clicking outside on mobile
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuOpen && window.innerWidth <= 768) {
                const target = event.target as HTMLElement;
                if (!target.closest('.sidebar') && !target.closest('.mobile-menu-toggle')) {
                    setMenuOpen(false);
                }
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [menuOpen]);

    return (
        <div className="layout">
            {/* Mobile Menu Toggle */}
            <button 
                className="mobile-menu-toggle"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
            >
                <span className={`hamburger ${menuOpen ? 'open' : ''}`}>
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
            </button>

            {/* Mobile Overlay */}
            {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}

            <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>🖨️ PrintShop</h2>
                    <p className="role-badge">{user?.role.replace('_', ' ')}</p>
                </div>

                <nav className="sidebar-nav">
                    {getNavLinks().map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{link.icon}</span>
                            <span className="nav-label">{link.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">{user?.name.charAt(0)}</div>
                        <div className="user-details">
                            <div className="user-name">{user?.name}</div>
                            <div className="user-email">{user?.email}</div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;
