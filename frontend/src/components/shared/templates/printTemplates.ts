import { formatAmount, getCurrencySymbol } from '../../../utils/currency';

interface Outlet {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
}

interface Customer {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
}

interface OrderItem {
    description?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    dimensions?: { width: number; height: number };
    product?: { name: string };
}

interface Invoice {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    purchase_order_number?: string;
    status: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    outlet?: Outlet;
    customer?: Customer;
    order?: {
        items?: OrderItem[];
        order_number?: string;
    };
}

interface Order {
    order_number: string;
    created_at: string;
    status: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    customer?: Customer;
    items?: OrderItem[];
    outlet?: Outlet;
    payments?: Array<{
        method: string;
        amount: number;
        created_at: string;
    }>;
}

interface Quotation {
    quote_number: string;
    created_at: string;
    valid_until: string;
    status: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    customer?: Customer;
    items?: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        line_total: number;
        dimensions?: { width: number; height: number };
    }>;
    outlet?: Outlet;
}

/**
 * Get customer display name (returns 'Walk-in' for null/empty/N/A)
 */
const getCustomerName = (customer?: Customer | null): string => {
    if (!customer || !customer.name || customer.name === 'N/A') {
        return 'Walk-in';
    }
    return customer.name;
};

/**
 * Generate invoice HTML template
 */
