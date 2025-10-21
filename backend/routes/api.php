<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SocialAuthController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\AddressController;

// Rotas públicas
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/social', [SocialAuthController::class, 'socialAuth']);
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/categories/{category}', [CategoryController::class, 'show']);

// Configurações públicas (sem autenticação)
Route::get('/public/settings', [App\Http\Controllers\Api\Admin\SettingController::class, 'publicSettings']);

// Banners públicos (sem autenticação)
Route::get('/banners/active', [App\Http\Controllers\BannerController::class, 'active']);


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
            'authenticated' => auth()->check(),
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
            'auth_check' => auth()->check()
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

    // Rotas de cliente
    Route::middleware('customer')->group(function () {
        Route::get('/my-orders', [OrderController::class, 'myOrders']);
        Route::post('/orders', [OrderController::class, 'store']);
        
        // Endereços
        Route::get('/addresses', [AddressController::class, 'index']);
        Route::post('/addresses', [AddressController::class, 'store']);
        Route::get('/addresses/{address}', [AddressController::class, 'show']);
        Route::put('/addresses/{address}', [AddressController::class, 'update']);
        Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);
        Route::patch('/addresses/{address}/default', [AddressController::class, 'setDefault']);
    });

    // Rotas de funcionário e admin
    Route::middleware('employee')->group(function () {
        // Pedidos
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{order}', [OrderController::class, 'show']);
        Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);
        Route::post('/orders/create', [OrderController::class, 'store']);

        // Estoque
        Route::get('/stock', [StockController::class, 'index']);
        Route::get('/stock/summary', [StockController::class, 'summary']);
        Route::get('/stock/low', [StockController::class, 'lowStock']);
        Route::get('/stock/{product}', [StockController::class, 'show']);
        Route::get('/stock/{product}/movements', [StockController::class, 'movements']);
        Route::post('/stock/{product}', [StockController::class, 'update']);
    });

    // Rotas administrativas
    require __DIR__.'/admin.php';
});