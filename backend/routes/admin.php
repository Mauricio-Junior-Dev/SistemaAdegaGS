<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\ReportController;
use App\Http\Controllers\Api\Admin\SettingController;

Route::middleware(['admin'])->group(function () {
    // Categorias
    Route::get('/admin/categories', [CategoryController::class, 'index']);
    Route::get('/admin/categories/tree', [CategoryController::class, 'tree']);
    Route::get('/admin/categories/{category}', [CategoryController::class, 'show']);
    Route::post('/admin/categories', [CategoryController::class, 'store']);
    Route::put('/admin/categories/{category}', [CategoryController::class, 'update']);
    // Suporte a atualização via POST (útil para multipart/form-data em alguns clientes)
    Route::post('/admin/categories/{category}/update', [CategoryController::class, 'update']);
    Route::delete('/admin/categories/{category}', [CategoryController::class, 'destroy']);
    Route::patch('/admin/categories/{category}/toggle-status', [CategoryController::class, 'toggleStatus']);
    Route::post('/admin/categories/{category}/image', [CategoryController::class, 'uploadImage']);
    Route::delete('/admin/categories/{category}/image', [CategoryController::class, 'deleteImage']);
    Route::get('/admin/categories/validate-slug', [CategoryController::class, 'validateSlug']);
    Route::post('/admin/categories/reorder', [CategoryController::class, 'reorder']);
    Route::patch('/admin/categories/{category}/move', [CategoryController::class, 'move']);
    Route::get('/admin/categories/{category}/stats', [CategoryController::class, 'stats']);

    // Produtos
    Route::get('/admin/products', [ProductController::class, 'index']);
    Route::get('/admin/products/{product}', [ProductController::class, 'show']);
    Route::post('/admin/products', [ProductController::class, 'store']);
    Route::put('/admin/products/{product}', [ProductController::class, 'update']);
    Route::delete('/admin/products/{product}', [ProductController::class, 'destroy']);
    Route::patch('/admin/products/{product}/toggle-status', [ProductController::class, 'toggleStatus']);
    Route::post('/admin/products/{product}/image', [ProductController::class, 'uploadImage']);
    Route::delete('/admin/products/{product}/image', [ProductController::class, 'deleteImage']);
    Route::get('/admin/products/generate-sku', [ProductController::class, 'generateSku']);
    Route::get('/admin/products/validate-sku', [ProductController::class, 'validateSku']);
    Route::get('/admin/products/validate-barcode', [ProductController::class, 'validateBarcode']);
    Route::post('/admin/products/import', [ProductController::class, 'import']);
    Route::get('/admin/products/export', [ProductController::class, 'export']);

    // Usuários
    Route::get('/admin/users', [UserController::class, 'index']);
    Route::get('/admin/users/{user}', [UserController::class, 'show']);
    Route::post('/admin/users', [UserController::class, 'store']);
    Route::put('/admin/users/{user}', [UserController::class, 'update']);
    Route::delete('/admin/users/{user}', [UserController::class, 'destroy']);
    Route::patch('/admin/users/{user}/toggle-status', [UserController::class, 'toggleStatus']);
    Route::post('/admin/users/{user}/avatar', [UserController::class, 'uploadAvatar']);
    Route::delete('/admin/users/{user}/avatar', [UserController::class, 'deleteAvatar']);
    Route::get('/admin/users/validate-email', [UserController::class, 'validateEmail']);
    Route::post('/admin/users/import', [UserController::class, 'import']);
    Route::get('/admin/users/export', [UserController::class, 'export']);

    // Relatórios
    Route::get('/admin/reports/sales', [ReportController::class, 'sales']);
    Route::get('/admin/reports/products', [ReportController::class, 'products']);
    Route::get('/admin/reports/categories', [ReportController::class, 'categories']);
    Route::get('/admin/reports/users', [ReportController::class, 'users']);
    Route::get('/admin/reports/stock', [ReportController::class, 'stock']);
    Route::get('/admin/reports/customers', [ReportController::class, 'customers']);
    Route::get('/admin/reports/employees', [ReportController::class, 'employees']);

    // Dashboard
    Route::get('/admin/dashboard/summary', [ReportController::class, 'dashboardSummary']);
    Route::get('/admin/dashboard/sales-chart', [ReportController::class, 'salesChart']);
    Route::get('/admin/dashboard/top-products', [ReportController::class, 'topProducts']);
    Route::get('/admin/dashboard/top-customers', [ReportController::class, 'topCustomers']);

    // Configurações
    Route::get('/admin/settings', [SettingController::class, 'index']);
    Route::put('/admin/settings', [SettingController::class, 'update']);
    Route::post('/admin/settings/logo', [SettingController::class, 'uploadLogo']);
    Route::post('/admin/settings/favicon', [SettingController::class, 'uploadFavicon']);
    Route::post('/admin/settings/backup', [SettingController::class, 'backup']);
    Route::get('/admin/settings/backups', [SettingController::class, 'listBackups']);
    Route::post('/admin/settings/restore', [SettingController::class, 'restore']);

    // Banners
    Route::get('/admin/banners', [App\Http\Controllers\BannerController::class, 'index']);
    Route::get('/admin/banners/{banner}', [App\Http\Controllers\BannerController::class, 'show']);
    Route::post('/admin/banners', [App\Http\Controllers\BannerController::class, 'store']);
    Route::put('/admin/banners/{banner}', [App\Http\Controllers\BannerController::class, 'update']);
    Route::delete('/admin/banners/{banner}', [App\Http\Controllers\BannerController::class, 'destroy']);
    Route::post('/admin/banners/upload', [App\Http\Controllers\BannerController::class, 'upload']);
    Route::post('/admin/banners/reorder', [App\Http\Controllers\BannerController::class, 'reorder']);
    
    // Endpoint de teste para debug
    Route::post('/admin/settings/test', function(\Illuminate\Http\Request $request) {
        return response()->json([
            'message' => 'Test endpoint working',
            'data' => $request->all(),
            'headers' => $request->headers->all()
        ]);
    });

    // Endpoint de teste para favicon sem autenticação
    Route::post('/admin/settings/favicon-test', function(\Illuminate\Http\Request $request) {
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
