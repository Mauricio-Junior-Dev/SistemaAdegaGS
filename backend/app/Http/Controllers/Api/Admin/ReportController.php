<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboardSummary(): JsonResponse
    {
        $today = Carbon::today();
        $thisMonth = Carbon::now()->startOfMonth();
        $thisWeek = Carbon::now()->startOfWeek();
        
        // Vendas
        $dailySales = Order::whereDate('created_at', $today)
            ->where('status', 'completed')
            ->sum('total');
            
        $weeklySales = Order::where('created_at', '>=', $thisWeek)
            ->where('status', 'completed')
            ->sum('total');
            
        $monthlySales = Order::where('created_at', '>=', $thisMonth)
            ->where('status', 'completed')
            ->sum('total');
            
        $totalOrders = Order::where('status', 'completed')->count();
        $averageTicket = $totalOrders > 0 ? $monthlySales / $totalOrders : 0;
        
        // Pedidos por status
        $pendingOrders = Order::where('status', 'pending')->count();
        $deliveringOrders = Order::where('status', 'delivering')->count();
        $completedOrders = Order::where('status', 'completed')->count();
        $cancelledOrders = Order::where('status', 'cancelled')->count();
        $totalOrderAmount = Order::where('status', 'completed')->sum('total');
        
        // Estoque
        $totalProducts = Product::count();
        $lowStockCount = Product::whereColumn('current_stock', '<=', 'min_stock')->count();
        $outOfStockCount = Product::where('current_stock', 0)->count();
        $totalStockValue = Product::sum(\DB::raw('current_stock * price'));
        $categoriesCount = Category::count();
        
        // Usuários
        $totalUsers = User::count();
        $customers = User::where('type', 'customer')->count();
        $employees = User::where('type', 'employee')->count();
        $admins = User::where('type', 'admin')->count();
        $newThisMonth = User::where('created_at', '>=', $thisMonth)->count();
        
        return response()->json([
            'sales' => [
                'today' => $dailySales,
                'week' => $weeklySales,
                'month' => $monthlySales,
                'total_orders' => $totalOrders,
                'average_ticket' => $averageTicket,
                'by_payment_method' => []
            ],
            'stock' => [
                'total_products' => $totalProducts,
                'low_stock_count' => $lowStockCount,
                'out_of_stock_count' => $outOfStockCount,
                'total_value' => $totalStockValue,
                'categories_count' => $categoriesCount
            ],
            'users' => [
                'total' => $totalUsers,
                'customers' => $customers,
                'employees' => $employees,
                'admins' => $admins,
                'new_this_month' => $newThisMonth
            ],
            'orders' => [
                'pending' => $pendingOrders,
                'delivering' => $deliveringOrders,
                'completed' => $completedOrders,
                'cancelled' => $cancelledOrders,
                'total_amount' => $totalOrderAmount
            ]
        ]);
    }

    public function salesChart(): JsonResponse
    {
        $last30Days = Carbon::now()->subDays(30);
        
        $salesData = Order::where('created_at', '>=', $last30Days)
            ->where('status', 'completed')
            ->selectRaw('DATE(created_at) as date, SUM(total) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get();
        
        $labels = $salesData->pluck('date')->map(function($date) {
            return Carbon::parse($date)->format('d/m');
        })->toArray();
        
        $data = $salesData->pluck('total')->toArray();
        
        return response()->json([
            'labels' => $labels,
            'data' => $data
        ]);
    }

    public function topProducts(): JsonResponse
    {
        // Query corrigida: calcula receita como SUM(price * quantity) e quantidade como SUM(quantity)
        $topProducts = Product::with('category')
            ->with(['orderItems' => function($query) {
                $query->whereHas('order', function($orderQuery) {
                    $orderQuery->where('status', 'completed');
                });
            }])
            ->get()
            ->map(function($product) {
                $quantitySold = $product->orderItems->sum('quantity');
                $totalRevenue = $product->orderItems->sum(function($item) {
                    return $item->quantity * $item->price;
                });
                
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'quantity_sold' => $quantitySold,
                    'total_revenue' => $totalRevenue
                ];
            })
            ->sortByDesc('quantity_sold')
            ->take(5)
            ->values();
        
        return response()->json($topProducts);
    }

    public function topCustomers(): JsonResponse
    {
        // Query corrigida: filtra apenas pedidos concluídos para calcular total_gasto
        $topCustomers = User::where('type', 'customer')
            ->withCount(['orders' => function($query) {
                $query->where('status', 'completed');
            }])
            ->withSum(['orders' => function($query) {
                $query->where('status', 'completed');
            }], 'total')
            ->orderBy('orders_sum_total', 'desc')
            ->take(5)
            ->get()
            ->map(function($customer) {
                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'orders_count' => $customer->orders_count ?? 0,
                    'total_spent' => $customer->orders_sum_total ?? 0
                ];
            });
        
        return response()->json($topCustomers);
    }
    public function sales(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'period' => 'nullable|in:daily,weekly,monthly,yearly'
        ]);

        $startDate = $request->query('start_date') ? Carbon::parse($request->query('start_date')) : Carbon::now()->subDays(30);
        $endDate = $request->query('end_date') ? Carbon::parse($request->query('end_date')) : Carbon::now();

        $queryBase = Order::where('status', 'completed')
                      ->whereBetween('created_at', [$startDate, $endDate]);

        // 1. DADOS PARA O GRÁFICO (Já formatado para Chart.js)
        $salesData = (clone $queryBase)
            ->selectRaw('DATE(created_at) as date, SUM(total) as total_sales')
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        $chartData = [
            'labels' => $salesData->pluck('date')->map(fn($date) => Carbon::parse($date)->format('d/m'))->toArray(),
            'datasets' => [
                [
                    'label' => 'Vendas (R$)',
                    'data' => $salesData->pluck('total_sales')->toArray(),
                    'borderColor' => '#4CAF50',
                    'tension' => 0.1
                ]
            ]
        ];

        // 2. DADOS PARA OS KPIs (RESUMO)
        $summary = [
            'total_orders' => (clone $queryBase)->count(),
            'total_sales' => (clone $queryBase)->sum('total'),
            'average_order_value' => (clone $queryBase)->avg('total') ?? 0,
        ];

        return response()->json([
            'summary' => $summary,
            'chart' => $chartData,
        ]);
    }

    public function products(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'category_id' => 'nullable|exists:categories,id'
        ]);

        $startDate = $request->start_date ? Carbon::parse($request->start_date) : Carbon::now()->startOfMonth();
        $endDate = $request->end_date ? Carbon::parse($request->end_date) : Carbon::now()->endOfMonth();

        $query = Product::with(['category', 'orderItems' => function($q) use ($startDate, $endDate) {
            $q->whereHas('order', function($orderQuery) use ($startDate, $endDate) {
                $orderQuery->whereBetween('created_at', [$startDate, $endDate]);
            });
        }]);

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $products = $query->get()->map(function($product) {
            $totalSold = $product->orderItems->sum('quantity');
            $totalRevenue = $product->orderItems->sum(function($item) {
                return $item->quantity * $item->price;
            });

            return [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category->name,
                'current_stock' => $product->current_stock,
                'min_stock' => $product->min_stock,
                'price' => $product->price,
                'total_sold' => $totalSold,
                'total_revenue' => $totalRevenue,
                'is_low_stock' => $product->current_stock <= $product->min_stock
            ];
        })->sortByDesc('total_sold')->values();

        // Produtos mais vendidos
        $topProducts = $products->take(10);

        // Produtos com estoque baixo
        $lowStockProducts = $products->where('is_low_stock', true);

        // Resumo
        $summary = [
            'total_products' => Product::count(),
            'active_products' => Product::where('is_active', true)->count(),
            'low_stock_products' => Product::whereColumn('current_stock', '<=', 'min_stock')->count(),
            'total_stock_value' => Product::sum('current_stock * price')
        ];

        return response()->json([
            'period' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString()
            ],
            'summary' => $summary,
            'top_products' => $topProducts,
            'low_stock_products' => $lowStockProducts,
            'all_products' => $products
        ]);
    }

    public function categories(Request $request): JsonResponse
    {
        $categories = Category::with(['products', 'children'])->get()->map(function($category) {
            $productsCount = $category->products()->count();
            $activeProductsCount = $category->products()->where('is_active', true)->count();
            $totalStockValue = $category->products()->sum('current_stock * price');
            $lowStockCount = $category->products()->whereColumn('current_stock', '<=', 'min_stock')->count();

            return [
                'id' => $category->id,
                'name' => $category->name,
                'parent' => $category->parent ? $category->parent->name : null,
                'children_count' => $category->children()->count(),
                'products_count' => $productsCount,
                'active_products_count' => $activeProductsCount,
                'total_stock_value' => $totalStockValue,
                'low_stock_count' => $lowStockCount,
                'is_active' => $category->is_active
            ];
        });

        // Categorias mais utilizadas
        $topCategories = $categories->sortByDesc('products_count')->take(10);

        // Categorias com estoque baixo
        $categoriesWithLowStock = $categories->where('low_stock_count', '>', 0);

        // Resumo
        $summary = [
            'total_categories' => Category::count(),
            'active_categories' => Category::where('is_active', true)->count(),
            'categories_with_products' => Category::has('products')->count(),
            'empty_categories' => Category::doesntHave('products')->count()
        ];

        return response()->json([
            'summary' => $summary,
            'top_categories' => $topCategories,
            'categories_with_low_stock' => $categoriesWithLowStock,
            'all_categories' => $categories
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'nullable|in:admin,employee,customer'
        ]);

        $query = User::withCount(['orders']);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $users = $query->get()->map(function($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'type' => $user->type,
                'orders_count' => $user->orders_count,
                'total_spent' => $user->orders()->sum('total'),
                'last_order' => $user->orders()->latest()->first()?->created_at,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at
            ];
        });

        // Usuários mais ativos
        $topUsers = $users->sortByDesc('orders_count')->take(10);

        // Usuários por tipo
        $usersByType = [
            'admin' => $users->where('type', 'admin')->count(),
            'employee' => $users->where('type', 'employee')->count(),
            'customer' => $users->where('type', 'customer')->count()
        ];

        // Resumo
        $summary = [
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'users_with_orders' => User::has('orders')->count(),
            'new_users_this_month' => User::whereMonth('created_at', Carbon::now()->month)->count()
        ];

        return response()->json([
            'summary' => $summary,
            'users_by_type' => $usersByType,
            'top_users' => $topUsers,
            'all_users' => $users
        ]);
    }

    public function stock(Request $request): JsonResponse
    {
        // 1. DADOS PARA TABELA (Produtos com Baixo Estoque)
        $lowStockProducts = Product::where('is_active', true)
            ->whereColumn('current_stock', '<=', 'min_stock')
            ->orderBy('current_stock', 'asc')
            ->get(['id', 'name', 'current_stock', 'min_stock']);

        // 2. DADOS PARA OS KPIs (RESUMO)
        $totalStockValue = Product::where('is_active', true)
            ->sum(DB::raw('current_stock * cost_price'));

        $summary = [
            'products_in_low_stock' => $lowStockProducts->count(),
            'total_stock_value' => (float) $totalStockValue,
        ];

        return response()->json([
            'summary' => $summary,
            'low_stock_table' => $lowStockProducts,
        ]);
    }

    public function customers(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date') ? Carbon::parse($request->query('start_date')) : Carbon::now()->subDays(30);
        $endDate = $request->query('end_date') ? Carbon::parse($request->query('end_date')) : Carbon::now();

        // 1. DADOS PARA O GRÁFICO (Novos Clientes por Dia)
        $newCustomers = User::where('type', 'customer')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        $chartData = [
            'labels' => $newCustomers->pluck('date')->map(fn($date) => Carbon::parse($date)->format('d/m'))->toArray(),
            'datasets' => [
                [
                    'label' => 'Novos Clientes',
                    'data' => $newCustomers->pluck('count')->toArray(),
                    'backgroundColor' => '#2196F3',
                ]
            ]
        ];

        // 2. DADOS PARA OS KPIs (RESUMO)
        $summary = [
            'total_customers' => User::where('type', 'customer')->count(),
            'new_customers_period' => $newCustomers->sum('count'),
        ];

        return response()->json([
            'summary' => $summary,
            'chart' => $chartData,
        ]);
    }

    public function employees(Request $request): JsonResponse
    {
        try {
            $startDate = $request->query('start_date') ? Carbon::parse($request->query('start_date')) : Carbon::now()->subDays(30);
            $endDate = $request->query('end_date') ? Carbon::parse($request->query('end_date')) : Carbon::now();

            $employees = User::whereIn('type', ['admin', 'employee'])
                ->withCount(['orders' => function ($query) use ($startDate, $endDate) {
                    $query->where('status', 'completed')
                          ->whereBetween('created_at', [$startDate, $endDate]);
                }])
                ->withSum(['orders' => function ($query) use ($startDate, $endDate) {
                    $query->where('status', 'completed')
                          ->whereBetween('created_at', [$startDate, $endDate]);
                }], 'total')
                ->get();

            // Formatar para o Gráfico
            $chartData = [
                'labels' => $employees->pluck('name')->toArray(),
                'datasets' => [
                    [
                        'label' => 'Vendas (R$)',
                        'data' => $employees->pluck('orders_sum_total')->toArray(),
                        'backgroundColor' => '#FFC107',
                    ]
                ]
            ];

            return response()->json([
                'chart' => $chartData,
                'table_data' => $employees, // Envia dados brutos para uma tabela
            ]);
        } catch (\Exception $e) {
            \Log::error('Employees method error: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'chart' => ['labels' => [], 'datasets' => []],
                'table_data' => []
            ], 500);
        }
    }

    /**
     * Calcula a taxa de retenção de clientes
     */
    private function calculateRetentionRate(): float
    {
        $totalCustomers = \App\Models\User::where('type', 'customer')->count();
        if ($totalCustomers === 0) {
            return 0.0;
        }

        $activeCustomers = \App\Models\User::where('type', 'customer')
            ->whereHas('orders')
            ->count();

        return round(($activeCustomers / $totalCustomers) * 100, 1);
    }

    /**
     * Calcula a precisão do balanço de um funcionário
     */
    private function calculateBalanceAccuracy(int $employeeId): float
    {
        // Implementação simples baseada em transações
        $transactions = \App\Models\FinancialTransaction::where('created_by', $employeeId)->count();
        
        if ($transactions === 0) {
            return 100.0; // Sem transações = 100% de precisão
        }

        // Lógica simplificada: quanto mais transações, menor a chance de erro
        $accuracy = max(85.0, 100.0 - ($transactions * 0.1));
        return round($accuracy, 1);
    }

    /**
     * Retorna dados para o gráfico de pizza de Clientes (Novos vs. Recorrentes)
     * para o /admin/dashboard.
     */
    public function getCustomerSummary(Request $request)
    {
        $startDate = $request->query('start_date') ? Carbon::parse($request->query('start_date')) : Carbon::now()->subDays(30);
        $endDate = $request->query('end_date') ? Carbon::parse($request->query('end_date')) : Carbon::now();

        $allCustomersInPeriod = Order::where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->select('user_id')
            ->distinct()
            ->pluck('user_id')
            ->toArray();

        $newCustomersCount = User::whereIn('id', $allCustomersInPeriod)
            ->where('created_at', '>=', $startDate)
            ->count();

        $returningCustomersCount = count($allCustomersInPeriod) - $newCustomersCount;

        return response()->json([
            'labels' => ['Novos Clientes', 'Clientes Recorrentes'],
            'datasets' => [
                [
                    'data' => [$newCustomersCount, $returningCustomersCount],
                    'backgroundColor' => ['#4CAF50', '#2196F3'], // Cores do gráfico
                ]
            ]
        ]);
    }
}