export const generateInvoiceHTML = (invoice: Invoice): string => {
    const currencySymbol = getCurrencySymbol();
    const customerName = getCustomerName(invoice.customer);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice ${invoice.invoice_number}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            color: #1f2937;
            font-size: 12px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
        }
        .company-info h1 {
            margin: 0;
            color: #3b82f6;
            font-size: 24px;
        }
        .invoice-info {
            text-align: right;
        }
        .invoice-info h2 {
            margin: 0;
            color: #1f2937;
            font-size: 20px;
        }
        .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .detail-section h3 {
            margin: 0 0 10px 0;
            color: #3b82f6;
            font-size: 14px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background: #3b82f6;
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
        }
        .totals {
            margin-top: 20px;
            text-align: right;
        }
        .total-row {
            display: flex;
            justify-content: flex-end;
            margin: 5px 0;
        }
        .total-row span {
            min-width: 150px;
            text-align: right;
        }
        .grand-total {
            font-size: 18px;
            font-weight: bold;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 2px solid #3b82f6;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 11px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>Invoice</h1>
            ${invoice.outlet ? `
            <p><strong>${invoice.outlet.name || 'Company Name'}</strong></p>
            ${invoice.outlet.address ? `<p>${invoice.outlet.address}</p>` : ''}
            ${invoice.outlet.phone ? `<p>Phone: ${invoice.outlet.phone}</p>` : ''}
            ${invoice.outlet.email ? `<p>Email: ${invoice.outlet.email}</p>` : ''}
            ` : '<p><strong>Company Name</strong></p>'}
        </div>
        <div class="invoice-info">
            <h2>${invoice.invoice_number}</h2>
            <p><strong>Invoice Date:</strong> ${new Date(invoice.issue_date).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
            ${invoice.purchase_order_number ? `<p><strong>PO Number:</strong> ${invoice.purchase_order_number}</p>` : ''}
        </div>
    </div>

    <div class="details">
        <div class="detail-section">
            <h3>Bill To:</h3>
            ${invoice.customer ? `
            <p><strong>${customerName}</strong></p>
            ${invoice.customer.email ? `<p>${invoice.customer.email}</p>` : ''}
            ${invoice.customer.phone ? `<p>${invoice.customer.phone}</p>` : ''}
            ${invoice.customer.address ? `<p>${invoice.customer.address}</p>` : ''}
            ` : '<p>Walk-in</p>'}
        </div>
        <div class="detail-section">
            <h3>Invoice Details:</h3>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
            ${invoice.order?.order_number ? `<p><strong>Order #:</strong> ${invoice.order.order_number}</p>` : ''}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.order?.items?.map((item: OrderItem) => `
                <tr>
                    <td>${item.description || item.product?.name || 'Item'}</td>
                    <td style="text-align: right;">${item.quantity}</td>
                    <td style="text-align: right;">${currencySymbol}${formatAmount(item.unit_price)}</td>
                    <td style="text-align: right;">${currencySymbol}${formatAmount(item.line_total)}</td>
                </tr>
            `).join('') || '<tr><td colspan="4" style="text-align: center;">No items</td></tr>'}
        </tbody>
    </table>

    <div class="totals">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>${currencySymbol}${formatAmount(invoice.subtotal)}</span>
        </div>
        ${Number(invoice.discount || 0) > 0 ? `
        <div class="total-row">
            <span>Discount:</span>
            <span>-${currencySymbol}${formatAmount(invoice.discount)}</span>
        </div>
        ` : ''}
        <div class="total-row">
            <span>Tax:</span>
            <span>${currencySymbol}${formatAmount(invoice.tax)}</span>
        </div>
        <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>${currencySymbol}${formatAmount(invoice.total)}</span>
        </div>
        ${Number(invoice.paid_amount || 0) > 0 ? `
        <div class="total-row">
            <span>Paid:</span>
            <span>${currencySymbol}${formatAmount(invoice.paid_amount)}</span>
        </div>
        ` : ''}
        ${Number(invoice.balance || 0) > 0 ? `
        <div class="total-row" style="color: #ef4444; font-weight: bold;">
            <span>Balance:</span>
            <span>${currencySymbol}${formatAmount(invoice.balance)}</span>
        </div>
        ` : ''}
    </div>

    <div class="footer">
        <p>Thank you for your business!</p>
    </div>
</body>
</html>
    `;
};

/**
 * Generate receipt HTML template
 */
export const generateReceiptHTML = (order: Order): string => {
    const currencySymbol = getCurrencySymbol();
    const customerName = getCustomerName(order.customer);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Receipt ${order.order_number}</title>
    <style>
        @media print {
            @page {
                size: 80mm auto;
                margin: 0;
            }
            body {
                margin: 0;
                padding: 10mm;
            }
        }
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10mm;
            line-height: 1.4;
        }
        .receipt-header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .receipt-header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
        }
        .receipt-header p {
            margin: 4px 0;
            font-size: 10px;
        }
        .branch-details {
            margin-top: 5px;
            font-size: 9px;
        }
        .branch-details p {
            margin: 2px 0;
        }
        .receipt-info {
            margin: 10px 0;
            font-size: 11px;
        }
        .receipt-info strong {
            display: inline-block;
            min-width: 80px;
        }
        .items-table {
            width: 100%;
            margin: 15px 0;
            border-collapse: collapse;
        }
        .items-table th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 5px 0;
            font-size: 10px;
        }
        .items-table td {
            padding: 4px 0;
            font-size: 11px;
        }
        .items-table .item-desc {
            width: 60%;
        }
        .items-table .item-qty {
            text-align: center;
            width: 15%;
        }
        .items-table .item-price {
            text-align: right;
            width: 25%;
        }
        .totals {
            border-top: 2px dashed #000;
            padding-top: 10px;
            margin-top: 10px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 11px;
        }
        .total-row.grand {
            font-weight: bold;
            font-size: 14px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #000;
        }
        .payment-info {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px dashed #000;
            font-size: 11px;
        }
        .payment-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
        }
        .receipt-footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 10px;
        }
        .thank-you {
            font-weight: bold;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="receipt-header">
        <h1>🖨️ RECEIPT</h1>
        ${order.outlet ? `
        <p><strong>${order.outlet.name || 'Company Name'}</strong></p>
        ${order.outlet.address ? `<p>${order.outlet.address}</p>` : ''}
        <div class="branch-details">
            ${order.outlet.phone ? `<p>Tel: ${order.outlet.phone}</p>` : ''}
            ${order.outlet.email ? `<p>Email: ${order.outlet.email}</p>` : ''}
        </div>
        ` : '<p><strong>Company Name</strong></p>'}
    </div>

    <div class="receipt-info">
        <div><strong>Order #:</strong> ${order.order_number}</div>
        <div><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</div>
        <div><strong>Customer:</strong> ${customerName}</div>
        <div><strong>Status:</strong> ${order.status.replace('_', ' ')}</div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th class="item-desc">Item</th>
                <th class="item-qty">Qty</th>
                <th class="item-price">Price</th>
            </tr>
        </thead>
        <tbody>
            ${order.items?.map((item: OrderItem) => `
                <tr>
                    <td class="item-desc">${item.description || item.product?.name || 'Item'}</td>
                    <td class="item-qty">${item.quantity}</td>
                    <td class="item-price">${currencySymbol}${formatAmount(item.line_total)}</td>
                </tr>
            `).join('') || '<tr><td colspan="3" style="text-align: center;">No items</td></tr>'}
        </tbody>
    </table>

    <div class="totals">
        ${Number(order.discount || 0) > 0 ? `
        <div class="total-row">
            <span>Subtotal:</span>
            <span>${currencySymbol}${formatAmount(order.subtotal)}</span>
        </div>
        <div class="total-row">
            <span>Discount:</span>
            <span>-${currencySymbol}${formatAmount(order.discount)}</span>
        </div>
        ` : ''}
        ${Number(order.tax || 0) > 0 ? `
        <div class="total-row">
            <span>Tax:</span>
            <span>${currencySymbol}${formatAmount(order.tax)}</span>
        </div>
        ` : ''}
        <div class="total-row grand">
            <span>TOTAL:</span>
            <span>${currencySymbol}${formatAmount(order.total)}</span>
        </div>
    </div>

    ${order.payments && order.payments.length > 0 ? `
    <div class="payment-info">
        <strong>Payments:</strong>
        ${order.payments.map((payment: any) => `
            <div class="payment-row">
                <span>${payment.method}:</span>
                <span>${currencySymbol}${formatAmount(payment.amount)}</span>
            </div>
        `).join('')}
        <div class="payment-row" style="font-weight: bold; margin-top: 8px; padding-top: 8px; border-top: 1px solid #000;">
            <span>Total Paid:</span>
            <span>${currencySymbol}${formatAmount(order.paid_amount)}</span>
        </div>
        ${Number(order.balance || 0) > 0 ? `
        <div class="payment-row" style="color: #ef4444; font-weight: bold;">
            <span>Balance:</span>
            <span>${currencySymbol}${formatAmount(order.balance)}</span>
        </div>
        ` : ''}
    </div>
    ` : ''}

    <div class="receipt-footer">
        <div class="thank-you">Thank you for your business!</div>
        <p>${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>
    `;
};

