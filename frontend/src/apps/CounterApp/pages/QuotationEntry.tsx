import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency, getCurrencySymbol } from '../../../utils/currency';
import { generateQuotationHTML, printHTML } from '../../../components/shared/templates/printTemplates';
import './QuotationEntry.css';

interface Product {
    id: number;
    sku: string;
    name: string;
    type: 'inventory' | 'service' | 'dimension';
    unit_cost: number;
    is_active?: boolean;
}

interface CartItem {
    product: Product;
    quantity: number;
    width?: number;
    height?: number;
    unit_price: number;
    line_total: number;
    description: string;
}

interface Customer {
    id: number;
    name: string;
    email?: string;
    phone?: string;
}

interface CreatedQuotation {
    id: number;
    quote_number: string;
    total: number;
}

const QuotationEntry: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
    const [showCustomerResults, setShowCustomerResults] = useState(false);
    const [currentOutlet, setCurrentOutlet] = useState<{ id: number; name: string; code: string; address?: string; phone?: string; email?: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [calculatedPrice, setCalculatedPrice] = useState<{ unit_price: number, line_total: number } | null>(null);
    const [notes, setNotes] = useState('');
    const [validUntil, setValidUntil] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().split('T')[0];
    });
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [createdQuotation, setCreatedQuotation] = useState<CreatedQuotation | null>(null);

    useEffect(() => {
        fetchProducts();
        fetchCurrentOutlet();
    }, []);

    // Search customers when search term changes
    useEffect(() => {
        if (customerSearchTerm.trim().length >= 2) {
            searchCustomers(customerSearchTerm);
        } else {
            setCustomerSearchResults([]);
            setShowCustomerResults(false);
        }
    }, [customerSearchTerm]);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.customer-search-container')) {
                setShowCustomerResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchCurrentOutlet = async () => {
        try {
            const outletId = localStorage.getItem('outlet_id');
            if (outletId) {
                const { data } = await apiClient.get(`${API_ENDPOINTS.OUTLETS}/${outletId}`);
                setCurrentOutlet(data);
            }
        } catch (error) {
            console.error('Failed to fetch current outlet:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            // Only fetch active products
            const { data } = await apiClient.get(API_ENDPOINTS.PRODUCTS, {
                params: { is_active: true }
            });
            setProducts(data.data || data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    const searchCustomers = async (search: string) => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { search: search.trim() }
            });
            const results = data.data || data;
            setCustomerSearchResults(results);
            setShowCustomerResults(true);
        } catch (error) {
            console.error('Failed to search customers:', error);
            setCustomerSearchResults([]);
        }
    };

    const addNewCustomer = async () => {
        if (!newCustomerName.trim()) {
            alert('Please enter customer name');
            return;
        }
        if (!newCustomerPhone.trim()) {
            alert('Please enter customer phone number');
            return;
        }

        // Check for duplicates before submitting
        try {
            // Check by name
            const nameCheck = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { search: newCustomerName.trim() }
            });
            const nameResults = nameCheck.data.data || nameCheck.data;
            const existingByName = nameResults.find((c: Customer) => 
                c.name.toLowerCase().trim() === newCustomerName.toLowerCase().trim()
            );
            
            if (existingByName) {
                alert(`⚠️ Customer Already Exists!\n\nA customer with the name "${newCustomerName}" already exists.\n\nCustomer: ${existingByName.name}${existingByName.phone ? ` (${existingByName.phone})` : ''}`);
                return;
            }
            
            // Check by phone
            const phoneCheck = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { search: newCustomerPhone.trim() }
            });
            const phoneResults = phoneCheck.data.data || phoneCheck.data;
            const existingByPhone = phoneResults.find((c: Customer) => 
                c.phone && c.phone.trim() === newCustomerPhone.trim()
            );
            
            if (existingByPhone) {
                alert(`⚠️ Customer Already Exists!\n\nA customer with the phone number "${newCustomerPhone}" already exists.\n\nCustomer: ${existingByPhone.name}${existingByPhone.phone ? ` (${existingByPhone.phone})` : ''}`);
                return;
            }
        } catch (checkError) {
            // If search fails, proceed with creation (backend will catch duplicates)
            console.warn('Duplicate check failed, proceeding with creation:', checkError);
        }

        try {
            const { data } = await apiClient.post(API_ENDPOINTS.CUSTOMERS, {
                name: newCustomerName,
                email: newCustomerEmail || null,
                phone: newCustomerPhone,
                type: 'regular',
            });
            
            setCustomers([...customers, data]);
            setSelectedCustomer(data);
            setShowAddCustomer(false);
            setNewCustomerName('');
            setNewCustomerEmail('');
            setNewCustomerPhone('');
        } catch (error: any) {
            if (error.response?.status === 409 && error.response?.data?.error === 'duplicate') {
                const existingCustomer = error.response?.data?.existing_customer;
                const duplicateField = error.response?.data?.duplicate_field || 'name or phone';
                alert(`⚠️ Customer Already Exists!\n\n${error.response?.data?.message}\n\nCustomer: ${existingCustomer?.name}${existingCustomer?.phone ? ` (${existingCustomer.phone})` : ''}`);
            } else {
                alert('Failed to add customer: ' + (error.response?.data?.message || error.message));
            }
        }
    };

    const getTotal = () => {
        return cart.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    };

    const calculatePrice = async (product: Product, qty: number, w?: number, h?: number) => {
        try {
            const params: any = { product_id: product.id, quantity: qty };
            if (w && h && w > 0 && h > 0) {
                params.width = w;
                params.height = h;
            }
            if (selectedCustomer) {
                params.customer_id = selectedCustomer.id;
            }

            const { data } = await apiClient.get(API_ENDPOINTS.PRICING_CALCULATE, { params });
            setCalculatedPrice({
                unit_price: data.unit_price,
                line_total: data.line_total,
            });
        } catch (error) {
            console.error('Failed to calculate price:', error);
            // Fallback to product unit cost
            const unitCost = Number(product.unit_cost || 0);
            setCalculatedPrice({
                unit_price: unitCost,
                line_total: unitCost * qty,
            });
        }
    };

    const addToCart = () => {
        if (!selectedProduct) return;

        const unitPrice = calculatedPrice?.unit_price || Number(selectedProduct.unit_cost || 0);
        const lineTotal = calculatedPrice?.line_total || (unitPrice * quantity);

        const newItem: CartItem = {
            product: selectedProduct,
            quantity,
            width: width || undefined,
            height: height || undefined,
            unit_price: unitPrice,
            line_total: lineTotal,
            description: selectedProduct.name,
        };

        setCart([...cart, newItem]);
        setSelectedProduct(null);
        setQuantity(1);
        setWidth(0);
        setHeight(0);
        setCalculatedPrice(null);
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const generateQuotation = async () => {
        if (cart.length === 0) {
            alert('Please add at least one item to the quotation');
            return;
        }

        setSubmitting(true);
        try {
            const quotationData: any = {
                valid_until: validUntil,
                notes: notes || null,
                items: cart.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    width: item.width,
                    height: item.height,
                    description: item.description,
                })),
            };

            if (selectedCustomer) {
                quotationData.customer_id = selectedCustomer.id;
            }

            const { data } = await apiClient.post(API_ENDPOINTS.QUOTATIONS, quotationData);

            setCreatedQuotation({
                id: data.id,
                quote_number: data.quote_number,
                total: Number(data.total || 0),
            });

            // Clear form
            setCart([]);
            setSelectedCustomer(null);
            setNotes('');
            
            alert(`✅ Quotation ${data.quote_number} generated successfully!`);
        } catch (error: any) {
            alert('❌ Failed to generate quotation: ' + (error.response?.data?.error || error.message));
        }
        setSubmitting(false);
    };

    const printQuotation = async () => {
        if (!createdQuotation) return;

        try {
            const { data } = await apiClient.get(`${API_ENDPOINTS.QUOTATIONS}/${createdQuotation.id}`);
            const quotation = data;
            
            // Use shared template
            const quotationHTML = generateQuotationHTML(quotation as any);
            printHTML(quotationHTML);
        } catch (error: any) {
            alert('Failed to load quotation for printing: ' + (error.response?.data?.error || error.message));
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="quotation-entry">
            <div className="quotation-header">
                <h1>📄 Create Quotation</h1>
                <button onClick={() => navigate('/counter/quotations')} className="btn-back">
                    ← Back to Quotations
                </button>
            </div>

            <div className="quotation-layout">
                <div className="quotation-sidebar">
                    {/* Customer Selection */}
                    <div className="section">
                        <h2>👤 Customer</h2>
                        {selectedCustomer ? (
                            <div className="selected-customer">
                                <div>
                                    <strong>{selectedCustomer.name}</strong>
                                    {selectedCustomer.phone && (
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                            📱 {selectedCustomer.phone}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => {
                                    setSelectedCustomer(null);
                                    setCustomerSearchTerm('');
                                }} className="btn-clear">
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div style={{ position: 'relative' }} className="customer-search-container">
                                <input
                                    type="text"
                                    placeholder="Search customer by name or phone..."
                                    value={customerSearchTerm}
                                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                    onFocus={() => {
                                        if (customerSearchResults.length > 0) {
                                            setShowCustomerResults(true);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        marginBottom: '10px'
                                    }}
                                />
                                {showCustomerResults && customerSearchResults.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: 'white',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px',
                                        marginTop: '4px',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        zIndex: 1000,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}>
                                        {customerSearchResults.map(customer => (
                                            <div
                                                key={customer.id}
                                                onClick={() => {
                                                    setSelectedCustomer(customer);
                                                    setCustomerSearchTerm('');
                                                    setShowCustomerResults(false);
                                                }}
                                                style={{
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #f0f0f0',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#f0f9ff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'white';
                                                }}
                                            >
                                                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                                                    {customer.name}
                                                </div>
                                                {customer.phone && (
                                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                                        📱 {customer.phone}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showCustomerResults && customerSearchResults.length === 0 && customerSearchTerm.trim().length >= 2 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: 'white',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px',
                                        marginTop: '4px',
                                        padding: '12px',
                                        zIndex: 1000,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}>
                                        <div style={{ fontSize: '14px', color: '#666', textAlign: 'center' }}>
                                            No customers found
                                        </div>
                                    </div>
                                )}
                                <button
                                    className="btn-add-customer"
                                    onClick={() => setShowAddCustomer(!showAddCustomer)}
                                >
                                    ➕ Add Customer
                                </button>
                                {showAddCustomer && (
                                    <div className="add-customer-form">
                                        <input
                                            type="text"
                                            placeholder="Customer Name *"
                                            value={newCustomerName}
                                            onChange={(e) => setNewCustomerName(e.target.value)}
                                        />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            value={newCustomerEmail}
                                            onChange={(e) => setNewCustomerEmail(e.target.value)}
                                        />
                                        <input
                                            type="tel"
                                            placeholder="Phone *"
                                            value={newCustomerPhone}
                                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                                            required
                                        />
                                        <div className="form-actions">
                                            <button onClick={addNewCustomer} className="btn-save">
                                                Save
                                            </button>
                                            <button onClick={() => setShowAddCustomer(false)} className="btn-cancel">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Product Selection */}
                    <div className="section">
                        <h2>🛍️ Add Products</h2>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />

                        {selectedProduct && (
                            <div className="product-details">
                                <h3>{selectedProduct.name}</h3>
                                {selectedProduct.type === 'dimension' && (
                                    <div className="dimension-inputs">
                                        <input
                                            type="number"
                                            placeholder="Width"
                                            value={width || ''}
                                            onChange={(e) => {
                                                const w = parseFloat(e.target.value) || 0;
                                                setWidth(w);
                                                if (w && height) calculatePrice(selectedProduct, quantity, w, height);
                                            }}
                                        />
                                        <span>×</span>
                                        <input
                                            type="number"
                                            placeholder="Height"
                                            value={height || ''}
                                            onChange={(e) => {
                                                const h = parseFloat(e.target.value) || 0;
                                                setHeight(h);
                                                if (width && h) calculatePrice(selectedProduct, quantity, width, h);
                                            }}
                                        />
                                    </div>
                                )}
                                <input
                                    type="number"
                                    placeholder="Quantity"
                                    value={quantity}
                                    onChange={(e) => {
                                        const qty = parseInt(e.target.value) || 1;
                                        setQuantity(qty);
                                        calculatePrice(selectedProduct, qty, width || undefined, height || undefined);
                                    }}
                                    min="1"
                                />
                                {calculatedPrice && (
                                    <div className="price-preview">
                                        <div>Unit: ${Number(calculatedPrice.unit_price || 0).toFixed(2)}</div>
                                        <div>Total: ${Number(calculatedPrice.line_total || 0).toFixed(2)}</div>
                                    </div>
                                )}
                                <button onClick={addToCart} className="btn-add">
                                    ➕ Add to Quotation
                                </button>
                            </div>
                        )}

                        <div className="product-list">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    className="product-item"
                                    onClick={() => {
                                        setSelectedProduct(product);
                                        setQuantity(1);
                                        setWidth(0);
                                        setHeight(0);
                                        calculatePrice(product, 1);
                                    }}
                                >
                                    <div className="product-info">
                                        <strong>{product.name}</strong>
                                        <span className="product-sku">{product.sku}</span>
                                    </div>
                                    <div className="product-price">{formatCurrency(product.unit_cost)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="quotation-main">
                    {/* Cart */}
                    <div className="cart-section">
                        <h2>📋 Quotation Items</h2>
                        {cart.length === 0 ? (
                            <div className="empty-cart">No items added yet</div>
                        ) : (
                            <table className="cart-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Total</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, index) => (
                                        <tr key={index}>
                                            <td>
                                                {item.description}
                                                {item.width && item.height && (
                                                    <span className="dimension"> ({item.width}" × {item.height}")</span>
                                                )}
                                            </td>
                                            <td>{item.quantity}</td>
                                            <td>${Number(item.unit_price || 0).toFixed(2)}</td>
                                            <td>${Number(item.line_total || 0).toFixed(2)}</td>
                                            <td>
                                                <button onClick={() => removeFromCart(index)} className="btn-remove">
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3}><strong>Total:</strong></td>
                                        <td><strong>${getTotal().toFixed(2)}</strong></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>

                    {/* Quotation Details */}
                    <div className="quotation-details">
                        <h2>📝 Quotation Details</h2>
                        <div className="form-group">
                            <label>Valid Until</label>
                            <input
                                type="date"
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes for the quotation..."
                                rows={4}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="quotation-actions">
                        <button
                            onClick={generateQuotation}
                            disabled={submitting || cart.length === 0}
                            className="btn-generate"
                        >
                            {submitting ? 'Generating...' : '✅ Generate Quotation'}
                        </button>
                    </div>

                    {/* Print Section (after quotation is created) */}
                    {createdQuotation && (
                        <div className="quotation-created">
                            <div className="success-message">
                                <h3>✅ Quotation Generated!</h3>
                                <p>Quote Number: <strong>{createdQuotation.quote_number}</strong></p>
                                <p>Total: <strong>${Number(createdQuotation.total || 0).toFixed(2)}</strong></p>
                            </div>
                            <div className="created-actions">
                                <button onClick={printQuotation} className="btn-print">
                                    🖨️ Print Quotation
                                </button>
                                <button
                                    onClick={() => navigate(`/counter/quotations/${createdQuotation.id}`)}
                                    className="btn-view"
                                >
                                    👁️ View Details
                                </button>
                                <button
                                    onClick={() => {
                                        setCreatedQuotation(null);
                                        navigate('/counter/quotations');
                                    }}
                                    className="btn-new"
                                >
                                    ➕ New Quotation
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuotationEntry;

