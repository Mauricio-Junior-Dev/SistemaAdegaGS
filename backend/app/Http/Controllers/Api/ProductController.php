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
            ->where('is_active', true);

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
            ->findOrFail($id);
        return response()->json($product);
    }
}