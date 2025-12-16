// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/auth/me',
  
  // Orders
  ORDERS: '/orders',
  ORDER_ITEMS: (id: number) => `/orders/${id}/items`,
  ORDER_STATUS: (id: number) => `/orders/${id}/status`,
  ORDER_DISCOUNT: (id: number) => `/orders/${id}/discount`,
  ORDER_CANCEL: (id: number) => `/orders/${id}/cancel`,
  ORDER_PAYMENTS: (id: number) => `/orders/${id}/payments`,
  
  // Service Jobs
  SERVICE_QUEUE: '/service-jobs/queue',
  SERVICE_JOBS: '/service-jobs',
  SERVICE_ASSIGN: (id: number) => `/service-jobs/${id}/assign`,
  SERVICE_STATUS: (id: number) => `/service-jobs/${id}/status`,
  SERVICE_PRIORITY: (id: number) => `/service-jobs/${id}/priority`,
  SERVICE_COMMENTS: (id: number) => `/service-jobs/${id}/comments`,
  
  // Products
  PRODUCTS: '/products',
  
  // Customers
  CUSTOMERS: '/customers',
  CUSTOMER_CREDIT_HISTORY: (id: number) => `/customers/${id}/credit-history`,
  CUSTOMER_CREDIT_LIMIT: (id: number) => `/customers/${id}/credit-limit`,
  
  // Invoices
  INVOICES: '/invoices',
  INVOICE_PAYMENTS: (id: number) => `/invoices/${id}/payments`,
  INVOICE_UPDATE: (id: number) => `/invoices/${id}`,
  INVOICE_DRAFT_UPDATE: (id: number) => `/invoices/${id}/draft`,
  INVOICE_APPROVE: (id: number) => `/invoices/${id}/approve`,
  ORDER_INVOICE: (id: number) => `/orders/${id}/invoice`,
  
  // Quotations
  QUOTATIONS: '/quotations',
  QUOTATION_ITEMS: (id: number) => `/quotations/${id}/items`,
  QUOTATION_ITEM_UPDATE: (id: number, itemId: number) => `/quotations/${id}/items/${itemId}`,
  QUOTATION_ITEM_DELETE: (id: number, itemId: number) => `/quotations/${id}/items/${itemId}`,
  QUOTATION_STATUS: (id: number) => `/quotations/${id}/status`,
  QUOTATION_CONVERT: (id: number) => `/quotations/${id}/convert`,
  
  // Pricing
  PRICING_CALCULATE: '/pricing/calculate',
  PRICING_BATCH: '/pricing/batch-calculate',
  
  // Outlets
  OUTLETS: '/outlets',
  OUTLET_UPDATE: (id: number) => `/outlets/${id}`,
  
  // Reports
  REPORT_DAILY_SALES: '/reports/daily-sales',
  REPORT_DAILY_ORDERS: '/reports/daily-orders',
  REPORT_DAILY_INVOICES: '/reports/daily-invoices',
  REPORT_DAILY_CREDIT: '/reports/daily-credit',
  REPORT_PAYMENT_SUMMARY: '/reports/payment-summary',
  REPORT_INVOICE_DETAILS: '/reports/invoice-details',
  REPORT_ORDERS_DETAILS: '/reports/orders-details',
  REPORT_QUOTATIONS: '/reports/quotations',
};
