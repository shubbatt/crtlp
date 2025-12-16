<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportController extends Controller
{
    /**
     * Get date range from request parameters
     */
    private function getDateRange(Request $request): array
    {
        $period = $request->query('period', 'custom'); // day, week, month, custom
        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');
        
        $now = Carbon::now();
        
        switch ($period) {
            case 'today':
                return [$now->copy()->startOfDay(), $now->copy()->endOfDay()];
            case 'week':
                return [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()];
            case 'month':
                return [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()];
            case 'year':
                return [$now->copy()->startOfYear(), $now->copy()->endOfYear()];
            case 'custom':
            default:
                $from = $fromDate ? Carbon::parse($fromDate)->startOfDay() : $now->copy()->startOfMonth();
                $to = $toDate ? Carbon::parse($toDate)->endOfDay() : $now->copy()->endOfDay();
                return [$from, $to];
        }
    }

    /**
     * Daily Sales Report
     */
    public function dailySales(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        // Check query param first, then header - if query param is 'all' or not provided and header exists, use header
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        // Get orders in date range
        $ordersQuery = Order::whereBetween('created_at', [$fromDate, $toDate])
            ->where('status', '!=', 'CANCELLED');

        if ($outletId) {
            $ordersQuery->where('outlet_id', $outletId);
        }

        $orders = $ordersQuery->with(['customer', 'outlet'])->get();

        // Get invoices in date range
        $invoicesQuery = Invoice::whereNotNull('issue_date')
            ->whereBetween('issue_date', [$fromDate, $toDate])
            ->where('status', '!=', 'draft');

        if ($outletId) {
            $invoicesQuery->where('outlet_id', $outletId);
        }

        $invoices = $invoicesQuery->with(['customer', 'outlet'])->get();

        // Calculate totals
        $orderTotal = $orders->sum('total');
        $orderPaid = $orders->sum('paid_amount');
        $invoiceTotal = $invoices->sum('total');
        $invoicePaid = $invoices->sum('paid_amount');

        // Group by date
        $dailyBreakdown = [];
        $currentDate = $fromDate->copy();
        while ($currentDate <= $toDate) {
            $dateStr = $currentDate->format('Y-m-d');
            $dayOrders = $orders->filter(fn($o) => $o->created_at->format('Y-m-d') === $dateStr);
            $dayInvoices = $invoices->filter(fn($i) => $i->issue_date && $i->issue_date->format('Y-m-d') === $dateStr);
            
            $dailyBreakdown[$dateStr] = [
                'date' => $dateStr,
                'orders_count' => $dayOrders->count(),
                'orders_total' => $dayOrders->sum('total'),
                'orders_paid' => $dayOrders->sum('paid_amount'),
                'invoices_count' => $dayInvoices->count(),
                'invoices_total' => $dayInvoices->sum('total'),
                'invoices_paid' => $dayInvoices->sum('paid_amount'),
                'total_sales' => $dayOrders->sum('total') + $dayInvoices->sum('total'),
            ];
            $currentDate->addDay();
        }

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_orders' => $orders->count(),
                'total_orders_amount' => $orderTotal,
                'total_orders_paid' => $orderPaid,
                'total_invoices' => $invoices->count(),
                'total_invoices_amount' => $invoiceTotal,
                'total_invoices_paid' => $invoicePaid,
                'grand_total' => $orderTotal + $invoiceTotal,
                'grand_total_paid' => $orderPaid + $invoicePaid,
            ],
            'daily_breakdown' => array_values($dailyBreakdown),
            'orders' => $orders->map(fn($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'date' => $o->created_at->format('Y-m-d H:i:s'),
                'customer' => $o->customer?->name ?? 'Walk-in',
                'status' => $o->status,
                'total' => $o->total,
                'paid_amount' => $o->paid_amount,
                'balance' => $o->balance,
            ]),
        ]);
    }

    /**
     * Daily Orders Report
     */
    public function dailyOrders(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        $query = Order::whereBetween('created_at', [$fromDate, $toDate])
            ->with(['customer', 'outlet']);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->orderBy('created_at', 'desc')->get();

        // Group by date and status
        $grouped = $orders->groupBy(function ($order) {
            return $order->created_at->format('Y-m-d');
        })->map(function ($dayOrders, $date) {
            return [
                'date' => $date,
                'total_count' => $dayOrders->count(),
                'total_amount' => $dayOrders->sum('total'),
                'total_paid' => $dayOrders->sum('paid_amount'),
                'by_status' => $dayOrders->groupBy('status')->map(function ($statusOrders) {
                    return [
                        'count' => $statusOrders->count(),
                        'amount' => $statusOrders->sum('total'),
                    ];
                })->toArray(),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_orders' => $orders->count(),
                'total_amount' => $orders->sum('total'),
                'total_paid' => $orders->sum('paid_amount'),
                'total_balance' => $orders->sum('balance'),
            ],
            'daily_breakdown' => $grouped,
            'orders' => $orders->map(fn($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'date' => $o->created_at->format('Y-m-d H:i:s'),
                'customer' => $o->customer?->name ?? 'Walk-in',
                'status' => $o->status,
                'order_type' => $o->order_type,
                'subtotal' => $o->subtotal,
                'discount' => $o->discount,
                'tax' => $o->tax,
                'total' => $o->total,
                'paid_amount' => $o->paid_amount,
                'balance' => $o->balance,
                'outlet' => $o->outlet?->name,
            ]),
        ]);
    }

    /**
     * Daily Invoices Report
     */
    public function dailyInvoices(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        $query = Invoice::whereNotNull('issue_date')
            ->whereBetween('issue_date', [$fromDate, $toDate])
            ->where('status', '!=', 'draft')
            ->with(['customer', 'outlet']);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $invoices = $query->orderBy('issue_date', 'desc')->get();

        // Group by date and status
        $grouped = $invoices->groupBy(function ($invoice) {
            return $invoice->issue_date ? $invoice->issue_date->format('Y-m-d') : 'Unknown';
        })->map(function ($dayInvoices, $date) {
            return [
                'date' => $date,
                'total_count' => $dayInvoices->count(),
                'total_amount' => $dayInvoices->sum('total'),
                'total_paid' => $dayInvoices->sum('paid_amount'),
                'total_balance' => $dayInvoices->sum('balance'),
                'by_status' => $dayInvoices->groupBy('status')->map(function ($statusInvoices) {
                    return [
                        'count' => $statusInvoices->count(),
                        'amount' => $statusInvoices->sum('total'),
                    ];
                })->toArray(),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_invoices' => $invoices->count(),
                'total_amount' => $invoices->sum('total'),
                'total_paid' => $invoices->sum('paid_amount'),
                'total_balance' => $invoices->sum('balance'),
            ],
            'daily_breakdown' => $grouped,
            'invoices' => $invoices->map(fn($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'issue_date' => $i->issue_date ? $i->issue_date->format('Y-m-d') : null,
                'due_date' => $i->due_date ? $i->due_date->format('Y-m-d') : null,
                'customer' => $i->customer?->name ?? 'Walk-in',
                'status' => $i->status,
                'subtotal' => $i->subtotal,
                'discount' => $i->discount,
                'tax' => $i->tax,
                'total' => $i->total,
                'paid_amount' => $i->paid_amount,
                'balance' => $i->balance,
                'outlet' => $i->outlet?->name,
            ]),
        ]);
    }

    /**
     * Daily Credit Report
     */
    public function dailyCredit(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        // Get credit invoices
        $invoicesQuery = Invoice::whereNotNull('issue_date')
            ->whereBetween('issue_date', [$fromDate, $toDate])
            ->where('status', '!=', 'draft')
            ->whereHas('customer', function ($q) {
                $q->where('type', 'credit');
            })
            ->with(['customer', 'outlet']);

        if ($outletId) {
            $invoicesQuery->where('outlet_id', $outletId);
        }

        $creditInvoices = $invoicesQuery->get();

        // Get payments on credit invoices
        $paymentsQuery = Payment::whereBetween('payment_date', [$fromDate, $toDate])
            ->whereHas('invoice.customer', function ($q) {
                $q->where('type', 'credit');
            })
            ->with(['invoice.customer', 'invoice.outlet']);

        if ($outletId) {
            $paymentsQuery->whereHas('invoice', function ($q) use ($outletId) {
                $q->where('outlet_id', $outletId);
            });
        }

        $creditPayments = $paymentsQuery->get();

        // Get all credit customers with current status
        $creditCustomers = Customer::where('type', 'credit')
            ->with(['invoices' => function ($q) use ($fromDate, $toDate) {
                $q->whereNotNull('issue_date')
                  ->whereBetween('issue_date', [$fromDate, $toDate])
                  ->where('status', '!=', 'draft');
            }])
            ->get()
            ->map(function ($customer) {
                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'credit_limit' => $customer->credit_limit,
                    'credit_balance' => $customer->credit_balance,
                    'credit_period_days' => $customer->credit_period_days,
                    'period_invoices_count' => $customer->invoices ? $customer->invoices->count() : 0,
                    'period_invoices_amount' => $customer->invoices ? $customer->invoices->sum('total') : 0,
                ];
            });

        // Daily breakdown
        $dailyBreakdown = [];
        $currentDate = $fromDate->copy();
        while ($currentDate <= $toDate) {
            $dateStr = $currentDate->format('Y-m-d');
            $dayInvoices = $creditInvoices->filter(fn($i) => $i->issue_date && $i->issue_date->format('Y-m-d') === $dateStr);
            $dayPayments = $creditPayments->filter(fn($p) => $p->payment_date->format('Y-m-d') === $dateStr);
            
            $dailyBreakdown[$dateStr] = [
                'date' => $dateStr,
                'invoices_count' => $dayInvoices->count(),
                'invoices_amount' => $dayInvoices->sum('total'),
                'payments_count' => $dayPayments->count(),
                'payments_amount' => $dayPayments->sum('amount'),
                'net_credit' => $dayInvoices->sum('total') - $dayPayments->sum('amount'),
            ];
            $currentDate->addDay();
        }

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_credit_invoices' => $creditInvoices->count(),
                'total_credit_issued' => $creditInvoices->sum('total'),
                'total_credit_collected' => $creditPayments->sum('amount'),
                'net_credit_outstanding' => $creditInvoices->sum('total') - $creditPayments->sum('amount'),
                'active_credit_customers' => $creditCustomers->count(),
            ],
            'daily_breakdown' => array_values($dailyBreakdown),
            'credit_customers' => $creditCustomers,
            'invoices' => $creditInvoices->map(fn($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'issue_date' => $i->issue_date ? $i->issue_date->format('Y-m-d') : null,
                'due_date' => $i->due_date ? $i->due_date->format('Y-m-d') : null,
                'customer' => $i->customer?->name,
                'total' => $i->total,
                'paid_amount' => $i->paid_amount,
                'balance' => $i->balance,
            ]),
            'payments' => $creditPayments->map(fn($p) => [
                'id' => $p->id,
                'invoice_number' => $p->invoice->invoice_number ?? null,
                'payment_date' => $p->payment_date->format('Y-m-d'),
                'customer' => $p->invoice->customer->name ?? null,
                'amount' => $p->amount,
                'payment_method' => $p->payment_method,
            ]),
        ]);
    }

    /**
     * Payment Summary Report
     */
    public function paymentSummary(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        $query = Payment::whereBetween('payment_date', [$fromDate, $toDate])
            ->with(['invoice', 'invoice.customer', 'invoice.outlet', 'order', 'order.customer', 'order.outlet']);

        if ($outletId) {
            $query->where(function ($q) use ($outletId) {
                $q->whereHas('invoice', function ($qi) use ($outletId) {
                    $qi->where('outlet_id', $outletId);
                })->orWhereHas('order', function ($qo) use ($outletId) {
                    $qo->where('outlet_id', $outletId);
                });
            });
        }

        $payments = $query->orderBy('payment_date', 'desc')->get();

        // Group by payment method
        $byMethod = $payments->groupBy('payment_method')->map(function ($methodPayments, $method) {
            return [
                'method' => $method,
                'count' => $methodPayments->count(),
                'total' => $methodPayments->sum('amount'),
            ];
        })->values();

        // Daily breakdown
        $dailyBreakdown = $payments->groupBy(function ($payment) {
            return $payment->payment_date->format('Y-m-d');
        })->map(function ($dayPayments, $date) {
            return [
                'date' => $date,
                'count' => $dayPayments->count(),
                'total' => $dayPayments->sum('amount'),
                'by_method' => $dayPayments->groupBy('payment_method')->map(function ($methodPayments) {
                    return $methodPayments->sum('amount');
                })->toArray(),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_payments' => $payments->count(),
                'total_amount' => $payments->sum('amount'),
            ],
            'by_method' => $byMethod,
            'daily_breakdown' => $dailyBreakdown,
            'payments' => $payments->map(fn($p) => [
                'id' => $p->id,
                'payment_date' => $p->payment_date->format('Y-m-d H:i:s'),
                'amount' => $p->amount,
                'payment_method' => $p->payment_method,
                'reference_number' => $p->reference_number,
                'invoice_number' => $p->invoice->invoice_number ?? null,
                'order_number' => $p->order->order_number ?? null,
                'customer' => $p->invoice->customer->name ?? $p->order->customer->name ?? 'Walk-in',
            ]),
        ]);
    }

    /**
     * Invoice Details Report
     */
    public function invoiceDetails(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        $query = Invoice::whereNotNull('issue_date')
            ->whereBetween('issue_date', [$fromDate, $toDate])
            ->where('status', '!=', 'draft')
            ->with(['customer', 'outlet', 'order', 'payments']);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $invoices = $query->orderBy('issue_date', 'desc')->get();

        // Group by week/month
        $groupedByWeek = $invoices->groupBy(function ($invoice) {
            return $invoice->issue_date ? $invoice->issue_date->format('Y-W') : 'Unknown';
        })->map(function ($weekInvoices, $weekKey) {
            return [
                'week' => $weekKey,
                'count' => $weekInvoices->count(),
                'total' => $weekInvoices->sum('total'),
                'paid' => $weekInvoices->sum('paid_amount'),
                'balance' => $weekInvoices->sum('balance'),
            ];
        })->values();

        $groupedByMonth = $invoices->groupBy(function ($invoice) {
            return $invoice->issue_date ? $invoice->issue_date->format('Y-m') : 'Unknown';
        })->map(function ($monthInvoices, $monthKey) {
            return [
                'month' => $monthKey,
                'count' => $monthInvoices->count(),
                'total' => $monthInvoices->sum('total'),
                'paid' => $monthInvoices->sum('paid_amount'),
                'balance' => $monthInvoices->sum('balance'),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_invoices' => $invoices->count(),
                'total_amount' => $invoices->sum('total'),
                'total_paid' => $invoices->sum('paid_amount'),
                'total_balance' => $invoices->sum('balance'),
                'by_status' => $invoices->groupBy('status')->map(function ($statusInvoices) {
                    return [
                        'count' => $statusInvoices->count(),
                        'total' => $statusInvoices->sum('total'),
                    ];
                })->toArray(),
            ],
            'by_week' => $groupedByWeek,
            'by_month' => $groupedByMonth,
            'invoices' => $invoices->map(fn($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'purchase_order_number' => $i->purchase_order_number,
                'issue_date' => $i->issue_date ? $i->issue_date->format('Y-m-d') : null,
                'due_date' => $i->due_date ? $i->due_date->format('Y-m-d') : null,
                'customer' => $i->customer ? [
                    'id' => $i->customer->id,
                    'name' => $i->customer->name,
                    'email' => $i->customer->email,
                    'phone' => $i->customer->phone,
                ] : null,
                'order_number' => $i->order->order_number ?? null,
                'status' => $i->status,
                'subtotal' => $i->subtotal,
                'discount' => $i->discount,
                'tax' => $i->tax,
                'total' => $i->total,
                'paid_amount' => $i->paid_amount,
                'balance' => $i->balance,
                'outlet' => $i->outlet ? [
                    'id' => $i->outlet->id,
                    'name' => $i->outlet->name,
                ] : null,
                'payments_count' => $i->payments ? $i->payments->count() : 0,
            ]),
        ]);
    }

    /**
     * Orders Details Report
     */
    public function ordersDetails(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        $query = Order::whereBetween('created_at', [$fromDate, $toDate])
            ->with(['customer', 'outlet', 'items', 'serviceJobs', 'invoice']);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->orderBy('created_at', 'desc')->get();

        // Group by week/month
        $groupedByWeek = $orders->groupBy(function ($order) {
            return $order->created_at->format('Y-W');
        })->map(function ($weekOrders, $weekKey) {
            return [
                'week' => $weekKey,
                'count' => $weekOrders->count(),
                'total' => $weekOrders->sum('total'),
                'paid' => $weekOrders->sum('paid_amount'),
                'balance' => $weekOrders->sum('balance'),
            ];
        })->values();

        $groupedByMonth = $orders->groupBy(function ($order) {
            return $order->created_at->format('Y-m');
        })->map(function ($monthOrders, $monthKey) {
            return [
                'month' => $monthKey,
                'count' => $monthOrders->count(),
                'total' => $monthOrders->sum('total'),
                'paid' => $monthOrders->sum('paid_amount'),
                'balance' => $monthOrders->sum('balance'),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_orders' => $orders->count(),
                'total_amount' => $orders->sum('total'),
                'total_paid' => $orders->sum('paid_amount'),
                'total_balance' => $orders->sum('balance'),
                'by_status' => $orders->groupBy('status')->map(function ($statusOrders) {
                    return [
                        'count' => $statusOrders->count(),
                        'total' => $statusOrders->sum('total'),
                    ];
                })->toArray(),
                'by_type' => $orders->groupBy('order_type')->map(function ($typeOrders) {
                    return [
                        'count' => $typeOrders->count(),
                        'total' => $typeOrders->sum('total'),
                    ];
                })->toArray(),
            ],
            'by_week' => $groupedByWeek,
            'by_month' => $groupedByMonth,
            'orders' => $orders->map(fn($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'created_at' => $o->created_at->format('Y-m-d H:i:s'),
                'customer' => $o->customer ? [
                    'id' => $o->customer->id,
                    'name' => $o->customer->name,
                    'email' => $o->customer->email,
                    'phone' => $o->customer->phone,
                ] : null,
                'status' => $o->status,
                'order_type' => $o->order_type,
                'subtotal' => $o->subtotal,
                'discount' => $o->discount,
                'tax' => $o->tax,
                'total' => $o->total,
                'paid_amount' => $o->paid_amount,
                'balance' => $o->balance,
                'outlet' => $o->outlet ? [
                    'id' => $o->outlet->id,
                    'name' => $o->outlet->name,
                ] : null,
                'items_count' => $o->items ? $o->items->count() : 0,
                'jobs_count' => $o->serviceJobs ? $o->serviceJobs->count() : 0,
                'has_invoice' => $o->invoice ? true : false,
                'invoice_number' => $o->invoice->invoice_number ?? null,
            ]),
        ]);
    }

    /**
     * Quotations Report
     */
    public function quotations(Request $request)
    {
        [$fromDate, $toDate] = $this->getDateRange($request);
        $outletIdParam = $request->query('outlet_id');
        $outletIdHeader = $request->header('X-Outlet-ID');
        $outletId = $outletIdParam ? ($outletIdParam === 'all' ? null : $outletIdParam) : $outletIdHeader;

        $query = \App\Models\Quotation::whereBetween('created_at', [$fromDate, $toDate])
            ->with(['customer', 'items', 'convertedOrder']);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $quotations = $query->orderBy('created_at', 'desc')->get();

        // Group by week/month
        $groupedByWeek = $quotations->groupBy(function ($quotation) {
            return $quotation->created_at->format('Y-W');
        })->map(function ($weekQuotations, $weekKey) {
            return [
                'week' => $weekKey,
                'count' => $weekQuotations->count(),
                'total' => $weekQuotations->sum('total'),
            ];
        })->values();

        $groupedByMonth = $quotations->groupBy(function ($quotation) {
            return $quotation->created_at->format('Y-m');
        })->map(function ($monthQuotations, $monthKey) {
            return [
                'month' => $monthKey,
                'count' => $monthQuotations->count(),
                'total' => $monthQuotations->sum('total'),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_quotations' => $quotations->count(),
                'total_amount' => $quotations->sum('total'),
                'by_status' => $quotations->groupBy('status')->map(function ($statusQuotations) {
                    return [
                        'count' => $statusQuotations->count(),
                        'total' => $statusQuotations->sum('total'),
                    ];
                })->toArray(),
                'converted_count' => $quotations->whereNotNull('converted_order_id')->count(),
                'converted_total' => $quotations->whereNotNull('converted_order_id')->sum('total'),
            ],
            'by_week' => $groupedByWeek,
            'by_month' => $groupedByMonth,
            'quotations' => $quotations->map(fn($q) => [
                'id' => $q->id,
                'quotation_number' => $q->quote_number,
                'created_at' => $q->created_at->format('Y-m-d H:i:s'),
                'valid_until' => $q->valid_until ? $q->valid_until->format('Y-m-d') : null,
                'customer' => $q->customer ? [
                    'id' => $q->customer->id,
                    'name' => $q->customer->name,
                    'email' => $q->customer->email,
                    'phone' => $q->customer->phone,
                ] : null,
                'status' => $q->status,
                'subtotal' => $q->subtotal,
                'discount' => $q->discount,
                'tax' => $q->tax,
                'total' => $q->total,
                'is_converted' => $q->converted_order_id ? true : false,
                'order_number' => $q->convertedOrder->order_number ?? null,
                'items_count' => $q->items ? $q->items->count() : 0,
            ]),
        ]);
    }
}
