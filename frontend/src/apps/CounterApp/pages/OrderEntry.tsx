import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../config/api';
import { formatCurrency, formatAmount } from '../../../utils/currency';
import PaymentModal, { PaymentData } from '../../../components/shared/PaymentModal';
import ChangeAmountModal from '../../../components/shared/ChangeAmountModal';
import './OrderEntry.css';

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
    original_unit_price?: number; // Store original calculated price for comparison
}

interface CreatedOrder {
    id: number;
    order_number: string;
    total: number;
    balance: number;
}

interface Customer {
    id: number;
    name: string;
    phone?: string;
    type: string;
    credit_limit?: number;
    credit_balance?: number;
    credit_period_days?: number;
}

const OrderEntry: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [orderType, setOrderType] = useState<'walk_in' | 'invoice'>('walk_in');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
    const [showCustomerResults, setShowCustomerResults] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [calculatedPrice, setCalculatedPrice] = useState<{ unit_price: number, line_total: number } | null>(null);
    const [priceOverride, setPriceOverride] = useState<{ unit_price?: number; enabled: boolean }>({ enabled: false });

    // Payment modal state
    const [showPayment, setShowPayment] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
    const [createdOrderCustomer, setCreatedOrderCustomer] = useState<Customer | null>(null);
    const [requiresProduction, setRequiresProduction] = useState(true);
    const [showChangeModal, setShowChangeModal] = useState(false);
    const [changeAmount, setChangeAmount] = useState(0);

    useEffect(() => {
        fetchProducts();
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

    const getTotal = () => {
        return cart.reduce((sum, item) => sum + item.line_total, 0);
    };

    const canPlaceOrderOnCredit = (): { can: boolean; reason?: string } => {
        if (!selectedCustomer || selectedCustomer.type !== 'credit') {
            return { can: true };
        }

        const total = getTotal();
        const availableCredit = Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0);

        if (total > availableCredit) {
            return { 
                can: false, 
                reason: `Order total (${formatCurrency(total)}) exceeds available credit (${formatCurrency(availableCredit)})` 
            };
        }

        return { can: true };
    };

    useEffect(() => {
        if (selectedProduct) {
            calculatePrice();
        }
    }, [selectedProduct, quantity, width, height]);

    const calculatePrice = async () => {
        if (!selectedProduct) return;

        setLoading(true);
        try {
            const params: any = {
                product_id: selectedProduct.id,
                quantity: quantity,
            };

            if (selectedProduct.type === 'dimension' && width && height) {
                params.width = width;
                params.height = height;
            }

            const { data } = await apiClient.get(API_ENDPOINTS.PRICING_CALCULATE, { params });
            setCalculatedPrice({ unit_price: data.unit_price, line_total: data.line_total });
        } catch (error) {
            console.error('Failed to calculate price:', error);
            setCalculatedPrice({
                unit_price: Number(selectedProduct.unit_cost),
                line_total: Number(selectedProduct.unit_cost) * quantity
            });
        }
        setLoading(false);
    };

    const addToCart = () => {
        if (!selectedProduct || !calculatedPrice) return;

        // Use override price if enabled, otherwise use calculated price
        const finalUnitPrice = priceOverride.enabled && priceOverride.unit_price !== undefined 
            ? priceOverride.unit_price 
            : calculatedPrice.unit_price;
        
        // Calculate line total based on final unit price
        let finalLineTotal: number;
        if (selectedProduct.type === 'dimension' && width > 0 && height > 0) {
            // For dimension products: unit_price * width * height * quantity
            finalLineTotal = finalUnitPrice * width * height * quantity;
        } else {
            // For other products: unit_price * quantity
            finalLineTotal = finalUnitPrice * quantity;
        }

        const item: CartItem = {
            product: selectedProduct,
            quantity,
            width: selectedProduct.type === 'dimension' ? width : undefined,
            height: selectedProduct.type === 'dimension' ? height : undefined,
            unit_price: finalUnitPrice,
            line_total: finalLineTotal,
            description: selectedProduct.name + (selectedProduct.type === 'dimension' ? ` (${width}x${height} ft)` : ''),
            original_unit_price: calculatedPrice.unit_price, // Store original for comparison
        };

        setCart([...cart, item]);
        resetForm();
    };

    const resetForm = () => {
        setSelectedProduct(null);
        setQuantity(1);
        setWidth(0);
        setHeight(0);
        setCalculatedPrice(null);
        setPriceOverride({ enabled: false });
        setSearchTerm('');
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const submitOrder = async () => {
        if (cart.length === 0) return;

        // Check credit if invoice order for credit customer
        if (orderType === 'invoice' && selectedCustomer) {
            const creditCheck = canPlaceOrderOnCredit();
            if (!creditCheck.can) {
                const proceed = confirm(
                    `${creditCheck.reason}\n\n` +
                    `Customer can still:\n` +
                    `- Pay immediately and take items\n` +
                    `- Receive invoice after delivery (will be added to credit balance)\n\n` +
                    `Would you like to continue with invoice order?`
                );
                if (!proceed) return;
            }
        }

        setSubmitting(true);
        try {
            const orderData: any = {
                order_type: orderType,
                payment_terms: orderType === 'invoice' ? 'credit_30' : 'immediate',
                items: cart.map(item => {
                    // Check if price was overridden
                    const isOverridden = item.original_unit_price !== undefined && 
                                       Math.abs(item.unit_price - item.original_unit_price) > 0.01;
                    return {
                        product_id: item.product.id,
                        quantity: item.quantity,
                        width: item.width,
                        height: item.height,
                        description: item.description,
                        unit_price: item.unit_price, // Send the actual unit price (may be overridden)
                        override_reason: isOverridden ? 'Price manually adjusted by staff' : undefined,
                    };
                }),
            };

            if (selectedCustomer) {
                orderData.customer_id = selectedCustomer.id;
            }

            const { data } = await apiClient.post(API_ENDPOINTS.ORDERS, orderData);

            // For invoice orders (credit customers), invoice will be created after delivery
            // Don't show payment modal - order will be processed and invoice created on delivery
            if (orderType === 'invoice') {
                alert(`✅ Order ${data.order_number} created!\n\n📋 Order will be processed and invoice will be generated after delivery.`);
                setCart([]);
                setSelectedCustomer(null);
                setOrderType('walk_in');
                return;
            }

            // Fetch order with customer details
            const orderResponse = await apiClient.get(`/orders/${data.id}`);
            const orderWithCustomer = orderResponse.data;
            
            // Show payment modal for walk-in orders
            // Don't clear cart yet - only clear after successful payment
            setCreatedOrder({
                id: data.id,
                order_number: data.order_number,
                total: Number(data.total || 0),
                balance: Number(data.balance || data.total || 0),
            });
            setCreatedOrderCustomer(orderWithCustomer.customer || null);
            setShowPayment(true);
            // Cart will be cleared only after successful payment

        } catch (error: any) {
            alert('❌ Failed to create order: ' + (error.response?.data?.error || error.message));
        }
        setSubmitting(false);
    };

    // Pay Now - receive payment and process
    const handlePayNow = async (paymentData: PaymentData) => {
        if (!createdOrder) return;

        const orderTotal = Number(createdOrder.total || 0);
        const amount = paymentData.amount;

        // Build reference number with payment type info for card/transfer
        // Format: "POS - REF123" or "Bank of Maldives (BML) - REF456"
        let finalReferenceNumber = null;
        if (paymentData.method === 'card' || paymentData.method === 'transfer') {
            finalReferenceNumber = `${paymentData.bank} - ${paymentData.reference_number}`;
        }

        // Map frontend payment method to backend format
        const backendPaymentMethod = paymentData.method === 'transfer' ? 'bank_transfer' : paymentData.method;

        try {
            // First, record the actual payment (this updates paid_amount and balance)
            // All payment details (method, reference, amount) are captured for reporting
            await apiClient.post(API_ENDPOINTS.ORDER_PAYMENTS(createdOrder.id), {
                amount: amount,
                payment_method: backendPaymentMethod,
                reference_number: finalReferenceNumber,
            });

            // Payment recording will auto-update status to PAID if from DRAFT
            // Now move to production or ready/delivered based on requirements
            const isWalkInReadyToPick = !createdOrderCustomer && !requiresProduction;
            
            if (requiresProduction) {
                // Move to production - this creates service jobs
                await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(createdOrder.id), {
                    status: 'IN_PRODUCTION'
                });
            } else if (isWalkInReadyToPick) {
                // Walk-in customer, ready to pick - mark as RELEASED (delivered) immediately
                await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(createdOrder.id), {
                    status: 'RELEASED'
                });
            } else {
                // Has customer or needs to be picked up later - mark as ready
                await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(createdOrder.id), {
                    status: 'READY'
                });
            }

            // Check if cash payment and amount exceeds order total (for change calculation)
            const change = amount - orderTotal;

            // Show change modal if cash payment and amount exceeds total
            if (paymentData.method === 'cash' && change > 0) {
                setChangeAmount(change);
                setShowPayment(false);
                setShowChangeModal(true);
            } else {
                // Regular success message
                if (requiresProduction) {
                    alert(`✅ Order ${createdOrder.order_number} - Payment Received!\n\n💵 Amount: ${formatCurrency(amount)}\n📦 Sent to Production Queue`);
                } else if (isWalkInReadyToPick) {
                    alert(`✅ Order ${createdOrder.order_number} - Completed!\n\n💵 Amount: ${formatCurrency(amount)}\n✅ Delivered & Completed`);
                } else {
                    alert(`✅ Order ${createdOrder.order_number} - Payment Received!\n\n💵 Amount: ${formatCurrency(amount)}\n✅ Ready for Pickup`);
                }
                setShowPayment(false);
                setCreatedOrder(null);
                setCart([]); // Clear cart after successful payment
                setRequiresProduction(true);
            }
        } catch (error: any) {
            console.error('Payment error:', error.response?.data || error);
            alert('Error: ' + (error.response?.data?.error || error.message));
        }
    };


    // Pay Later - save order as pending payment and create invoice for credit customers
    const handlePayLater = async () => {
        if (!createdOrder) return;

        try {
            // If customer is credit customer, create invoice first
            if (createdOrderCustomer && createdOrderCustomer.type === 'credit') {
                try {
                    await apiClient.post(`/orders/${createdOrder.id}/invoice`);
                    // Refresh customer data to show updated credit balance
                    const customerResponse = await apiClient.get(`/customers/${createdOrderCustomer.id}`);
                    const updatedCustomer = customerResponse.data;
                    setCreatedOrderCustomer(updatedCustomer);
                    
                    // Update selected customer in the form if it's the same
                    if (selectedCustomer?.id === updatedCustomer.id) {
                        setSelectedCustomer(updatedCustomer);
                    }
                } catch (invoiceError: any) {
                    console.error('Invoice creation error:', invoiceError);
                    // Continue anyway - invoice might be created automatically by backend
                }
            }

            // Mark order as PENDING_PAYMENT
            await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(createdOrder.id), {
                status: 'PENDING_PAYMENT'
            });

            let message = '';
            if (createdOrderCustomer && createdOrderCustomer.type === 'credit') {
                message = `📋 Order ${createdOrder.order_number} - Pay Later\n\n` +
                    `📄 Invoice Created & Billed to Customer\n` +
                    `💰 Amount: ${formatCurrency(createdOrder.total)}\n` +
                    `💳 Added to Customer Credit Balance\n`;
            } else {
                message = `📋 Order ${createdOrder.order_number} - Pay Later\n\n` +
                    `💰 Due: ${formatCurrency(createdOrder.total)}\n`;
            }

            if (requiresProduction) {
                // Move to production
                await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(createdOrder.id), {
                    status: 'IN_PRODUCTION'
                });
                alert(message + `📦 Sent to Production Queue`);
            } else {
                // Mark as ready
                await apiClient.patch(API_ENDPOINTS.ORDER_STATUS(createdOrder.id), {
                    status: 'READY'
                });
                alert(message + `⚠️ Ready - Payment required before release`);
            }

            setShowPayment(false);
            setCreatedOrder(null);
            setCreatedOrderCustomer(null);
            setCart([]); // Clear cart after successful order
            setRequiresProduction(true);
        } catch (error: any) {
            console.error('Pay later error:', error.response?.data || error);
            alert('Error: ' + (error.response?.data?.error || error.message));
        }
    };

    const filteredProducts = products.filter((p: Product) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="order-entry">
            <div className="order-entry-header">
                <h1>🛒 New Order</h1>
            </div>
            
            {/* Customer & Order Type Selection */}
            <div className="customer-selection-section" style={{ 
                background: 'white', 
                padding: '20px', 
                marginBottom: '20px', 
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                    <div style={{ position: 'relative' }} className="customer-search-container">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Customer</label>
                        {selectedCustomer ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px',
                                border: '2px solid #3b82f6',
                                borderRadius: '8px',
                                background: '#f0f9ff'
                            }}>
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{selectedCustomer.name}</div>
                                    {selectedCustomer.phone && (
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                            📱 {selectedCustomer.phone}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCustomer(null);
                                        setCustomerSearchTerm('');
                                        setOrderType('walk_in');
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '18px',
                                        color: '#ef4444',
                                        padding: '0 8px'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <>
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
                                        fontSize: '14px'
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
                                                    // Auto-set order type based on customer type
                                                    if (customer.type === 'credit') {
                                                        setOrderType('invoice');
                                                    } else {
                                                        setOrderType('walk_in');
                                                    }
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
                                                {customer.type && (
                                                    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                                        Type: {customer.type}
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
                            </>
                        )}
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Order Type</label>
                        <select
                            value={orderType}
                            onChange={(e) => setOrderType(e.target.value as 'walk_in' | 'invoice')}
                            disabled={selectedCustomer?.type !== 'credit'}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '2px solid #e0e0e0',
                                borderRadius: '8px',
                                fontSize: '14px',
                                opacity: selectedCustomer?.type !== 'credit' ? 0.6 : 1
                            }}
                        >
                            <option value="walk_in">Walk-in (Pay Now)</option>
                            <option value="invoice">Invoice (Credit)</option>
                        </select>
                    </div>
                </div>
                
                {selectedCustomer && selectedCustomer.type === 'credit' && (
                    <div style={{ 
                        padding: '12px', 
                        background: '#f0f9ff', 
                        borderRadius: '8px',
                        border: '1px solid #bae6fd'
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: '10px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #bae6fd'
                        }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#0369a1' }}>
                                💳 Credit Customer Information
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '500' }}>Credit Limit:</span>
                            <span style={{ fontWeight: '600' }}>{formatCurrency(selectedCustomer.credit_limit)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '500' }}>Credit Used:</span>
                            <span style={{ fontWeight: '600', color: '#dc2626' }}>
                                {formatCurrency(selectedCustomer.credit_balance)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '500' }}>Available Credit:</span>
                            <span style={{ 
                                color: (Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0)) < getTotal() ? '#ef4444' : '#10b981',
                                fontWeight: '600',
                                fontSize: '15px'
                            }}>
                                {formatCurrency((Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0)))}
                            </span>
                        </div>
                        {selectedCustomer.credit_period_days && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                                <span>Credit Period:</span>
                                <span>{selectedCustomer.credit_period_days} days</span>
                            </div>
                        )}
                        {cart.length > 0 && (
                            <div style={{ 
                                marginTop: '10px', 
                                padding: '10px', 
                                background: getTotal() > (Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0)) 
                                    ? '#fee2e2' 
                                    : '#d1fae5',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: getTotal() > (Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0)) 
                                    ? '#991b1b' 
                                    : '#065f46',
                                border: `1px solid ${getTotal() > (Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0)) ? '#fca5a5' : '#86efac'}`
                            }}>
                                {orderType === 'invoice' ? (
                                    getTotal() > (Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.credit_balance || 0))
                                        ? `⚠️ Order total (${formatCurrency(getTotal())}) exceeds available credit. Customer can still pay immediately.`
                                        : `✓ Order will be invoiced after delivery and added to credit balance (${formatCurrency(getTotal())}).`
                                ) : (
                                    `💡 "Pay Later" will create an invoice and bill to customer credit (${formatCurrency(getTotal())}).`
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="order-entry-content">
                {/* Product Selection */}
                <div className="product-selection card">
                    <h2>Select Product</h2>

                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />

                    <div className="product-grid">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                className={`product-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                                onClick={() => setSelectedProduct(product)}
                            >
                                <div className="product-type">{product.type}</div>
                                <div className="product-name">{product.name}</div>
                                <div className="product-sku">{product.sku}</div>
                                <div className="product-price">{formatCurrency(product.unit_cost)}</div>
                            </div>
                        ))}
                    </div>

                    {selectedProduct && (
                        <div className="product-config">
                            <h3>Configure: {selectedProduct.name}</h3>

                            <div className="config-row">
                                <label>Quantity:</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                />
                            </div>

                            {selectedProduct.type === 'dimension' && (
                                <div className="dimension-inputs">
                                    <div className="config-row">
                                        <label>Width (ft):</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={width}
                                            onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="config-row">
                                        <label>Height (ft):</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={height}
                                            onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            )}

                            {calculatedPrice && (
                                <div className="price-display">
                                    <div className="price-row">
                                        <span>Calculated Unit Price:</span>
                                        <span>{formatCurrency(calculatedPrice.unit_price)}</span>
                                    </div>
                                    <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={priceOverride.enabled}
                                                onChange={(e) => {
                                                    setPriceOverride({
                                                        enabled: e.target.checked,
                                                        unit_price: e.target.checked ? calculatedPrice.unit_price : undefined
                                                    });
                                                }}
                                            />
                                            <span style={{ fontWeight: '600' }}>Override Price</span>
                                        </label>
                                        {priceOverride.enabled && (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                                                    Custom Unit Price:
                                                </label>
                                                <input
                                                    type="number"
                                                    value={priceOverride.unit_price || ''}
                                                    onChange={(e) => {
                                                        const overridePrice = Number(e.target.value) || 0;
                                                        setPriceOverride({ ...priceOverride, unit_price: overridePrice });
                                                    }}
                                                    placeholder="Enter custom price"
                                                    min="0"
                                                    step="0.01"
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="price-row total" style={{ marginTop: '10px' }}>
                                        <span>Line Total:</span>
                                        <span>
                                            {formatCurrency(
                                                priceOverride.enabled && priceOverride.unit_price !== undefined
                                                    ? (selectedProduct?.type === 'dimension' && width > 0 && height > 0
                                                        ? priceOverride.unit_price * width * height * quantity
                                                        : priceOverride.unit_price * quantity)
                                                    : calculatedPrice.line_total
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button
                                className="btn-add"
                                onClick={addToCart}
                                disabled={loading || !calculatedPrice}
                            >
                                ➕ Add to Order
                            </button>
                        </div>
                    )}
                </div>

                {/* Cart */}
                <div className="cart card">
                    <h2>Order Items ({cart.length})</h2>

                    {cart.length === 0 ? (
                        <p className="empty-cart">No items added yet</p>
                    ) : (
                        <>
                            <div className="cart-items">
                                {cart.map((item, index) => (
                                    <div key={index} className="cart-item">
                                        <div className="item-info">
                                            <div className="item-name">{item.description}</div>
                                            <div className="item-details">
                                                Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                                            </div>
                                        </div>
                                        <div className="item-total">{formatCurrency(item.line_total)}</div>
                                        <button className="btn-remove" onClick={() => removeFromCart(index)}>×</button>
                                    </div>
                                ))}
                            </div>

                            <div className="cart-summary">
                                <div className="summary-row">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(getTotal())}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Tax (10%):</span>
                                    <span>{formatCurrency(getTotal() * 0.1)}</span>
                                </div>
                                <div className="summary-row grand-total">
                                    <span>Total:</span>
                                    <span>{formatCurrency(getTotal() * 1.1)}</span>
                                </div>
                            </div>

                            <button
                                className="btn-submit"
                                onClick={submitOrder}
                                disabled={submitting}
                            >
                                {submitting 
                                    ? 'Creating Order...' 
                                    : orderType === 'invoice' 
                                        ? '✅ Create Invoice' 
                                        : '✅ Checkout & Pay'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {createdOrder && (
                <PaymentModal
                    isOpen={showPayment}
                    onClose={() => {
                        setShowPayment(false);
                        // Don't clear createdOrder or cart - allow user to go back to cart
                    }}
                    onSubmit={handlePayNow}
                    amount={createdOrder.total}
                    orderNumber={createdOrder.order_number}
                    title="Order Created!"
                    subtitle={createdOrderCustomer && createdOrderCustomer.type === 'credit' 
                        ? `💳 Credit Customer: ${createdOrderCustomer.name} | Available Credit: ${formatCurrency(Number(createdOrderCustomer.credit_limit || 0) - Number(createdOrderCustomer.credit_balance || 0))}`
                        : undefined}
                    showPayLater={!(!createdOrderCustomer && !requiresProduction)}
                    onPayLater={handlePayLater}
                    showProductionToggle={true}
                    requiresProduction={requiresProduction}
                    onProductionToggle={setRequiresProduction}
                    payLaterButtonText="Pay Later"
                    submitButtonText={!createdOrderCustomer && !requiresProduction 
                        ? 'Complete & Deliver' 
                        : 'Pay Now & Complete'}
                />
            )}

            {/* Change Amount Modal */}
            <ChangeAmountModal
                isOpen={showChangeModal}
                onClose={() => {
                    setShowChangeModal(false);
                    setCreatedOrder(null);
                    setCart([]); // Clear cart after successful payment
                    setRequiresProduction(true);
                }}
                changeAmount={changeAmount}
            />
        </div>
    );
};

export default OrderEntry;
