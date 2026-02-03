<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->withCount('products')
            ->orderBy('position')
            ->orderBy('name')
            ->get();
        return response()->json($categories);
    }

    /**
     * Cardápio: categorias com produtos agrupados (sem paginação).
     * Usado pela página /produtos para exibir todas as categorias e seus produtos de uma vez.
     * Exclui a categoria "Combos" (combos vêm do endpoint /combos).
     */
    public function menu(Request $request): JsonResponse
    {
        $categoryId = $request->input('category_id');

        $query = Category::query()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereRaw('LOWER(name) != ?', ['combos'])
                  ->whereRaw('LOWER(slug) != ?', ['combos']);
            })
            ->whereHas('products', function ($q) {
                $q->where('is_active', true);
            })
            ->with(['products' => function ($q) {
                $q->where('is_active', true)
                  ->orderBy('name');
            }])
            ->orderBy('position')
            ->orderBy('name');

        if ($categoryId) {
            $query->where('id', (int) $categoryId);
        }

        $categories = $query->get();
        return response()->json($categories);
    }

    public function show($id)
    {
        $category = Category::with('products')->findOrFail($id);
        return response()->json($category);
    }
}