<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\ComboController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\ReportController;
use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Admin\StockMovementController;
use App\Http\Controllers\DeliveryZoneController;

Route::middleware(['admin'])->group(function () {
    // Categorias
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/tree', [CategoryController::class, 'tree']);
    Route::get('/categories/{category}', [CategoryController::class, 'show']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::post('/categories/{category}/update', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
    Route::patch('/categories/{category}/toggle-status', [CategoryController::class, 'toggleStatus']);
    Route::post('/categories/{category}/image', [CategoryController::class, 'uploadImage']);
    Route::delete('/categories/{category}/image', [CategoryController::class, 'deleteImage']);
    Route::get('/categories/validate-slug', [CategoryController::class, 'validateSlug']);
    Route::post('/categories/reorder', [CategoryController::class, 'reorder']);
    Route::patch('/categories/{category}/move', [CategoryController::class, 'move']);
    Route::get('/categories/{category}/stats', [CategoryController::class, 'stats']);

    // Produtos
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{product}', [ProductController::class, 'update']);
    Route::post('/products/{product}/update', [ProductController::class, 'update']);
    Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    Route::patch('/products/{product}/toggle-status', [ProductController::class, 'toggleStatus']);
    Route::post('/products/{product}/image', [ProductController::class, 'uploadImage']);
    Route::delete('/products/{product}/image', [ProductController::class, 'deleteImage']);
    Route::get('/products/generate-sku', [ProductController::class, 'generateSku']);
    Route::get('/products/validate-sku', [ProductController::class, 'validateSku']);
    Route::get('/products/validate-barcode', [ProductController::class, 'validateBarcode']);
    Route::post('/products/import', [ProductController::class, 'import']);
    Route::get('/products/export', [ProductController::class, 'export']);

    // Combos
    Route::get('/combos', [ComboController::class, 'index']);
    Route::get('/combos/generate-sku', [ComboController::class, 'generateSku']);
    Route::get('/combos/validate-sku', [ComboController::class, 'validateSku']);
    Route::get('/combos/validate-barcode', [ComboController::class, 'validateBarcode']);
    Route::get('/combos/products', [ComboController::class, 'getProducts']);
    Route::post('/combos/calculate-price', [ComboController::class, 'calculatePrice']);
    Route::get('/combos/{combo}', [ComboController::class, 'show']);
    Route::post('/combos', [ComboController::class, 'store']);
    Route::put('/combos/{combo}', [ComboController::class, 'update']);
    Route::delete('/combos/{combo}', [ComboController::class, 'destroy']);
    Route::patch('/combos/{combo}/toggle-status', [ComboController::class, 'toggleStatus']);
    Route::post('/combos/{combo}/image', [ComboController::class, 'uploadImage']);
    Route::delete('/combos/{combo}/image', [ComboController::class, 'deleteImage']);

    // Usuários
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);
    Route::patch('/users/{user}/toggle-status', [UserController::class, 'toggleStatus']);
    Route::post('/users/{user}/avatar', [UserController::class, 'uploadAvatar']);
    Route::delete('/users/{user}/avatar', [UserController::class, 'deleteAvatar']);
    Route::get('/users/validate-email', [UserController::class, 'validateEmail']);
    Route::post('/users/import', [UserController::class, 'import']);
    Route::get('/users/export', [UserController::class, 'export']);

    // Movimentações de Estoque
    Route::get('/stock-movements', [StockMovementController::class, 'index']);
    Route::get('/stock-movements/summary', [StockMovementController::class, 'summary']);
    Route::get('/stock-movements/export', [StockMovementController::class, 'export']);

    // Dashboard
    Route::get('/dashboard/summary', [ReportController::class, 'dashboardSummary']);
    Route::get('/dashboard/sales-chart', [ReportController::class, 'salesChart']);
    Route::get('/dashboard/top-products', [ReportController::class, 'topProducts']);
    Route::get('/dashboard/top-customers', [ReportController::class, 'topCustomers']);
    Route::get('/dashboard/customer-summary', [ReportController::class, 'getCustomerSummary']);

    // Configurações
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update']);
    Route::post('/settings/logo', [SettingController::class, 'uploadLogo']);
    Route::post('/settings/favicon', [SettingController::class, 'uploadFavicon']);
    Route::post('/settings/backup', [SettingController::class, 'backup']);
    Route::get('/settings/backups', [SettingController::class, 'listBackups']);
    Route::post('/settings/restore', [SettingController::class, 'restore']);

    // Banners
    Route::get('/banners', [App\Http\Controllers\BannerController::class, 'index']);
    Route::get('/banners/{banner}', [App\Http\Controllers\BannerController::class, 'show']);
    Route::post('/banners', [App\Http\Controllers\BannerController::class, 'store']);
    Route::put('/banners/{banner}', [App\Http\Controllers\BannerController::class, 'update']);
    Route::delete('/banners/{banner}', [App\Http\Controllers\BannerController::class, 'destroy']);
    Route::post('/banners/upload', [App\Http\Controllers\BannerController::class, 'upload']);
    Route::post('/banners/reorder', [App\Http\Controllers\BannerController::class, 'reorder']);

    // Delivery Zones (Bairros)
    Route::get('/delivery-zones', [DeliveryZoneController::class, 'adminIndex']);
    Route::get('/delivery-zones/{deliveryZone}', [DeliveryZoneController::class, 'show']);
    Route::post('/delivery-zones', [DeliveryZoneController::class, 'store']);
    Route::put('/delivery-zones/{deliveryZone}', [DeliveryZoneController::class, 'update']);
    Route::delete('/delivery-zones/{deliveryZone}', [DeliveryZoneController::class, 'destroy']);

    // Endpoint de teste para debug
    Route::post('/settings/test', function(\Illuminate\Http\Request $request) {
        return response()->json([
            'message' => 'Test endpoint working',
            'data' => $request->all(),
            'headers' => $request->headers->all()
        ]);
    });

    // Endpoint de teste para favicon sem autenticação
    Route::post('/settings/favicon-test', function(\Illuminate\Http\Request $request) {
        \Log::info('Favicon test endpoint:', [
            'files' => $request->allFiles(),
            'headers' => $request->headers->all(),
            'content_type' => $request->header('Content-Type')
        ]);

        return response()->json([
            'message' => 'Favicon test endpoint working',
            'files' => $request->allFiles(),
            'content_type' => $request->header('Content-Type')
        ]);
    });
});
