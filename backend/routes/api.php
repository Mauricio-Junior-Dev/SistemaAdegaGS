<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SocialAuthController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\AddressController;
use App\Http\Controllers\Api\CashController;
use App\Http\Controllers\DeliveryZoneController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Auth;

// Rotas públicas
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/social', [SocialAuthController::class, 'socialAuth']);
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/suggestions', [ProductController::class, 'suggestions']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/combos', [App\Http\Controllers\Api\Admin\ComboController::class, 'publicIndex']);
Route::get('/combos/{combo}', [App\Http\Controllers\Api\Admin\ComboController::class, 'publicShow']);
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/categories/{category}', [CategoryController::class, 'show']);

// Configurações públicas (sem autenticação)
Route::get('/public/settings', [App\Http\Controllers\Api\Admin\SettingController::class, 'publicSettings']);

// Status da loja (público)
Route::get('/store-status', [App\Http\Controllers\Api\StoreConfigController::class, 'getStoreStatus']);

// Banners públicos (sem autenticação)
Route::get('/banners/active', [App\Http\Controllers\BannerController::class, 'active']);

// Delivery zones públicas (sem autenticação)
Route::get('/delivery-zones', [DeliveryZoneController::class, 'index']);
Route::get('/frete', [DeliveryZoneController::class, 'calculateFrete']);

// --- WEBHOOKS (Rotas Públicas para Serviços Externos) ---
Route::post('/webhooks/mercadopago', [WebhookController::class, 'handleMercadoPago'])
    ->name('webhooks.mercadopago');

// Endpoint de teste sem middleware
Route::get('/test-no-auth', function () {
    return response()->json(['message' => 'Endpoint funcionando sem autenticação']);
});


// Rotas protegidas
Route::middleware('auth:sanctum')->group(function () {
    // Autenticação
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    
    // Endpoint de teste para admin
    Route::get('/test-admin', function (Request $request) {
        return response()->json([
            'user' => $request->user(),
            'is_admin' => $request->user()->isAdmin(),
            'type' => $request->user()->type
        ]);
    })->middleware('admin');
    
    // Endpoint de teste simples (sem middleware admin)
    Route::get('/test-auth', function (Request $request) {
        return response()->json([
            'authenticated' => Auth::check(),
            'user' => $request->user(),
            'token_valid' => $request->user() !== null
        ]);
    });
    
    // Endpoint de teste para categorias (sem middleware admin)
    Route::get('/test-categories', function () {
        $categories = \App\Models\Category::all();
        return response()->json([
            'count' => $categories->count(),
            'categories' => $categories
        ]);
    });
    
    // Endpoint de teste para verificar admin
    Route::get('/test-admin-check', function (Request $request) {
        $user = $request->user();
        return response()->json([
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'type' => $user->type,
                'is_admin' => $user->isAdmin()
            ] : null,
            'auth_check' => Auth::check()
        ]);
    });
    
    // Endpoint de teste para verificar dados
    Route::get('/test-data', function () {
        $categories = \App\Models\Category::where('is_active', true)->get();
        $products = \App\Models\Product::where('is_active', true)->get();
        $users = \App\Models\User::where('is_active', true)->get();
        
        return response()->json([
            'categories' => [
                'total' => $categories->count(),
                'active' => $categories->count(),
                'data' => $categories->map(function($cat) {
                    return ['id' => $cat->id, 'name' => $cat->name, 'is_active' => $cat->is_active];
                })
            ],
            'products' => [
                'total' => $products->count(),
                'active' => $products->count()
            ],
            'users' => [
                'total' => $users->count(),
                'active' => $users->count()
            ]
        ]);
    });



    Route::post('/orders', [OrderController::class, 'store']);

    // Rotas de cliente
    Route::middleware('customer')->group(function () {
        Route::get('/my-orders', [OrderController::class, 'myOrders']);
        Route::put('/orders/{order}/confirm-delivery', [OrderController::class, 'confirmDelivery']);
        Route::post('/orders/{order}/create-payment', [PaymentController::class, 'createPixPayment']);
        
        // Endereços (apenas atualizar e deletar próprios endereços)
        Route::put('/addresses/{address}', [AddressController::class, 'update']);
        Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);
        Route::patch('/addresses/{address}/default', [AddressController::class, 'setDefault']);
    });

    // Rota compartilhada: clientes podem ver seus próprios pedidos, funcionários podem ver todos
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    
    // Rotas compartilhadas de endereços: 
    // - Clientes podem listar/criar/ver seus próprios endereços
    // - Funcionários/Admins podem listar/criar/ver endereços de qualquer cliente (usando user_id)
    Route::get('/addresses', [AddressController::class, 'index']); // Lista endereços (com suporte a user_id para funcionários)
    Route::post('/addresses', [AddressController::class, 'store']); // Cria endereço (com suporte a user_id para funcionários)
    Route::get('/addresses/{address}', [AddressController::class, 'show']); // Visualiza endereço específico

    // Rotas de funcionário e admin
    Route::middleware('employee')->group(function () {
        // Status da loja (admin/funcionário)
        Route::post('/admin/store-status', [App\Http\Controllers\Api\StoreConfigController::class, 'updateStoreStatus']);
        
        // Caixa
        Route::get('/cash/status', [CashController::class, 'status']);
        Route::post('/cash/open', [CashController::class, 'open']);
        Route::post('/cash/close', [CashController::class, 'close']);
        Route::get('/cash/today', [CashController::class, 'today']);
        Route::post('/cash/transaction', [CashController::class, 'transaction']);
        Route::get('/cash/report', [CashController::class, 'report']);
        // Pedidos
        Route::get('/orders', [OrderController::class, 'index']);
        // REMOVIDO: Route::post('/orders', ...) - Movida para fora do grupo, compartilhada entre clientes e funcionários
        Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);
        Route::post('/orders/create', [OrderController::class, 'store']); // Mantida para compatibilidade
        Route::post('/orders/manual', [OrderController::class, 'createManualOrder']);
        Route::post('/orders/{order}/print', [OrderController::class, 'printOrder']);
        Route::get('/customers/search', [OrderController::class, 'searchCustomers']);
        Route::post('/customers/quick', [OrderController::class, 'createQuickCustomer']);

        // Estoque
        Route::get('/stock', [StockController::class, 'index']);
        Route::get('/stock/summary', [StockController::class, 'summary']);
        Route::get('/stock/low', [StockController::class, 'lowStock']);
        Route::get('/stock/{product}', [StockController::class, 'show']);
        Route::get('/stock/{product}/movements', [StockController::class, 'movements']);
        Route::post('/stock/{product}', [StockController::class, 'update']);
    });

    // Rotas administrativas específicas de caixa
    Route::middleware('admin')->group(function () {
        Route::get('/admin/cash/sessions', [CashController::class, 'sessions']);
        Route::get('/admin/cash/sessions/{session}', [CashController::class, 'sessionDetail']);
        Route::get('/admin/cash/transactions', [CashController::class, 'transactions']);
    });
});