/**
 * Generate delivery note HTML template
 */
export const generateDeliveryNoteHTML = (invoice: Invoice, preparedBy?: string): string => {
    const currencySymbol = getCurrencySymbol();
    const customerName = getCustomerName(invoice.customer);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Delivery Note - ${invoice.invoice_number}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            color: #1f2937;
            font-size: 12px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
        }
        .company-info h1 {
            margin: 0;
            color: #3b82f6;
            font-size: 24px;
        }
        .delivery-info {
            text-align: right;
        }
        .delivery-info h2 {
            margin: 0;
            color: #1f2937;
            font-size: 20px;
        }
        .customer-section {
            margin-bottom: 30px;
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
        }
        .customer-section h3 {
            margin: 0 0 15px 0;
            color: #3b82f6;
            font-size: 16px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        th {
            background: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .signature-section {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .signature-box {
            padding: 20px;
            border-top: 2px solid #e5e7eb;
        }
        .signature-box h4 {
            margin: 0 0 40px 0;
            color: #6b7280;
            font-size: 14px;
        }
        .signature-line {
            border-bottom: 2px solid #1f2937;
            height: 50px;
            margin-bottom: 8px;
        }
        .signature-label {
            font-size: 12px;
            color: #6b7280;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>Delivery Note</h1>
            ${invoice.outlet ? `
            <p><strong>${invoice.outlet.name || 'Company Name'}</strong></p>
            ${invoice.outlet.address ? `<p>${invoice.outlet.address}</p>` : ''}
            ${invoice.outlet.phone ? `<p>Phone: ${invoice.outlet.phone}</p>` : ''}
            ${invoice.outlet.email ? `<p>Email: ${invoice.outlet.email}</p>` : ''}
            ` : '<p><strong>Company Name</strong></p>'}
        </div>
        <div class="delivery-info">
            <h2>${invoice.invoice_number}</h2>
            <p><strong>Date:</strong> ${new Date(invoice.issue_date).toLocaleDateString()}</p>
            ${invoice.purchase_order_number ? `<p><strong>PO Number:</strong> ${invoice.purchase_order_number}</p>` : ''}
        </div>
    </div>

    <div class="customer-section">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> ${customerName}</p>
        ${invoice.customer?.email ? `<p><strong>Email:</strong> ${invoice.customer.email}</p>` : ''}
        ${invoice.customer?.phone ? `<p><strong>Phone:</strong> ${invoice.customer.phone}</p>` : ''}
        ${invoice.customer?.address ? `<p><strong>Address:</strong> ${invoice.customer.address}</p>` : ''}
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th style="text-align: right;">Quantity</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.order?.items?.map((item: OrderItem) => `
                <tr>
                    <td>${item.description || item.product?.name || 'Item'}</td>
                    <td style="text-align: right;">${item.quantity}</td>
                </tr>
            `).join('') || '<tr><td colspan="2" style="text-align: center;">No items</td></tr>'}
        </tbody>
    </table>

    <div class="signature-section">
        <div class="signature-box">
            <h4>Prepared By:</h4>
            <div class="signature-line"></div>
            <div class="signature-label">${preparedBy || 'Signature'}</div>
        </div>
        <div class="signature-box">
            <h4>Goods Checked & Received By:</h4>
            <div class="signature-line"></div>
            <div class="signature-label">Signature</div>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Generate quotation HTML template
 */
export const generateQuotationHTML = (quotation: Quotation): string => {
    const currencySymbol = getCurrencySymbol();
    const customerName = getCustomerName(quotation.customer);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Quotation ${quotation.quote_number}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: #333;
            font-size: 28px;
        }
        .info {
            margin-bottom: 30px;
        }
        .info-row {
            margin: 8px 0;
            font-size: 14px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        .text-right {
            text-align: right;
        }
        .total-row {
            font-weight: bold;
            font-size: 1.1em;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #333;
            text-align: center;
            color: #666;
        }
        .valid-until {
            background: #f0f0f0;
            padding: 15px;
            margin-top: 20px;
            text-align: center;
            border-radius: 8px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>QUOTATION</h1>
        ${quotation.outlet ? `
        <p><strong>${quotation.outlet.name || 'Print Shop'}</strong></p>
        ${quotation.outlet.address ? `<p>${quotation.outlet.address}</p>` : ''}
        <div style="margin-top: 10px; font-size: 12px; color: #666;">
            ${quotation.outlet.phone ? `<p>Phone: ${quotation.outlet.phone}</p>` : ''}
            ${quotation.outlet.email ? `<p>Email: ${quotation.outlet.email}</p>` : ''}
        </div>
        ` : '<p><strong>Print Shop</strong></p>'}
        <p style="margin-top: 15px;">Quote #: ${quotation.quote_number}</p>
    </div>
    
    <div class="info">
        <div class="info-row"><strong>Customer:</strong> ${customerName}</div>
        <div class="info-row"><strong>Date:</strong> ${new Date(quotation.created_at).toLocaleDateString()}</div>
        <div class="info-row"><strong>Valid Until:</strong> ${new Date(quotation.valid_until).toLocaleDateString()}</div>
        <div class="info-row"><strong>Status:</strong> ${quotation.status.toUpperCase()}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${quotation.items?.map((item) => `
                <tr>
                    <td>${item.description}${item.dimensions ? ` (${item.dimensions.width}" × ${item.dimensions.height}")` : ''}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${currencySymbol}${formatAmount(item.unit_price)}</td>
                    <td class="text-right">${currencySymbol}${formatAmount(item.line_total)}</td>
                </tr>
            `).join('') || ''}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3" class="text-right"><strong>Subtotal:</strong></td>
                <td class="text-right">${currencySymbol}${formatAmount(quotation.subtotal)}</td>
            </tr>
            ${Number(quotation.discount || 0) > 0 ? `
            <tr>
                <td colspan="3" class="text-right"><strong>Discount:</strong></td>
                <td class="text-right">-${currencySymbol}${formatAmount(quotation.discount)}</td>
            </tr>
            ` : ''}
            ${Number(quotation.tax || 0) > 0 ? `
            <tr>
                <td colspan="3" class="text-right"><strong>Tax:</strong></td>
                <td class="text-right">${currencySymbol}${formatAmount(quotation.tax)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
                <td colspan="3" class="text-right"><strong>TOTAL:</strong></td>
                <td class="text-right">${currencySymbol}${formatAmount(quotation.total)}</td>
            </tr>
        </tfoot>
    </table>

    <div class="valid-until">
        <strong>This quotation is valid until:</strong> ${new Date(quotation.valid_until).toLocaleDateString()}
    </div>

    <div class="footer">
        <p>Thank you for your interest in our services!</p>
    </div>
</body>
</html>
    `;
};

/**
 * Helper function to print HTML in a new window
 */
export const printHTML = (html: string): void => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow popups to print');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 250);
};
