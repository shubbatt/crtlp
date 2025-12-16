import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry';
import OrdersList from './pages/OrdersList';
import OrderDetail from './pages/OrderDetail';
import CustomersList from './pages/CustomersList';
import CustomerDetail from './pages/CustomerDetail';
import InvoicesList from './pages/InvoicesList';
import InvoiceDetail from './pages/InvoiceDetail';
import QuotationsList from './pages/QuotationsList';
import QuotationEntry from './pages/QuotationEntry';
import QuotationDetail from './pages/QuotationDetail';
import DeliveryOrders from './pages/DeliveryOrders';
import './CounterApp.css';

const CounterApp: React.FC = () => {
    return (
        <div className="counter-app">
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/orders/new" element={<OrderEntry />} />
                <Route path="/orders" element={<OrdersList />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/quotations" element={<QuotationsList />} />
                <Route path="/quotations/new" element={<QuotationEntry />} />
                <Route path="/quotations/:id" element={<QuotationDetail />} />
                <Route path="/customers" element={<CustomersList />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/invoices" element={<InvoicesList />} />
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
                <Route path="/delivery" element={<DeliveryOrders />} />
            </Routes>
        </div>
    );
};

export default CounterApp;
