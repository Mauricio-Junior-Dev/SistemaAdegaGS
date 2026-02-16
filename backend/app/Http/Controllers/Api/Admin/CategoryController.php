<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Rules\UniqueCategoryNameNormalized;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Category::with(['parent', 'children']);

        // Filtros
        if ($request->has('search') && $request->search) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        if ($request->has('is_active')) {
            $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_active', $isActive);
        }

        // Ordenação
        $sortBy = $request->get('sort_by', 'position');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);
        
        // Se ordenar por position, adicionar name como ordenação secundária
        if ($sortBy === 'position') {
            $query->orderBy('name', 'asc');
        }

        // Paginação
        $perPage = $request->get('per_page', 10);
        $categories = $query->paginate($perPage);

        return response()->json([
            'data' => $categories->items(),
            'total' => $categories->total(),
            'current_page' => $categories->currentPage(),
            'per_page' => $categories->perPage(),
            'last_page' => $categories->lastPage()
        ]);
    }

    public function tree(): JsonResponse
    {
        $categories = Category::whereNull('parent_id')
            ->orderBy('name')
            ->get();

        $tree = $this->buildTree($categories);

        return response()->json($tree);
    }

    private function buildTree($categories, $level = 0): array
    {
        $tree = [];
        
        foreach ($categories as $category) {
            $treeNode = [
                'id' => $category->id,
                'name' => $category->name,
                'level' => $level,
                'expandable' => false // Temporariamente desabilitado
            ];

            $tree[] = $treeNode;
        }

        return $tree;
    }

    public function show(Category $category): JsonResponse
    {
        $category->load(['parent', 'children', 'products']);
        return response()->json($category);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255', new UniqueCategoryNameNormalized()],
            'description' => 'nullable|string',
            'parent_id' => 'nullable|exists:categories,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'is_active' => 'boolean'
        ]);

        $category = new Category();
        $category->name = $request->name;
        $category->slug = Str::slug($request->name);
        $category->description = $request->description;
        $category->parent_id = $request->parent_id;
        $category->is_active = $request->boolean('is_active', true);

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('categories', 'public');
            $category->image_url = Storage::url($path);
        }

        $category->save();

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255', new UniqueCategoryNameNormalized($category->id)],
            'description' => 'nullable|string',
            'parent_id' => 'nullable|exists:categories,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'is_active' => 'boolean'
        ]);

        $category->name = $request->name;
        $category->slug = Str::slug($request->name);
        $category->description = $request->description;
        $category->parent_id = $request->parent_id;
        $category->is_active = $request->boolean('is_active', true);

        if ($request->hasFile('image')) {
            // Deletar imagem anterior se existir
            if ($category->image_url) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $category->image_url));
            }

            $path = $request->file('image')->store('categories', 'public');
            $category->image_url = Storage::url($path);
        }

        $category->save();

        return response()->json($category);
    }

    public function destroy(Category $category): JsonResponse
    {
        // Verificar se a categoria tem produtos
        if ($category->products()->count() > 0) {
            return response()->json(['error' => 'Não é possível excluir categoria com produtos'], 400);
        }

        // Verificar se a categoria tem subcategorias
        if ($category->children()->count() > 0) {
            return response()->json(['error' => 'Não é possível excluir categoria com subcategorias'], 400);
        }

        // Deletar imagem se existir
        if ($category->image_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $category->image_url));
        }

        $category->delete();

        return response()->json(null, 204);
    }

    public function toggleStatus(Category $category): JsonResponse
    {
        $category->is_active = !$category->is_active;
        $category->save();

        return response()->json($category);
    }

    public function uploadImage(Request $request, Category $category): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        // Deletar imagem anterior se existir
        if ($category->image_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $category->image_url));
        }

        $path = $request->file('image')->store('categories', 'public');
        $category->image_url = Storage::url($path);
        $category->save();

        return response()->json($category);
    }

    public function deleteImage(Category $category): JsonResponse
    {
        if ($category->image_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $category->image_url));
            $category->image_url = null;
            $category->save();
        }

        return response()->json($category);
    }

    public function validateSlug(Request $request): JsonResponse
    {
        $request->validate([
            'slug' => 'required|string',
            'exclude_id' => 'nullable|integer'
        ]);

        $query = Category::where('slug', $request->slug);
        
        if ($request->has('exclude_id')) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $exists = $query->exists();

        return response()->json(['valid' => !$exists]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $request->validate([
            'categories' => 'required|array',
            'categories.*.id' => 'required|integer',
            'categories.*.position' => 'required|integer'
        ]);

        foreach ($request->categories as $item) {
            Category::where('id', $item['id'])->update(['position' => $item['position']]);
        }

        return response()->json(null, 204);
    }

    public function move(Request $request, Category $category): JsonResponse
    {
        $request->validate([
            'parent_id' => 'nullable|integer|exists:categories,id'
        ]);

        $category->parent_id = $request->parent_id;
        $category->save();

        return response()->json($category);
    }

    public function stats(Category $category): JsonResponse
    {
        $stats = [
            'products_count' => $category->products()->count(),
            'active_products_count' => $category->products()->where('is_active', true)->count(),
            'total_value' => $category->products()->sum('price'),
            'low_stock_count' => $category->products()
                ->whereColumn('current_stock', '<=', 'min_stock')
                ->count()
        ];

        return response()->json($stats);
    }
}
