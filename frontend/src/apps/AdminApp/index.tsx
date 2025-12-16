import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { saveCurrencySettings, getCurrencySymbol, getCurrencyCode } from '../../utils/currency';
import './AdminApp.css';

interface User {
    id: number;
    name: string;
    email: string;
    role: { name: string };
    created_at: string;
}

interface Outlet {
    id: number;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
    is_active?: boolean;
}

interface Product {
    id: number;
    sku: string;
    name: string;
    description?: string;
    type: string;
    unit_cost: number;
    stock_qty?: number;
    min_stock_alert?: number;
    is_active: boolean;
    outlets?: Outlet[];
}

const AdminApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'products' | 'settings'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [productType, setProductType] = useState<'inventory' | 'service' | 'dimension'>('inventory');
    const [sku, setSku] = useState('');
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        unit_cost: '',
        stock_qty: '',
        min_stock_alert: '',
        is_active: true,
    });
    const [currencySettings, setCurrencySettings] = useState({
        symbol: 'Rf',
        code: 'MVR',
        name: 'Maldivian Rufiyaa',
        decimals: 2,
    });
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [selectedOutlets, setSelectedOutlets] = useState<number[]>([]);
    const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
    const [outletForm, setOutletForm] = useState({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
    });

    useEffect(() => {
        if (activeTab === 'products') {
            fetchProducts();
            fetchOutlets();
        }
        if (activeTab === 'settings') {
            fetchOutlets();
            // Load currency settings
            try {
                const stored = localStorage.getItem('currency_settings');
                if (stored) {
                    setCurrencySettings(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Failed to load currency settings:', e);
            }
        }
    }, [activeTab]);

    const fetchOutlets = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.OUTLETS);
            setOutlets(data || []);
        } catch (error) {
            console.error('Failed to fetch outlets:', error);
        }
    };

    const openEditOutlet = (outlet: Outlet) => {
        setEditingOutlet(outlet);
        setOutletForm({
            name: outlet.name,
            code: outlet.code,
            address: outlet.address || '',
            phone: outlet.phone || '',
            email: outlet.email || '',
        });
    };

    const closeEditOutlet = () => {
        setEditingOutlet(null);
        setOutletForm({
            name: '',
            code: '',
            address: '',
            phone: '',
            email: '',
        });
    };

    const saveOutlet = async () => {
        if (!editingOutlet) return;

        try {
            await apiClient.put(`${API_ENDPOINTS.OUTLETS}/${editingOutlet.id}`, outletForm);
            fetchOutlets();
            closeEditOutlet();
            alert('✅ Outlet updated successfully!');
        } catch (error: any) {
            alert('Failed to update outlet: ' + (error.response?.data?.error || error.message));
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/products');
            setProducts(data.data || data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
        setLoading(false);
    };

    const toggleProductStatus = async (product: Product) => {
        try {
            await apiClient.put(`/products/${product.id}`, {
                is_active: !product.is_active
            });
            fetchProducts();
        } catch (error) {
            alert('Failed to update product status');
        }
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setEditForm({
            name: product.name,
            description: product.description || '',
            unit_cost: String(product.unit_cost || 0),
            stock_qty: String(product.stock_qty || ''),
            min_stock_alert: String(product.min_stock_alert || ''),
            is_active: product.is_active,
        });
        // Set selected outlets for editing
        setSelectedOutlets(product.outlets?.map(o => o.id) || []);
    };

    const closeEditModal = () => {
        setEditingProduct(null);
        setShowAddModal(false);
        setSku('');
        setProductType('inventory');
        setSelectedOutlets([]);
        setEditForm({
            name: '',
            description: '',
            unit_cost: '',
            stock_qty: '',
            min_stock_alert: '',
            is_active: true,
        });
    };

    const saveProduct = async () => {
        // If editing, update existing product
        if (editingProduct) {
            try {
                const updateData: any = {
                    name: editForm.name,
                    description: editForm.description || null,
                    unit_cost: parseFloat(editForm.unit_cost) || 0,
                    is_active: editForm.is_active,
                };

                if (editForm.stock_qty) {
                    updateData.stock_qty = parseInt(editForm.stock_qty) || 0;
                }

                if (editForm.min_stock_alert) {
                    updateData.min_stock_alert = parseInt(editForm.min_stock_alert) || 0;
                }

                // Include outlet_ids if outlets are selected
                if (selectedOutlets.length > 0) {
                    updateData.outlet_ids = selectedOutlets;
                }

                if (selectedOutlets.length === 0) {
                    alert('Please select at least one outlet for this product');
                    return;
                }

                await apiClient.put(`/products/${editingProduct.id}`, updateData);
                fetchProducts();
                closeEditModal();
                alert('✅ Product updated successfully!');
            } catch (error: any) {
                alert('Failed to update product: ' + (error.response?.data?.error || error.message));
            }
        } 
        // If adding new product
        else if (showAddModal) {
            if (!sku || !editForm.name || !editForm.unit_cost) {
                alert('Please fill in all required fields (SKU, Name, Unit Cost)');
                return;
            }
            if (selectedOutlets.length === 0) {
                alert('Please select at least one outlet for this product');
                return;
            }

            try {
                const createData: any = {
                    sku: sku.trim().toUpperCase(),
                    name: editForm.name,
                    description: editForm.description || null,
                    type: productType,
                    unit_cost: parseFloat(editForm.unit_cost) || 0,
                    is_active: editForm.is_active,
                };

                // Add stock fields only for inventory type
                if (productType === 'inventory') {
                    if (editForm.stock_qty) {
                        createData.stock_qty = parseInt(editForm.stock_qty) || 0;
                    }
                    if (editForm.min_stock_alert) {
                        createData.min_stock_alert = parseInt(editForm.min_stock_alert) || 0;
                    }
                }

                // Include outlet_ids if outlets are selected
                if (selectedOutlets.length > 0) {
                    createData.outlet_ids = selectedOutlets;
                }

                await apiClient.post('/products', createData);
                fetchProducts();
                closeEditModal();
                alert('✅ Product created successfully!');
            } catch (error: any) {
                alert('Failed to create product: ' + (error.response?.data?.error || error.message));
            }
        }
    };

    return (
        <div className="admin-app">
            <div className="admin-header">
                <h1>⚡ Admin Panel</h1>
            </div>

            <div className="admin-tabs">
                <button
                    className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users
                </button>
                <button
                    className={`tab ${activeTab === 'products' ? 'active' : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    📦 Products
                </button>
                <button
                    className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    ⚙️ Settings
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'users' && (
                    <div className="users-section">
                        <h2>User Management</h2>
                        <div className="info-box">
                            <p>👤 <strong>5 users</strong> configured in the system</p>
                            <p>User management is handled via database seeders. Default users:</p>
                            <ul>
                                <li><strong>Admin</strong> - admin@printshop.com</li>
                                <li><strong>Manager</strong> - manager@printshop.com</li>
                                <li><strong>Counter Staff</strong> - counter@printshop.com</li>
                                <li><strong>Production</strong> - production@printshop.com</li>
                                <li><strong>Accounts</strong> - accounts@printshop.com</li>
                            </ul>
                            <p className="hint">Default password for all: <code>password</code></p>
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="products-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2>Product Management</h2>
                            <button
                                className="btn-add"
                                onClick={() => {
                                    setEditingProduct(null);
                                    setEditForm({
                                        name: '',
                                        description: '',
                                        unit_cost: '',
                                        stock_qty: '',
                                        min_stock_alert: '',
                                        is_active: true,
                                    });
                                    setSelectedOutlets([]);
                                    // Trigger modal by setting a new product flag
                                    setShowAddModal(true);
                                }}
                            >
                                ➕ Add New Product
                            </button>
                        </div>
                        {loading ? (
                            <p>Loading products...</p>
                        ) : (
                            <table className="products-table">
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Base Price</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(product => (
                                        <tr key={product.id}>
                                            <td className="sku">{product.sku}</td>
                                            <td>{product.name}</td>
                                            <td>
                                                <span className={`type-badge ${product.type}`}>
                                                    {product.type}
                                                </span>
                                            </td>
                                            <td className="price">{getCurrencySymbol()}{Number(product.unit_cost).toFixed(2)}</td>
                                            <td>
                                                <span className={`status ${product.is_active ? 'active' : 'inactive'}`}>
                                                    {product.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-edit"
                                                        onClick={() => openEditModal(product)}
                                                        title="Edit Product"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        className="btn-toggle"
                                                        onClick={() => toggleProductStatus(product)}
                                                    >
                                                        {product.is_active ? 'Disable' : 'Enable'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="settings-section">
                        <h2>System Settings</h2>
                        <div className="settings-grid">
                            <div className="setting-card">
                                <h3>🏢 Branch/Outlet Management</h3>
                                <div style={{ marginBottom: '20px' }}>
                                    {outlets.map((outlet) => (
                                        <div key={outlet.id} style={{ 
                                            padding: '15px', 
                                            marginBottom: '10px', 
                                            border: '1px solid #e0e0e0', 
                                            borderRadius: '8px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <strong>{outlet.name}</strong> ({outlet.code})
                                                {outlet.address && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{outlet.address}</div>}
                                                {outlet.phone && <div style={{ fontSize: '12px', color: '#666' }}>Phone: {outlet.phone}</div>}
                                                {outlet.email && <div style={{ fontSize: '12px', color: '#666' }}>Email: {outlet.email}</div>}
                                            </div>
                                            <button 
                                                className="btn-edit"
                                                onClick={() => openEditOutlet(outlet)}
                                            >
                                                ✏️ Edit
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="setting-card">
                                <h3>🏪 Store Information</h3>
                                <div className="setting-row">
                                    <label>Tax Rate (%)</label>
                                    <input type="number" defaultValue="10" />
                                </div>
                                <div className="setting-row">
                                    <label>Currency</label>
                                    <select 
                                        value={currencySettings.code}
                                        onChange={(e) => {
                                            const currencyMap: Record<string, { symbol: string; code: string; name: string }> = {
                                                'MVR': { symbol: 'Rf', code: 'MVR', name: 'Maldivian Rufiyaa' },
                                                'USD': { symbol: '$', code: 'USD', name: 'US Dollar' },
                                                'EUR': { symbol: '€', code: 'EUR', name: 'Euro' },
                                                'GBP': { symbol: '£', code: 'GBP', name: 'British Pound' },
                                            };
                                            const newCurrency = currencyMap[e.target.value] || currencyMap['MVR'];
                                            const newSettings = { ...newCurrency, decimals: currencySettings.decimals };
                                            setCurrencySettings(newSettings);
                                            saveCurrencySettings(newSettings);
                                            alert('✅ Currency settings saved! Please refresh the page for changes to take effect.');
                                        }}
                                    >
                                        <option value="MVR">MVR (Rf) - Maldivian Rufiyaa</option>
                                        <option value="USD">USD ($) - US Dollar</option>
                                        <option value="EUR">EUR (€) - Euro</option>
                                        <option value="GBP">GBP (£) - British Pound</option>
                                    </select>
                                </div>
                                <div className="setting-row">
                                    <label>Decimal Places</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max="4"
                                        value={currencySettings.decimals}
                                        onChange={(e) => {
                                            const newSettings = { ...currencySettings, decimals: parseInt(e.target.value) || 2 };
                                            setCurrencySettings(newSettings);
                                            saveCurrencySettings(newSettings);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="setting-card">
                                <h3>📧 Notifications</h3>
                                <div className="setting-row checkbox">
                                    <input type="checkbox" id="email-orders" defaultChecked />
                                    <label htmlFor="email-orders">Email on new orders</label>
                                </div>
                                <div className="setting-row checkbox">
                                    <input type="checkbox" id="email-ready" defaultChecked />
                                    <label htmlFor="email-ready">Email when order ready</label>
                                </div>
                                <div className="setting-row checkbox">
                                    <input type="checkbox" id="low-stock" />
                                    <label htmlFor="low-stock">Low stock alerts</label>
                                </div>
                            </div>

                            <div className="setting-card">
                                <h3>🖨️ Receipt Settings</h3>
                                <div className="setting-row">
                                    <label>Receipt Header</label>
                                    <textarea defaultValue="Thank you for your order!" rows={3} />
                                </div>
                                <div className="setting-row">
                                    <label>Receipt Footer</label>
                                    <textarea defaultValue="Visit us again soon!" rows={3} />
                                </div>
                            </div>
                        </div>
                        <button className="btn-save">💾 Save Settings</button>
                    </div>
                )}

            {/* Edit Outlet Modal */}
            {editingOutlet && (
                <div className="modal-overlay" onClick={closeEditOutlet}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>✏️ Edit Outlet: {editingOutlet.name}</h2>
                        
                        <div className="form-group">
                            <label>Outlet Name *</label>
                            <input
                                type="text"
                                value={outletForm.name}
                                onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })}
                                placeholder="Outlet name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Outlet Code *</label>
                            <input
                                type="text"
                                value={outletForm.code}
                                onChange={(e) => setOutletForm({ ...outletForm, code: e.target.value.toUpperCase() })}
                                placeholder="e.g., CP-HIT"
                                style={{ textTransform: 'uppercase' }}
                            />
                            <small className="form-hint">Unique code for this outlet</small>
                        </div>

                        <div className="form-group">
                            <label>Address</label>
                            <textarea
                                value={outletForm.address}
                                onChange={(e) => setOutletForm({ ...outletForm, address: e.target.value })}
                                placeholder="Full address"
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                type="text"
                                value={outletForm.phone}
                                onChange={(e) => setOutletForm({ ...outletForm, phone: e.target.value })}
                                placeholder="Phone number"
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={outletForm.email}
                                onChange={(e) => setOutletForm({ ...outletForm, email: e.target.value })}
                                placeholder="Email address"
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={closeEditOutlet}>
                                Cancel
                            </button>
                            <button className="btn-save" onClick={saveOutlet}>
                                💾 Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>

            {/* Edit/Create Product Modal */}
            {(editingProduct || showAddModal) && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingProduct ? `✏️ Edit Product: ${editingProduct.sku}` : '➕ Add New Product'}</h2>
                        
                        {!editingProduct && (
                            <>
                                <div className="form-group">
                                    <label>SKU *</label>
                                    <input
                                        type="text"
                                        value={sku}
                                        onChange={(e) => setSku(e.target.value)}
                                        placeholder="e.g., PROD-001"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                    <small className="form-hint">Unique product identifier</small>
                                </div>

                                <div className="form-group">
                                    <label>Product Type *</label>
                                    <select
                                        value={productType}
                                        onChange={(e) => setProductType(e.target.value as 'inventory' | 'service' | 'dimension')}
                                    >
                                        <option value="inventory">Inventory (Tracked Stock)</option>
                                        <option value="service">Service</option>
                                        <option value="dimension">Dimension-Based (Priced by size)</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="form-group">
                            <label>Product Name *</label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Product name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Product description"
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                {(editingProduct?.type || productType) === 'dimension' ? 'Price per Square Foot *' : 'Unit Cost *'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.unit_cost}
                                onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })}
                                placeholder="0.00"
                            />
                            {(editingProduct?.type || productType) === 'dimension' && (
                                <small className="form-hint">Price per square foot for dimension-based products</small>
                            )}
                        </div>

                        {(editingProduct?.type || productType) === 'inventory' && (
                            <>
                                <div className="form-group">
                                    <label>Stock Quantity</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.stock_qty}
                                        onChange={(e) => setEditForm({ ...editForm, stock_qty: e.target.value })}
                                        placeholder="Current stock"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Min Stock Alert</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.min_stock_alert}
                                        onChange={(e) => setEditForm({ ...editForm, min_stock_alert: e.target.value })}
                                        placeholder="Alert when below this"
                                    />
                                </div>
                            </>
                        )}

                        <div className="form-group">
                            <label>Available Outlets *</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', border: '2px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                                {outlets.map((outlet) => (
                                    <label key={outlet.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOutlets.includes(outlet.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedOutlets([...selectedOutlets, outlet.id]);
                                                } else {
                                                    setSelectedOutlets(selectedOutlets.filter(id => id !== outlet.id));
                                                }
                                            }}
                                        />
                                        <span>{outlet.name}</span>
                                    </label>
                                ))}
                            </div>
                            <small className="form-hint">Select which outlets this product is available in. At least one outlet must be selected.</small>
                        </div>

                        <div className="form-group checkbox">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={editForm.is_active}
                                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                />
                                Active (Product is available for orders)
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={closeEditModal}>
                                Cancel
                            </button>
                            <button className="btn-save" onClick={saveProduct}>
                                {editingProduct ? '💾 Save Changes' : '➕ Create Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminApp;
