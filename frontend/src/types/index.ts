export interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    permissions: Record<string, string[]>;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

export interface LoginCredentials {
    email: string;
    password: string;
    outlet_id: number;
}

export interface Product {
    id: number;
    sku: string;
    name: string;
    description: string | null;
    type: 'inventory' | 'service' | 'dimension';
    unit_cost: number;
    stock_qty: number;
    is_active: boolean;
    pricing_rules?: PricingRule[];
}

export interface PricingRule {
    id: number;
    product_id: number;
    rule_type: 'quantity_tier' | 'dimension' | 'fixed' | 'customer_specific';
    config: any;
    priority: number;
    valid_from: string | null;
    valid_until: string | null;
}

export interface Customer {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    type: 'walk_in' | 'regular' | 'credit';
    credit_limit: number;
    credit_balance: number;
    tax_id: string | null;
    notes: string | null;
}

export interface Order {
    id: number;
    order_number: string;
    customer_id: number | null;
    customer?: Customer;
    order_type: 'walk_in' | 'quotation' | 'invoice';
    status: OrderStatus;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    payment_terms: 'immediate' | 'credit_30' | 'credit_60';
    notes: string | null;
    items?: OrderItem[];
    service_jobs?: ServiceJob[];
    invoice?: {
        id: number;
        invoice_number: string;
        status: string;
    };
    created_at: string;
    updated_at: string;
}

export type OrderStatus =
    | 'DRAFT'
    | 'PENDING_PAYMENT'
    | 'CONFIRMED'
    | 'IN_PRODUCTION'
    | 'QA'
    | 'READY'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED';

export interface OrderItem {
    id: number;
    order_id: number;
    product_id: number;
    product?: Product;
    item_type: 'inventory' | 'service' | 'dimension';
    description: string;
    quantity: number;
    dimensions: {
        width: number;
        height: number;
        unit: string;
    } | null;
    unit_price: number;
    line_total: number;
    pricing_rule_id: number | null;
    override_reason: string | null;
}

export interface ServiceJob {
    id: number;
    job_number: string;
    order_id: number;
    order_item_id: number;
    order?: Order;
    order_item?: OrderItem;
    status: ServiceJobStatus;
    assigned_to: number | null;
    assigned_user?: User;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    due_date: string | null;
    started_at: string | null;
    completed_at: string | null;
    notes: string | null;
    rework_count: number;
    status_history?: ServiceStatusHistory[];
}

export type ServiceJobStatus =
    | 'PENDING'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'ON_HOLD'
    | 'QA_REVIEW'
    | 'COMPLETED'
    | 'REJECTED';

export interface ServiceStatusHistory {
    id: number;
    service_job_id: number;
    from_status: string;
    to_status: string;
    changed_by: number;
    changed_by_user?: User;
    reason: string | null;
    created_at: string;
}

export interface PricingCalculation {
    product_id: number;
    product_name: string;
    unit_price: number;
    line_total: number;
    applied_rule: number | null;
}

export interface CreateOrderRequest {
    customer_id?: number;
    order_type: 'walk_in' | 'quotation' | 'invoice';
    payment_terms: 'immediate' | 'credit_30' | 'credit_60';
    notes?: string;
    items: {
        product_id: number;
        quantity: number;
        width?: number;
        height?: number;
        description?: string;
    }[];
}
