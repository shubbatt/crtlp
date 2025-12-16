import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { formatCurrency } from '../../utils/currency';
import './ReportsApp.css';

type ReportType = 'sales' | 'orders' | 'invoices' | 'credit' | 'payments' | 'invoice-details' | 'orders-details' | 'quotations';
type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

interface DateRange {
    from: string;
    to: string;
}

const ReportsApp: React.FC = () => {
    const [activeReport, setActiveReport] = useState<ReportType>('sales');
    const [period, setPeriod] = useState<PeriodType>('month');
    const [customFromDate, setCustomFromDate] = useState('');
    const [customToDate, setCustomToDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [outletFilter, setOutletFilter] = useState<number | 'all'>('all');
    const [outlets, setOutlets] = useState<Array<{ id: number; name: string }>>([]);
    
    // Report data states
    const [salesData, setSalesData] = useState<any>(null);
    const [ordersData, setOrdersData] = useState<any>(null);
    const [invoicesData, setInvoicesData] = useState<any>(null);
    const [creditData, setCreditData] = useState<any>(null);
    const [paymentsData, setPaymentsData] = useState<any>(null);
    const [invoiceDetailsData, setInvoiceDetailsData] = useState<any>(null);
    const [ordersDetailsData, setOrdersDetailsData] = useState<any>(null);
    const [quotationsData, setQuotationsData] = useState<any>(null);

    useEffect(() => {
        fetchOutlets();
        // Set default custom dates to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setCustomFromDate(firstDay.toISOString().split('T')[0]);
        setCustomToDate(lastDay.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        fetchReport();
    }, [activeReport, period, customFromDate, customToDate, outletFilter]);

    const fetchOutlets = async () => {
        try {
            const { data } = await apiClient.get(API_ENDPOINTS.OUTLETS);
            setOutlets(data || []);
        } catch (error) {
            console.error('Failed to fetch outlets:', error);
        }
    };

    const getReportParams = () => {
        const params: any = {
            period: period === 'custom' ? 'custom' : period,
        };
        
        if (period === 'custom') {
            params.from_date = customFromDate;
            params.to_date = customToDate;
        }
        
        // Only send outlet_id if not 'all' - backend will use header outlet_id if param not provided
        // To get all outlets, we need to explicitly send a signal or not filter
        // For now, we'll use a special value or just not send it when 'all' is selected
        // The backend will check query param first, then header
        if (outletFilter !== 'all') {
            params.outlet_id = outletFilter;
        }
        // When 'all' is selected, don't send outlet_id param, so it can use header or show all
        
        return params;
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = getReportParams();
            let endpoint = '';
            
            switch (activeReport) {
                case 'sales':
                    endpoint = API_ENDPOINTS.REPORT_DAILY_SALES;
                    break;
                case 'orders':
                    endpoint = API_ENDPOINTS.REPORT_DAILY_ORDERS;
                    break;
                case 'invoices':
                    endpoint = API_ENDPOINTS.REPORT_DAILY_INVOICES;
                    break;
                case 'credit':
                    endpoint = API_ENDPOINTS.REPORT_DAILY_CREDIT;
                    break;
                case 'payments':
                    endpoint = API_ENDPOINTS.REPORT_PAYMENT_SUMMARY;
                    break;
                case 'invoice-details':
                    endpoint = API_ENDPOINTS.REPORT_INVOICE_DETAILS;
                    break;
                case 'orders-details':
                    endpoint = API_ENDPOINTS.REPORT_ORDERS_DETAILS;
                    break;
                case 'quotations':
                    endpoint = API_ENDPOINTS.REPORT_QUOTATIONS;
                    break;
            }
            
            const { data } = await apiClient.get(endpoint, { params });
            
            switch (activeReport) {
                case 'sales':
                    setSalesData(data);
                    break;
                case 'orders':
                    setOrdersData(data);
                    break;
                case 'invoices':
                    setInvoicesData(data);
                    break;
                case 'credit':
                    setCreditData(data);
                    break;
                case 'payments':
                    setPaymentsData(data);
                    break;
                case 'invoice-details':
                    setInvoiceDetailsData(data);
                    break;
                case 'orders-details':
                    setOrdersDetailsData(data);
                    break;
                case 'quotations':
                    setQuotationsData(data);
                    break;
            }
        } catch (error) {
            console.error('Failed to fetch report:', error);
            alert('Failed to load report data');
        }
        setLoading(false);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const renderSalesReport = () => {
        if (!salesData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Total Orders</h3>
                        <p className="summary-value">{salesData.summary.total_orders}</p>
                        <p className="summary-amount">{formatCurrency(salesData.summary.total_orders_amount)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Total Invoices</h3>
                        <p className="summary-value">{salesData.summary.total_invoices}</p>
                        <p className="summary-amount">{formatCurrency(salesData.summary.total_invoices_amount)}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Grand Total</h3>
                        <p className="summary-value">{salesData.summary.total_orders + salesData.summary.total_invoices}</p>
                        <p className="summary-amount">{formatCurrency(salesData.summary.grand_total)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Total Paid</h3>
                        <p className="summary-value">-</p>
                        <p className="summary-amount">{formatCurrency(salesData.summary.grand_total_paid)}</p>
                    </div>
                </div>

                <div className="report-table-section">
                    <h3>Daily Breakdown</h3>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Orders</th>
                                <th>Orders Amount</th>
                                <th>Invoices</th>
                                <th>Invoices Amount</th>
                                <th>Daily Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesData.daily_breakdown.map((day: any, index: number) => (
                                <tr key={index}>
                                    <td>{formatDate(day.date)}</td>
                                    <td>{day.orders_count}</td>
                                    <td>{formatCurrency(day.orders_total)}</td>
                                    <td>{day.invoices_count}</td>
                                    <td>{formatCurrency(day.invoices_total)}</td>
                                    <td className="total-cell">{formatCurrency(day.total_sales)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderOrdersReport = () => {
        if (!ordersData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Total Orders</h3>
                        <p className="summary-value">{ordersData.summary.total_orders}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Total Amount</h3>
                        <p className="summary-amount">{formatCurrency(ordersData.summary.total_amount)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Total Paid</h3>
                        <p className="summary-amount">{formatCurrency(ordersData.summary.total_paid)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Outstanding</h3>
                        <p className="summary-amount">{formatCurrency(ordersData.summary.total_balance)}</p>
                    </div>
                </div>

                <div className="report-table-section">
                    <h3>Daily Breakdown</h3>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Count</th>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>By Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ordersData.daily_breakdown.map((day: any, index: number) => (
                                <tr key={index}>
                                    <td>{formatDate(day.date)}</td>
                                    <td>{day.total_count}</td>
                                    <td>{formatCurrency(day.total_amount)}</td>
                                    <td>{formatCurrency(day.total_paid)}</td>
                                    <td>
                                        {Object.entries(day.by_status || {}).map(([status, data]: [string, any]) => (
                                            <span key={status} className="status-badge">
                                                {status}: {data.count} ({formatCurrency(data.amount)})
                                            </span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="report-table-section">
                    <h3>Order Details</h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Order #</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordersData.orders.map((order: any) => (
                                    <tr key={order.id}>
                                        <td>{order.order_number}</td>
                                        <td>{formatDate(order.date)}</td>
                                        <td>{order.customer}</td>
                                        <td><span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status}</span></td>
                                        <td>{formatCurrency(order.total)}</td>
                                        <td>{formatCurrency(order.paid_amount)}</td>
                                        <td>{formatCurrency(order.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderInvoicesReport = () => {
        if (!invoicesData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Total Invoices</h3>
                        <p className="summary-value">{invoicesData.summary.total_invoices}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Total Amount</h3>
                        <p className="summary-amount">{formatCurrency(invoicesData.summary.total_amount)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Total Paid</h3>
                        <p className="summary-amount">{formatCurrency(invoicesData.summary.total_paid)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Outstanding</h3>
                        <p className="summary-amount">{formatCurrency(invoicesData.summary.total_balance)}</p>
                    </div>
                </div>

                <div className="report-table-section">
                    <h3>Daily Breakdown</h3>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Count</th>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoicesData.daily_breakdown.map((day: any, index: number) => (
                                <tr key={index}>
                                    <td>{formatDate(day.date)}</td>
                                    <td>{day.total_count}</td>
                                    <td>{formatCurrency(day.total_amount)}</td>
                                    <td>{formatCurrency(day.total_paid)}</td>
                                    <td>{formatCurrency(day.total_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="report-table-section">
                    <h3>Invoice Details</h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Issue Date</th>
                                    <th>Due Date</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoicesData.invoices.map((invoice: any) => (
                                    <tr key={invoice.id}>
                                        <td>{invoice.invoice_number}</td>
                                        <td>{invoice.issue_date ? formatDate(invoice.issue_date) : '-'}</td>
                                        <td>{invoice.due_date ? formatDate(invoice.due_date) : '-'}</td>
                                        <td>{invoice.customer}</td>
                                        <td><span className={`status-badge status-${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                                        <td>{formatCurrency(invoice.total)}</td>
                                        <td>{formatCurrency(invoice.paid_amount)}</td>
                                        <td>{formatCurrency(invoice.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderCreditReport = () => {
        if (!creditData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Credit Invoices</h3>
                        <p className="summary-value">{creditData.summary.total_credit_invoices}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Credit Issued</h3>
                        <p className="summary-amount">{formatCurrency(creditData.summary.total_credit_issued)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Credit Collected</h3>
                        <p className="summary-amount">{formatCurrency(creditData.summary.total_credit_collected)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Outstanding</h3>
                        <p className="summary-amount">{formatCurrency(creditData.summary.net_credit_outstanding)}</p>
                    </div>
                </div>

                <div className="report-table-section">
                    <h3>Daily Breakdown</h3>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoices</th>
                                <th>Issued</th>
                                <th>Payments</th>
                                <th>Collected</th>
                                <th>Net Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {creditData.daily_breakdown.map((day: any, index: number) => (
                                <tr key={index}>
                                    <td>{formatDate(day.date)}</td>
                                    <td>{day.invoices_count}</td>
                                    <td>{formatCurrency(day.invoices_amount)}</td>
                                    <td>{day.payments_count}</td>
                                    <td>{formatCurrency(day.payments_amount)}</td>
                                    <td>{formatCurrency(day.net_credit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="report-table-section">
                    <h3>Credit Customers</h3>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Credit Limit</th>
                                    <th>Current Balance</th>
                                    <th>Period Invoices</th>
                                    <th>Period Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {creditData.credit_customers.map((customer: any) => (
                                    <tr key={customer.id}>
                                        <td>{customer.name}</td>
                                        <td>{formatCurrency(customer.credit_limit)}</td>
                                        <td>{formatCurrency(customer.credit_balance)}</td>
                                        <td>{customer.period_invoices_count}</td>
                                        <td>{formatCurrency(customer.period_invoices_amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderPaymentsReport = () => {
        if (!paymentsData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card highlight">
                        <h3>Total Payments</h3>
                        <p className="summary-value">{paymentsData.summary.total_payments}</p>
                        <p className="summary-amount">{formatCurrency(paymentsData.summary.total_amount)}</p>
                    </div>
                </div>

                <div className="report-table-section">
                    <h3>By Payment Method</h3>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Method</th>
                                <th>Count</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentsData.by_method.map((method: any, index: number) => (
                                <tr key={index}>
                                    <td>{method.method.toUpperCase()}</td>
                                    <td>{method.count}</td>
                                    <td>{formatCurrency(method.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="report-table-section">
                    <h3>Daily Breakdown</h3>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Count</th>
                                <th>Total</th>
                                <th>By Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentsData.daily_breakdown.map((day: any, index: number) => (
                                <tr key={index}>
                                    <td>{formatDate(day.date)}</td>
                                    <td>{day.count}</td>
                                    <td>{formatCurrency(day.total)}</td>
                                    <td>
                                        {Object.entries(day.by_method || {}).map(([method, amount]: [string, any]) => (
                                            <span key={method} className="status-badge">
                                                {method}: {formatCurrency(amount)}
                                            </span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderInvoiceDetailsReport = () => {
        if (!invoiceDetailsData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Total Invoices</h3>
                        <p className="summary-value">{invoiceDetailsData.summary.total_invoices}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Total Amount</h3>
                        <p className="summary-amount">{formatCurrency(invoiceDetailsData.summary.total_amount)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Total Paid</h3>
                        <p className="summary-amount">{formatCurrency(invoiceDetailsData.summary.total_paid)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Outstanding</h3>
                        <p className="summary-amount">{formatCurrency(invoiceDetailsData.summary.total_balance)}</p>
                    </div>
                </div>

                {(period === 'month' || period === 'year' || period === 'custom') && (
                    <>
                        <div className="report-table-section">
                            <h3>By Month</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Count</th>
                                        <th>Total</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceDetailsData.by_month.map((month: any, index: number) => (
                                        <tr key={index}>
                                            <td>{month.month}</td>
                                            <td>{month.count}</td>
                                            <td>{formatCurrency(month.total)}</td>
                                            <td>{formatCurrency(month.paid)}</td>
                                            <td>{formatCurrency(month.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="report-table-section">
                            <h3>By Week</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Week</th>
                                        <th>Count</th>
                                        <th>Total</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceDetailsData.by_week.map((week: any, index: number) => (
                                        <tr key={index}>
                                            <td>{week.week}</td>
                                            <td>{week.count}</td>
                                            <td>{formatCurrency(week.total)}</td>
                                            <td>{formatCurrency(week.paid)}</td>
                                            <td>{formatCurrency(week.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <div className="report-table-section">
                    <h3>Invoice Details</h3>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>PO #</th>
                                    <th>Issue Date</th>
                                    <th>Due Date</th>
                                    <th>Customer</th>
                                    <th>Order #</th>
                                    <th>Status</th>
                                    <th>Subtotal</th>
                                    <th>Discount</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceDetailsData.invoices.map((invoice: any) => (
                                    <tr key={invoice.id}>
                                        <td>{invoice.invoice_number}</td>
                                        <td>{invoice.purchase_order_number || '-'}</td>
                                        <td>{invoice.issue_date ? formatDate(invoice.issue_date) : '-'}</td>
                                        <td>{invoice.due_date ? formatDate(invoice.due_date) : '-'}</td>
                                        <td>{invoice.customer?.name || 'Walk-in'}</td>
                                        <td>{invoice.order_number || '-'}</td>
                                        <td><span className={`status-badge status-${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                                        <td>{formatCurrency(invoice.subtotal)}</td>
                                        <td>{formatCurrency(invoice.discount)}</td>
                                        <td>{formatCurrency(invoice.tax)}</td>
                                        <td>{formatCurrency(invoice.total)}</td>
                                        <td>{formatCurrency(invoice.paid_amount)}</td>
                                        <td>{formatCurrency(invoice.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderOrdersDetailsReport = () => {
        if (!ordersDetailsData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Total Orders</h3>
                        <p className="summary-value">{ordersDetailsData.summary.total_orders}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Total Amount</h3>
                        <p className="summary-amount">{formatCurrency(ordersDetailsData.summary.total_amount)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Total Paid</h3>
                        <p className="summary-amount">{formatCurrency(ordersDetailsData.summary.total_paid)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Outstanding</h3>
                        <p className="summary-amount">{formatCurrency(ordersDetailsData.summary.total_balance)}</p>
                    </div>
                </div>

                {(period === 'month' || period === 'year' || period === 'custom') && (
                    <>
                        <div className="report-table-section">
                            <h3>By Month</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Count</th>
                                        <th>Total</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersDetailsData.by_month.map((month: any, index: number) => (
                                        <tr key={index}>
                                            <td>{month.month}</td>
                                            <td>{month.count}</td>
                                            <td>{formatCurrency(month.total)}</td>
                                            <td>{formatCurrency(month.paid)}</td>
                                            <td>{formatCurrency(month.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="report-table-section">
                            <h3>By Week</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Week</th>
                                        <th>Count</th>
                                        <th>Total</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersDetailsData.by_week.map((week: any, index: number) => (
                                        <tr key={index}>
                                            <td>{week.week}</td>
                                            <td>{week.count}</td>
                                            <td>{formatCurrency(week.total)}</td>
                                            <td>{formatCurrency(week.paid)}</td>
                                            <td>{formatCurrency(week.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <div className="report-table-section">
                    <h3>Order Details</h3>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Order #</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Items</th>
                                    <th>Jobs</th>
                                    <th>Subtotal</th>
                                    <th>Discount</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                    <th>Invoice</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordersDetailsData.orders.map((order: any) => (
                                    <tr key={order.id}>
                                        <td>{order.order_number}</td>
                                        <td>{formatDate(order.created_at)}</td>
                                        <td>{order.customer?.name || 'Walk-in'}</td>
                                        <td>{order.order_type}</td>
                                        <td><span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status}</span></td>
                                        <td>{order.items_count}</td>
                                        <td>{order.jobs_count}</td>
                                        <td>{formatCurrency(order.subtotal)}</td>
                                        <td>{formatCurrency(order.discount)}</td>
                                        <td>{formatCurrency(order.tax)}</td>
                                        <td>{formatCurrency(order.total)}</td>
                                        <td>{formatCurrency(order.paid_amount)}</td>
                                        <td>{formatCurrency(order.balance)}</td>
                                        <td>{order.has_invoice ? order.invoice_number : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderQuotationsReport = () => {
        if (!quotationsData) return <div>No data available</div>;
        
        return (
            <div className="report-content">
                <div className="report-summary">
                    <div className="summary-card">
                        <h3>Total Quotations</h3>
                        <p className="summary-value">{quotationsData.summary.total_quotations}</p>
                    </div>
                    <div className="summary-card highlight">
                        <h3>Total Amount</h3>
                        <p className="summary-amount">{formatCurrency(quotationsData.summary.total_amount)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Converted</h3>
                        <p className="summary-value">{quotationsData.summary.converted_count}</p>
                        <p className="summary-amount">{formatCurrency(quotationsData.summary.converted_total)}</p>
                    </div>
                    <div className="summary-card">
                        <h3>Conversion Rate</h3>
                        <p className="summary-value">
                            {quotationsData.summary.total_quotations > 0 
                                ? ((quotationsData.summary.converted_count / quotationsData.summary.total_quotations) * 100).toFixed(1)
                                : 0}%
                        </p>
                    </div>
                </div>

                {(period === 'month' || period === 'year' || period === 'custom') && (
                    <>
                        <div className="report-table-section">
                            <h3>By Month</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Count</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotationsData.by_month.map((month: any, index: number) => (
                                        <tr key={index}>
                                            <td>{month.month}</td>
                                            <td>{month.count}</td>
                                            <td>{formatCurrency(month.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="report-table-section">
                            <h3>By Week</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Week</th>
                                        <th>Count</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotationsData.by_week.map((week: any, index: number) => (
                                        <tr key={index}>
                                            <td>{week.week}</td>
                                            <td>{week.count}</td>
                                            <td>{formatCurrency(week.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <div className="report-table-section">
                    <h3>Quotation Details</h3>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Quotation #</th>
                                    <th>Date</th>
                                    <th>Valid Until</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th>Items</th>
                                    <th>Subtotal</th>
                                    <th>Discount</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                    <th>Converted</th>
                                    <th>Order #</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotationsData.quotations.map((quotation: any) => (
                                    <tr key={quotation.id}>
                                        <td>{quotation.quotation_number}</td>
                                        <td>{formatDate(quotation.created_at)}</td>
                                        <td>{quotation.valid_until ? formatDate(quotation.valid_until) : '-'}</td>
                                        <td>{quotation.customer?.name || 'Walk-in'}</td>
                                        <td><span className={`status-badge status-${quotation.status.toLowerCase()}`}>{quotation.status}</span></td>
                                        <td>{quotation.items_count}</td>
                                        <td>{formatCurrency(quotation.subtotal)}</td>
                                        <td>{formatCurrency(quotation.discount)}</td>
                                        <td>{formatCurrency(quotation.tax)}</td>
                                        <td>{formatCurrency(quotation.total)}</td>
                                        <td>{quotation.is_converted ? '✓' : '-'}</td>
                                        <td>{quotation.order_number || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderReport = () => {
        switch (activeReport) {
            case 'sales':
                return renderSalesReport();
            case 'orders':
                return renderOrdersReport();
            case 'invoices':
                return renderInvoicesReport();
            case 'credit':
                return renderCreditReport();
            case 'payments':
                return renderPaymentsReport();
            case 'invoice-details':
                return renderInvoiceDetailsReport();
            case 'orders-details':
                return renderOrdersDetailsReport();
            case 'quotations':
                return renderQuotationsReport();
            default:
                return <div>Select a report type</div>;
        }
    };

    return (
        <div className="reports-app">
            <div className="reports-header">
                <h1>📊 Accounting Reports</h1>
            </div>

            <div className="reports-controls">
                <div className="report-tabs">
                    <button
                        className={activeReport === 'sales' ? 'active' : ''}
                        onClick={() => setActiveReport('sales')}
                    >
                        📈 Daily Sales
                    </button>
                    <button
                        className={activeReport === 'orders' ? 'active' : ''}
                        onClick={() => setActiveReport('orders')}
                    >
                        📦 Daily Orders
                    </button>
                    <button
                        className={activeReport === 'invoices' ? 'active' : ''}
                        onClick={() => setActiveReport('invoices')}
                    >
                        📄 Daily Invoices
                    </button>
                    <button
                        className={activeReport === 'credit' ? 'active' : ''}
                        onClick={() => setActiveReport('credit')}
                    >
                        💳 Credit Report
                    </button>
                    <button
                        className={activeReport === 'payments' ? 'active' : ''}
                        onClick={() => setActiveReport('payments')}
                    >
                        💵 Payment Summary
                    </button>
                    <button
                        className={activeReport === 'invoice-details' ? 'active' : ''}
                        onClick={() => setActiveReport('invoice-details')}
                    >
                        📋 Invoice Details
                    </button>
                    <button
                        className={activeReport === 'orders-details' ? 'active' : ''}
                        onClick={() => setActiveReport('orders-details')}
                    >
                        📦 Orders Details
                    </button>
                    <button
                        className={activeReport === 'quotations' ? 'active' : ''}
                        onClick={() => setActiveReport('quotations')}
                    >
                        📄 Quotations
                    </button>
                </div>

                <div className="report-filters">
                    <div className="filter-group">
                        <label>Period:</label>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        >
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                            <option value="custom">Custom Date Range</option>
                        </select>
                    </div>

                    {period === 'custom' && (
                        <>
                            <div className="filter-group">
                                <label>From:</label>
                                <input
                                    type="date"
                                    value={customFromDate}
                                    onChange={(e) => setCustomFromDate(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <label>To:</label>
                                <input
                                    type="date"
                                    value={customToDate}
                                    onChange={(e) => setCustomToDate(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    <div className="filter-group">
                        <label>Outlet:</label>
                        <select
                            value={outletFilter}
                            onChange={(e) => setOutletFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        >
                            <option value="all">All Outlets</option>
                            {outlets.map(outlet => (
                                <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                            ))}
                        </select>
                    </div>

                    <button className="btn-refresh" onClick={fetchReport}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading report data...</div>
            ) : (
                renderReport()
            )}
        </div>
    );
};

export default ReportsApp;

