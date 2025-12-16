import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import './CustomersList.css';

interface Customer {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
    credit_limit: number;
    credit_balance: number;
    credit_period_days?: number;
}

const CustomersList: React.FC = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        type: 'regular',
        credit_limit: 0,
        credit_period_days: 30,
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.CUSTOMERS);
            setCustomers(data.data || data);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Frontend validation
        if (!formData.name.trim()) {
            alert('Please enter customer name');
            return;
        }
        if (!formData.phone.trim()) {
            alert('Please enter customer phone number');
            return;
        }
        
        // Check for duplicates before submitting
        try {
            // Check by name
            const nameCheck = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { search: formData.name.trim() }
            });
            const nameResults = nameCheck.data.data || nameCheck.data;
            const existingByName = nameResults.find((c: Customer) => 
                c.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
            );
            
            if (existingByName) {
                alert(`⚠️ Customer Already Exists!\n\nA customer with the name "${formData.name}" already exists.\n\nCustomer: ${existingByName.name}${existingByName.phone ? ` (${existingByName.phone})` : ''}`);
                return;
            }
            
            // Check by phone
            const phoneCheck = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { search: formData.phone.trim() }
            });
            const phoneResults = phoneCheck.data.data || phoneCheck.data;
            const existingByPhone = phoneResults.find((c: Customer) => 
                c.phone && c.phone.trim() === formData.phone.trim()
            );
            
            if (existingByPhone) {
                alert(`⚠️ Customer Already Exists!\n\nA customer with the phone number "${formData.phone}" already exists.\n\nCustomer: ${existingByPhone.name}${existingByPhone.phone ? ` (${existingByPhone.phone})` : ''}`);
                return;
            }
        } catch (checkError) {
            // If search fails, proceed with creation (backend will catch duplicates)
            console.warn('Duplicate check failed, proceeding with creation:', checkError);
        }
        
        try {
            await apiClient.post(API_ENDPOINTS.CUSTOMERS, formData);
            setShowModal(false);
            setFormData({ name: '', email: '', phone: '', type: 'regular', credit_limit: 0, credit_period_days: 30 });
            fetchCustomers();
        } catch (error: any) {
            if (error.response?.status === 409 && error.response?.data?.error === 'duplicate') {
                const existingCustomer = error.response?.data?.existing_customer;
                const duplicateField = error.response?.data?.duplicate_field || 'name or phone';
                alert(`⚠️ Customer Already Exists!\n\n${error.response?.data?.message}\n\nCustomer: ${existingCustomer?.name}${existingCustomer?.phone ? ` (${existingCustomer.phone})` : ''}`);
            } else {
                alert('Failed to create customer: ' + (error.response?.data?.message || error.message));
            }
        }
    };

    return (
        <div className="customers-list">
            <div className="customers-header">
                <h1>👥 Customers</h1>
                <button className="btn-new" onClick={() => setShowModal(true)}>
                    ➕ Add Customer
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading customers...</div>
            ) : customers.length === 0 ? (
                <div className="empty">No customers found. Add your first customer!</div>
            ) : (
                <div className="customers-grid">
                    {customers.map(customer => (
                        <div 
                            key={customer.id} 
                            className="customer-card"
                            onClick={() => navigate(`/counter/customers/${customer.id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="customer-type">{customer.type}</div>
                            <h3>{customer.name}</h3>
                            {customer.email && <p className="email">📧 {customer.email}</p>}
                            {customer.phone && <p className="phone">📱 {customer.phone}</p>}
                            {customer.type === 'credit' && (
                                <div className="credit-info">
                                    <div className="credit-row">
                                        <span>Credit Limit:</span>
                                        <span>{formatCurrency(customer.credit_limit)}</span>
                                    </div>
                                    <div className="credit-row">
                                        <span>Used:</span>
                                        <span>{formatCurrency(customer.credit_balance)}</span>
                                    </div>
                                    <div className="credit-row">
                                        <span>Available:</span>
                                        <span>{formatCurrency(Number(customer.credit_limit || 0) - Number(customer.credit_balance || 0))}</span>
                                    </div>
                                    {customer.credit_period_days && (
                                        <div className="credit-row" style={{ fontSize: '12px', color: '#666' }}>
                                            <span>Credit Period:</span>
                                            <span>{customer.credit_period_days} days</span>
                                        </div>
                                    )}
                                    <div className="credit-bar">
                                        <div
                                            className="credit-fill"
                                            style={{ 
                                                width: `${Math.min(100, (Number(customer.credit_limit || 0) > 0 ? (Number(customer.credit_balance || 0) / Number(customer.credit_limit || 0)) * 100 : 0))}%`,
                                                backgroundColor: Number(customer.credit_balance || 0) >= Number(customer.credit_limit || 0) ? '#ef4444' : '#667eea'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Add New Customer</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone *</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="walk_in">Walk-in</option>
                                    <option value="regular">Regular</option>
                                    <option value="credit">Credit</option>
                                </select>
                            </div>
                            {formData.type === 'credit' && (
                                <>
                                    <div className="form-group">
                                        <label>Credit Limit ($) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.credit_limit}
                                            onChange={e => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Credit Period (Days)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={formData.credit_period_days}
                                            onChange={e => setFormData({ ...formData, credit_period_days: parseInt(e.target.value) || 30 })}
                                            placeholder="30"
                                        />
                                        <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                                            Number of days before invoice is due (default: 30)
                                        </small>
                                    </div>
                                </>
                            )}
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Create Customer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersList;
