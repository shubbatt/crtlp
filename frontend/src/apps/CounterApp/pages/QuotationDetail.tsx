import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/redux';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import { generateQuotationHTML, printHTML } from '../../../components/shared/templates/printTemplates';
import './QuotationDetail.css';

interface QuotationItem {
    id: number;
    description: string;
    quantity: number;
    dimensions?: { width: number; height: number; unit: string };
    unit_price: number;
    line_total: number;
    product?: { name: string; sku: string };
}

interface Quotation {
    id: number;
    quote_number: string;
    status: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    valid_until: string;
    notes?: string;
    customer?: { id: number; name: string; email?: string; phone?: string; type?: string };
    outlet?: { id: number; name: string; code: string; address?: string; phone?: string; email?: string };
    items?: QuotationItem[];
    created_at: string;
    converted_order_id?: number;
    approver?: { id: number; name: string };
}

const QuotationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Edit form state
    const [editNotes, setEditNotes] = useState('');
    const [editValidUntil, setEditValidUntil] = useState('');
    const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
    const [showCustomerResults, setShowCustomerResults] = useState(false);
    
    // Item editing state
    const [products, setProducts] = useState<any[]>([]);
    const [showAddItem, setShowAddItem] = useState(false);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemWidth, setItemWidth] = useState<number>(0);
    const [itemHeight, setItemHeight] = useState<number>(0);
    const [itemDescription, setItemDescription] = useState('');
    const [calculatedPrice, setCalculatedPrice] = useState<{ unit_price: number, line_total: number } | null>(null);
    const [isAddingItem, setIsAddingItem] = useState(false);

    useEffect(() => {
        fetchQuotation();
        fetchProducts();
    }, [id]);

    const fetchProducts = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.PRODUCTS, {
                params: { active: true }
            });
            const productsList = Array.isArray(data) ? data : (data.data || []);
            setProducts(productsList.filter((p: any) => p.is_active !== false));
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    // Search customers when search term changes
    useEffect(() => {
        if (customerSearchTerm.trim().length >= 2) {
            searchCustomers(customerSearchTerm);
        } else {
            setCustomerSearchResults([]);
            setShowCustomerResults(false);
        }
    }, [customerSearchTerm]);

    // Recalculate price when quantity, width, or height changes
    useEffect(() => {
        if (selectedProduct && (itemQuantity > 0 || itemWidth > 0 || itemHeight > 0)) {
            calculatePrice(selectedProduct, itemQuantity, itemWidth > 0 ? itemWidth : undefined, itemHeight > 0 ? itemHeight : undefined);
        }
    }, [selectedProduct, itemQuantity, itemWidth, itemHeight]);

    const fetchQuotation = async () => {
        try {
            const { data } = await apiClient.get(`${API_ENDPOINTS.QUOTATIONS}/${id}`);
            setQuotation(data);
            // Initialize edit form
            setEditNotes(data.notes || '');
            setEditValidUntil(data.valid_until ? new Date(data.valid_until).toISOString().split('T')[0] : '');
            setEditCustomerId(data.customer?.id || null);
        } catch (error) {
            console.error('Failed to fetch quotation:', error);
            alert('Failed to load quotation');
        }
        setLoading(false);
    };

    const canEdit = () => {
        return quotation && ['draft', 'sent'].includes(quotation.status);
    };

    const searchCustomers = async (term: string) => {
        if (term.trim().length < 2) {
            setCustomerSearchResults([]);
            setShowCustomerResults(false);
            return;
        }
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.CUSTOMERS, {
                params: { search: term.trim() }
            });
            const results = Array.isArray(data) ? data : (data.data || []);
            setCustomerSearchResults(results);
            setShowCustomerResults(true);
        } catch (error) {
            console.error('Failed to search customers:', error);
        }
    };

    const handleSaveQuotation = async () => {
        if (!quotation) return;
        
        setIsSaving(true);
        try {
            await apiClient.put(`${API_ENDPOINTS.QUOTATIONS}/${quotation.id}`, {
                customer_id: editCustomerId,
                notes: editNotes,
                valid_until: editValidUntil,
            });
            alert('✅ Quotation updated successfully!');
            setIsEditing(false);
            fetchQuotation();
        } catch (error: any) {
            alert('Failed to update quotation: ' + (error.response?.data?.error || error.message));
        }
        setIsSaving(false);
    };

    const handleRemoveItem = async (itemId: number) => {
        if (!quotation) return;
        if (!confirm('Remove this item from the quotation?')) return;
        
        try {
            await apiClient.delete(API_ENDPOINTS.QUOTATION_ITEM_DELETE(quotation.id, itemId));
            alert('✅ Item removed successfully!');
            fetchQuotation();
        } catch (error: any) {
            alert('Failed to remove item: ' + (error.response?.data?.error || error.message));
        }
    };

    const calculatePrice = async (product: any, qty: number, w?: number, h?: number) => {
        if (!product) return;
        try {
            const params: any = { product_id: product.id, quantity: qty };
            if (w && h && w > 0 && h > 0) {
                params.width = w;
                params.height = h;
            }
            if (quotation?.customer?.id) {
                params.customer_id = quotation.customer.id;
            }

            const { data } = await apiClient.get(API_ENDPOINTS.PRICING_CALCULATE, { params });
            setCalculatedPrice({
                unit_price: data.unit_price,
                line_total: data.line_total,
            });
        } catch (error) {
            console.error('Failed to calculate price:', error);
            const unitCost = Number(product.unit_cost || 0);
            setCalculatedPrice({
                unit_price: unitCost,
                line_total: unitCost * qty,
            });
        }
    };

    const handleProductSelect = (product: any) => {
        setSelectedProduct(product);
        setItemDescription(product.name);
        calculatePrice(product, itemQuantity, itemWidth || undefined, itemHeight || undefined);
    };

    const handleAddItem = async () => {
        if (!quotation || !selectedProduct) {
            alert('Please select a product');
            return;
        }

        setIsAddingItem(true);
        try {
            await apiClient.post(API_ENDPOINTS.QUOTATION_ITEMS(quotation.id), {
                product_id: selectedProduct.id,
                quantity: itemQuantity,
                width: itemWidth > 0 ? itemWidth : null,
                height: itemHeight > 0 ? itemHeight : null,
                description: itemDescription || selectedProduct.name,
            });
            alert('✅ Item added successfully!');
            setShowAddItem(false);
            resetItemForm();
            fetchQuotation();
        } catch (error: any) {
            alert('Failed to add item: ' + (error.response?.data?.error || error.message));
        }
        setIsAddingItem(false);
    };

    const handleUpdateItem = async (itemId: number) => {
        if (!quotation || !selectedProduct) {
            alert('Please select a product');
            return;
        }

        try {
            await apiClient.put(API_ENDPOINTS.QUOTATION_ITEM_UPDATE(quotation.id, itemId), {
                product_id: selectedProduct.id,
                quantity: itemQuantity,
                width: itemWidth > 0 ? itemWidth : null,
                height: itemHeight > 0 ? itemHeight : null,
                description: itemDescription || selectedProduct.name,
            });
            alert('✅ Item updated successfully!');
            setEditingItemId(null);
            resetItemForm();
            fetchQuotation();
        } catch (error: any) {
            alert('Failed to update item: ' + (error.response?.data?.error || error.message));
        }
    };

    const resetItemForm = () => {
        setSelectedProduct(null);
        setItemQuantity(1);
        setItemWidth(0);
        setItemHeight(0);
        setItemDescription('');
        setCalculatedPrice(null);
    };

    const startEditItem = (item: QuotationItem) => {
        // Try to find product by ID first, then by name
        const product = products.find(p => {
            if (item.product && 'id' in item.product) {
                return p.id === (item.product as any).id;
            }
            return p.name === item.description;
        });
        setEditingItemId(item.id);
        setSelectedProduct(product || null);
        setItemQuantity(item.quantity);
        setItemWidth(item.dimensions?.width || 0);
        setItemHeight(item.dimensions?.height || 0);
        setItemDescription(item.description);
        if (product) {
            calculatePrice(product, item.quantity, item.dimensions?.width, item.dimensions?.height);
        }
    };

    const printQuotation = () => {
        if (!quotation) return;
        const quotationHTML = generateQuotationHTML(quotation as any);
        printHTML(quotationHTML);
    };

    const approveQuotation = async () => {
        if (!quotation) return;

        if (!confirm(`Approve quotation ${quotation.quote_number}?`)) return;

        setIsApproving(true);
        try {
            await apiClient.patch(API_ENDPOINTS.QUOTATION_STATUS(quotation.id), {
                status: 'approved'
            });
            alert('✅ Quotation approved successfully!');
            fetchQuotation();
        } catch (error: any) {
            alert('Failed to approve: ' + (error.response?.data?.error || error.message));
        }
        setIsApproving(false);
    };

    const convertToOrder = async () => {
        if (!quotation) return;

        if (quotation.status === 'converted') {
            alert('This quotation has already been converted to an order');
            return;
        }

        if (quotation.status !== 'approved') {
            alert('Quotation must be approved before converting to order');
            return;
        }

        // Order type is automatically determined by backend based on customer type
        // Show modal to confirm conversion
        setShowConvertModal(true);
    };

    const performConvert = async () => {
        if (!quotation) return;

        try {
            // Order type is automatically determined by backend based on customer type:
            // - Credit customer -> invoice order (credit procedure)
            // - Cash/regular customer -> walk_in order (pay procedure)
            // No need to send order_type or create_invoice - backend handles it
            const { data } = await apiClient.post(API_ENDPOINTS.QUOTATION_CONVERT(quotation.id), {});
            
            const orderTypeMessage = data.order_type_message || 
                (quotation.customer?.type === 'credit' 
                    ? 'Credit customer - Invoice order created (invoice will be generated after delivery)'
                    : 'Cash customer - Order created with payment');
            
            alert(`✅ Quotation converted to order ${data.order.order_number}!\n\n${orderTypeMessage}`);
            setShowConvertModal(false);
            navigate(`/counter/orders/${data.order.id}`);
        } catch (error: any) {
            alert('Failed to convert: ' + (error.response?.data?.error || error.message));
        }
    };

    const canApprove = () => {
        return user && (user.role === 'admin' || user.role === 'manager');
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: '#6b7280',
            sent: '#3b82f6',
            approved: '#10b981',
            expired: '#f59e0b',
            converted: '#8b5cf6',
        };
        return colors[status] || '#6b7280';
    };

    if (loading) {
        return <div className="loading">Loading quotation...</div>;
    }

    if (!quotation) {
        return <div className="error">Quotation not found</div>;
    }

    return (
        <div className="quotation-detail">
            <div className="detail-header">
                <button onClick={() => navigate('/counter/quotations')} className="btn-back">
                    ← Back to Quotations
                </button>
                <div className="header-info">
                    <h1>Quotation {quotation.quote_number}</h1>
                    <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(quotation.status) }}
                    >
                        {quotation.status.toUpperCase()}
                    </span>
                </div>
                {canEdit() && (
                    <div className="header-actions">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="btn-edit">
                                ✏️ Edit Quotation
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={handleSaveQuotation} 
                                    className="btn-save"
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : '💾 Save Changes'}
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsEditing(false);
                                        fetchQuotation(); // Reset form
                                    }} 
                                    className="btn-cancel"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="detail-content">
                <div className="info-section">
                    <h2>Customer Information</h2>
                    <div className="info-card">
                        {isEditing ? (
                            <div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                                        Customer:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Search customer by name or phone..."
                                        value={customerSearchTerm}
                                        onChange={(e) => {
                                            setCustomerSearchTerm(e.target.value);
                                            searchCustomers(e.target.value);
                                        }}
                                        onFocus={() => {
                                            if (customerSearchTerm.trim().length >= 2) {
                                                setShowCustomerResults(true);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px'
                                        }}
                                    />
                                    {showCustomerResults && customerSearchResults.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            background: 'white',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            marginTop: '4px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 1000,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                        }}>
                                            {customerSearchResults.map((customer: any) => (
                                                <div
                                                    key={customer.id}
                                                    onClick={() => {
                                                        setEditCustomerId(customer.id);
                                                        setCustomerSearchTerm(customer.name);
                                                        setShowCustomerResults(false);
                                                    }}
                                                    style={{
                                                        padding: '10px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #eee'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                >
                                                    <div style={{ fontWeight: '600' }}>{customer.name}</div>
                                                    {customer.phone && (
                                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                                            {customer.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {editCustomerId && (
                                        <button
                                            onClick={() => {
                                                setEditCustomerId(null);
                                                setCustomerSearchTerm('');
                                            }}
                                            style={{
                                                marginTop: '5px',
                                                padding: '5px 10px',
                                                background: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Clear Customer
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="info-row">
                                    <span className="label">Name:</span>
                                    <span className="value">{quotation.customer?.name || 'Walk-in Customer'}</span>
                                </div>
                                {quotation.customer?.email && (
                                    <div className="info-row">
                                        <span className="label">Email:</span>
                                        <span className="value">{quotation.customer.email}</span>
                                    </div>
                                )}
                                {quotation.customer?.phone && (
                                    <div className="info-row">
                                        <span className="label">Phone:</span>
                                        <span className="value">{quotation.customer.phone}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="info-section">
                    <h2>Quotation Details</h2>
                    <div className="info-card">
                        <div className="info-row">
                            <span className="label">Quote Number:</span>
                            <span className="value">{quotation.quote_number}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Created:</span>
                            <span className="value">{new Date(quotation.created_at).toLocaleString()}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Valid Until:</span>
                            {isEditing ? (
                                <input
                                    type="date"
                                    value={editValidUntil}
                                    onChange={(e) => setEditValidUntil(e.target.value)}
                                    style={{
                                        padding: '5px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px'
                                    }}
                                />
                            ) : (
                                <span className={`value ${new Date(quotation.valid_until) < new Date() ? 'expired' : ''}`}>
                                    {new Date(quotation.valid_until).toLocaleDateString()}
                                    {new Date(quotation.valid_until) < new Date() && ' ⚠️ Expired'}
                                </span>
                            )}
                        </div>
                        {quotation.approver && (
                            <div className="info-row">
                                <span className="label">Approved by:</span>
                                <span className="value">{quotation.approver.name}</span>
                            </div>
                        )}
                        {quotation.converted_order_id && (
                            <div className="info-row">
                                <span className="label">Converted to Order:</span>
                                <span className="value">
                                    <a href={`/counter/orders/${quotation.converted_order_id}`}>
                                        View Order #{quotation.converted_order_id}
                                    </a>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="items-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2>Items</h2>
                        {isEditing && (
                            <button
                                onClick={() => {
                                    setShowAddItem(true);
                                    resetItemForm();
                                }}
                                className="btn-add"
                                style={{
                                    padding: '8px 16px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                ➕ Add Item
                            </button>
                        )}
                    </div>
                    <table className="items-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Qty</th>
                                <th className="text-right">Unit Price</th>
                                <th className="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotation.items?.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        {item.description}
                                        {item.dimensions && (
                                            <span className="dimension">
                                                {' '}({item.dimensions.width}" × {item.dimensions.height}")
                                            </span>
                                        )}
                                    </td>
                                    <td>{item.quantity}</td>
                                    <td className="text-right">{formatCurrency(item.unit_price)}</td>
                                    <td className="text-right">
                                        {formatCurrency(item.line_total)}
                                        {isEditing && (
                                            <div style={{ display: 'inline-flex', gap: '5px', marginLeft: '10px' }}>
                                                <button
                                                    onClick={() => startEditItem(item)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={2}><strong>Subtotal:</strong></td>
                                <td colSpan={2} className="text-right">
                                    <strong>{formatCurrency(quotation.subtotal)}</strong>
                                </td>
                            </tr>
                            {quotation.discount > 0 && (
                                <tr>
                                    <td colSpan={2}><strong>Discount:</strong></td>
                                    <td colSpan={2} className="text-right">
                                        <strong>-{formatCurrency(quotation.discount)}</strong>
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <td colSpan={2}><strong>Tax:</strong></td>
                                <td colSpan={2} className="text-right">
                                    <strong>{formatCurrency(quotation.tax)}</strong>
                                </td>
                            </tr>
                            <tr className="total-row">
                                <td colSpan={2}><strong>TOTAL:</strong></td>
                                <td colSpan={2} className="text-right">
                                    <strong>{formatCurrency(quotation.total)}</strong>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="notes-section">
                    <h2>Notes</h2>
                    {isEditing ? (
                        <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Add notes..."
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontFamily: 'inherit'
                            }}
                        />
                    ) : (
                        <div className="notes-content">{quotation.notes || 'No notes'}</div>
                    )}
                </div>

                <div className="actions-section">
                    <button onClick={printQuotation} className="btn-print">
                        🖨️ Print Quotation
                    </button>
                    {quotation.status === 'draft' && canApprove() && !isEditing && (
                        <button 
                            onClick={approveQuotation} 
                            className="btn-approve"
                            disabled={isApproving}
                        >
                            {isApproving ? 'Approving...' : '✅ Approve Quotation'}
                        </button>
                    )}
                    {quotation.status === 'approved' && !quotation.converted_order_id && (
                        <button 
                            onClick={convertToOrder} 
                            className="btn-convert"
                            disabled={isEditing}
                            title={isEditing ? 'Please save your changes before converting' : ''}
                        >
                            ➡️ Send to Production (Convert to Order)
                        </button>
                    )}
                </div>
            </div>

            {/* Convert to Order Modal */}
            {showConvertModal && (
                <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
                    <div className="modal convert-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Convert to Order</h2>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                            <div style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600' }}>
                                {quotation?.customer?.type === 'credit' 
                                    ? '💳 Credit Customer - Invoice Order'
                                    : '💵 Cash Customer - Regular Order'}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                                {quotation?.customer?.type === 'credit' 
                                    ? 'Order will be created as invoice order. Invoice will be generated after delivery.'
                                    : 'Order will be created with payment. Customer will pay at delivery.'}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button 
                                onClick={() => setShowConvertModal(false)} 
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    performConvert();
                                }} 
                                className="btn-confirm"
                            >
                                Convert to Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Item Modal */}
            {(showAddItem || editingItemId) && (
                <div className="modal-overlay" onClick={() => {
                    setShowAddItem(false);
                    setEditingItemId(null);
                    resetItemForm();
                }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2>{editingItemId ? 'Edit Item' : 'Add Item'}</h2>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                                Product: *
                            </label>
                            <select
                                value={selectedProduct?.id || ''}
                                onChange={(e) => {
                                    const product = products.find(p => p.id === Number(e.target.value));
                                    if (product) handleProductSelect(product);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                                required
                            >
                                <option value="">Select a product...</option>
                                {products.map(product => (
                                    <option key={product.id} value={product.id}>
                                        {product.name} ({product.sku})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedProduct && (
                            <>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                                        Description:
                                    </label>
                                    <input
                                        type="text"
                                        value={itemDescription}
                                        onChange={(e) => setItemDescription(e.target.value)}
                                        placeholder={selectedProduct.name}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px'
                                        }}
                                    />
                                </div>

                                {selectedProduct.type === 'dimension' && (
                                    <>
                                        <div style={{ marginBottom: '15px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                                                Width (ft):
                                            </label>
                                            <input
                                                type="number"
                                                value={itemWidth || ''}
                                                onChange={(e) => {
                                                    const w = Number(e.target.value) || 0;
                                                    setItemWidth(w);
                                                    calculatePrice(selectedProduct, itemQuantity, w, itemHeight || undefined);
                                                }}
                                                min="0"
                                                step="0.01"
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px'
                                                }}
                                            />
                                        </div>
                                        <div style={{ marginBottom: '15px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                                                Height (ft):
                                            </label>
                                            <input
                                                type="number"
                                                value={itemHeight || ''}
                                                onChange={(e) => {
                                                    const h = Number(e.target.value) || 0;
                                                    setItemHeight(h);
                                                    calculatePrice(selectedProduct, itemQuantity, itemWidth || undefined, h);
                                                }}
                                                min="0"
                                                step="0.01"
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px'
                                                }}
                                            />
                                        </div>
                                    </>
                                )}

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                                        Quantity: *
                                    </label>
                                    <input
                                        type="number"
                                        value={itemQuantity}
                                        onChange={(e) => {
                                            const qty = Number(e.target.value) || 1;
                                            setItemQuantity(qty);
                                            calculatePrice(selectedProduct, qty, itemWidth || undefined, itemHeight || undefined);
                                        }}
                                        min="1"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px'
                                        }}
                                        required
                                    />
                                </div>

                                {calculatedPrice && (
                                    <div style={{
                                        padding: '15px',
                                        background: '#f5f5f5',
                                        borderRadius: '4px',
                                        marginBottom: '15px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span>Unit Price:</span>
                                            <strong>{formatCurrency(calculatedPrice.unit_price)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Line Total:</span>
                                            <strong>{formatCurrency(calculatedPrice.line_total)}</strong>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="modal-actions">
                            <button
                                onClick={() => {
                                    setShowAddItem(false);
                                    setEditingItemId(null);
                                    resetItemForm();
                                }}
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (editingItemId) {
                                        handleUpdateItem(editingItemId);
                                    } else {
                                        handleAddItem();
                                    }
                                }}
                                className="btn-confirm"
                                disabled={!selectedProduct || isAddingItem}
                            >
                                {isAddingItem ? 'Adding...' : (editingItemId ? 'Update Item' : 'Add Item')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuotationDetail;

