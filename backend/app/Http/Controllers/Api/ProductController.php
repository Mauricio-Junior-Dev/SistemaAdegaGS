<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with('category')
            ->where('is_active', true)
            ->where('visible_online', true);

        // Filtrar por categoria
        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filtrar produtos em destaque
        if ($request->boolean('featured')) {
            $query->where('featured', true);
        }

        // Filtrar produtos populares
        if ($request->boolean('popular')) {
            $query->where('popular', true);
        }

        // Filtrar produtos em oferta
        if ($request->boolean('offers')) {
            $query->where('offers', true);
        }

        // Busca por nome ou descrição
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Ordenação
        $sortField = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortField, $sortOrder);

        // Paginação
        $perPage = $request->get('per_page', 12);
        return $query->paginate($perPage);
    }

    public function show($id)
    {
        $product = Product::with('category')
            ->where('is_active', true)
            ->where('visible_online', true)
            ->findOrFail($id);
        return response()->json($product);
    }

    /**
     * Get product suggestions based on cart items
     */
    public function suggestions(Request $request)
    {
        $request->validate([
            'cart_ids' => 'required|array',
            'cart_ids.*' => 'integer|exists:products,id',
            'limit' => 'integer|min:1|max:8'
        ]);

        $cartIds = $request->cart_ids;
        $limit = $request->get('limit', 6);

        // Buscar produtos do carrinho para obter suas categorias
        $cartProducts = Product::whereIn('id', $cartIds)->get();
        $cartCategories = $cartProducts->pluck('category_id')->unique()->filter();

        // Buscar produtos populares primeiro
        $suggestions = Product::with('category')
            ->where('is_active', true)
            ->where('visible_online', true)
            ->where('current_stock', '>', 0)
            ->where('popular', true) // Priorizar produtos populares
            ->whereNotIn('id', $cartIds) // Excluir produtos já no carrinho
            ->orderBy('price', 'asc') // Dentro dos populares, priorizar menor preço
            ->limit($limit)
            ->get();

        // Se não encontrou produtos populares suficientes, buscar produtos da mesma categoria
        if ($suggestions->count() < $limit) {
            $categorySuggestions = Product::with('category')
                ->where('is_active', true)
                ->where('visible_online', true)
                ->where('current_stock', '>', 0)
                ->whereNotIn('id', $cartIds)
                ->whereNotIn('id', $suggestions->pluck('id'))
                ->where(function($query) use ($cartCategories) {
                    // Buscar produtos da mesma categoria
                    if ($cartCategories->isNotEmpty()) {
                        $query->whereIn('category_id', $cartCategories);
                    }
                })
                ->orderBy('price', 'asc')
                ->limit($limit - $suggestions->count())
                ->get();

            $suggestions = $suggestions->merge($categorySuggestions);
        }

        // Se ainda não tem produtos suficientes, buscar produtos de baixo valor
        if ($suggestions->count() < $limit) {
            $lowValueSuggestions = Product::with('category')
                ->where('is_active', true)
                ->where('visible_online', true)
                ->where('current_stock', '>', 0)
                ->whereNotIn('id', $cartIds)
                ->whereNotIn('id', $suggestions->pluck('id'))
                ->where('price', '<=', 50) // Produtos de baixo valor (snacks, drinks, etc.)
                ->orderBy('price', 'asc')
                ->limit($limit - $suggestions->count())
                ->get();

            $suggestions = $suggestions->merge($lowValueSuggestions);
        }

        // Se ainda não tem produtos suficientes, buscar qualquer produto disponível
        if ($suggestions->count() < $limit) {
            $finalSuggestions = Product::with('category')
                ->where('is_active', true)
                ->where('visible_online', true)
                ->where('current_stock', '>', 0)
                ->whereNotIn('id', $cartIds)
                ->whereNotIn('id', $suggestions->pluck('id'))
                ->orderBy('price', 'asc')
                ->limit($limit - $suggestions->count())
                ->get();

            $suggestions = $suggestions->merge($finalSuggestions);
        }

        return response()->json([
            'suggestions' => $suggestions,
            'total' => $suggestions->count()
        ]);
    }
}