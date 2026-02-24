<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->input('busca') ?? $request->input('search');

        // Carregar categoria mesmo que esteja inativa (PDV precisa ver todos os produtos)
        // Usar with sem constraints para garantir que a categoria seja sempre carregada
        $query = Product::with(['category' => function ($q) {
            // Sem filtros: carrega categoria mesmo se inativa (PDV precisa ver tudo)
        }])
            ->where('is_active', true)
            // Excluir packs (produtos com parent_product_id) - não devem aparecer em seleções
            ->whereNull('parent_product_id');

        $query->when($search, function ($q) use ($search) {
            $q->where(function($sub) use ($search) {
                $sub->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        });

        $query->when($request->input('category_id'), function ($q) use ($request) {
            $q->where('category_id', $request->input('category_id'));
        });

        $query->when(filter_var($request->input('featured'), FILTER_VALIDATE_BOOLEAN), function ($q) {
            $q->where('featured', true);
        });

        $query->when(filter_var($request->input('popular'), FILTER_VALIDATE_BOOLEAN), function ($q) {
            $q->inRandomOrder();
        });

        if (!$request->has('popular') && !$search) {
            $query->latest();
        }

        return response()->json($query->paginate($request->input('per_page', 12)));
    }

    public function show($id)
    {
        $product = Product::with(['category', 'parentProduct:id,current_stock'])
            ->where('is_active', true)
            ->findOrFail($id);

        return response()->json($product);
    }

    /**
     * Sugestões de Compra por Impulso (Upsell) no Checkout.
     * Retorna produtos destacados para exibir como "Não esqueceu de nada?".
     */
    public function suggestions(Request $request): JsonResponse
    {
        $limit = (int) $request->input('limit', 6);
        $limit = min(max($limit, 1), 24);

        $cartIds = $request->input('cart_ids', []);
        if (!is_array($cartIds)) {
            $cartIds = array_filter(array_map('intval', (array) $cartIds));
        } else {
            $cartIds = array_filter(array_map('intval', $cartIds));
        }

        $baseQuery = function () use ($cartIds) {
            $q = Product::with(['category'])
                ->where('is_active', true)
                ->whereNull('parent_product_id');
            if (!empty($cartIds)) {
                $q->whereNotIn('id', $cartIds);
            }
            return $q;
        };

        $excludeIds = $cartIds;
        $suggestions = collect();

        // 1) Prioridade: featured = true (Sugestão de Checkout)
        $featured = $baseQuery()->where('featured', true)->inRandomOrder()->limit($limit)->get();
        $suggestions = $suggestions->merge($featured);
        $excludeIds = array_merge($excludeIds, $suggestions->pluck('id')->toArray());

        if ($suggestions->count() < $limit) {
            $need = $limit - $suggestions->count();
            $extra = Product::with(['category'])
                ->where('is_active', true)
                ->whereNull('parent_product_id')
                ->whereNotIn('id', $excludeIds)
                ->where('offers', true)
                ->inRandomOrder()
                ->limit($need)
                ->get();
            $suggestions = $suggestions->merge($extra);
            $excludeIds = array_merge($excludeIds, $extra->pluck('id')->toArray());
        }

        if ($suggestions->count() < $limit) {
            $need = $limit - $suggestions->count();
            $extra = Product::with(['category'])
                ->where('is_active', true)
                ->whereNull('parent_product_id')
                ->whereNotIn('id', $excludeIds)
                ->orderBy('price')
                ->limit($need)
                ->get();
            $suggestions = $suggestions->merge($extra);
        }

        $suggestions = $suggestions->take($limit)->values();

        return response()->json([
            'suggestions' => $suggestions,
            'total' => $suggestions->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0|gt:price',
            'cost_price' => 'nullable|numeric|min:0',
            'current_stock' => 'required|integer|min:0',
            'min_stock' => 'required|integer|min:0',
            'doses_por_garrafa' => 'required|integer|min:1',
            'can_sell_by_dose' => 'boolean',
            'dose_price' => 'nullable|numeric|min:0',
            'barcode' => 'nullable|string|unique:products,barcode',
            'category_id' => 'required|exists:categories,id',
            'parent_product_id' => 'nullable|exists:products,id',
            'stock_multiplier' => 'nullable|integer|min:1',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:10240',
            'is_active' => 'boolean',
            'featured' => 'boolean',
            'offers' => 'boolean',
            'popular' => 'boolean'
        ], [
            'image.image' => 'O arquivo deve ser uma imagem válida.',
            'image.max' => 'A imagem não pode ser maior que 10MB.',
            'image.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'image.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.',
            'original_price.gt' => 'O preço original deve ser maior que o preço de venda.'
        ]);

        // Gerar slug a partir do nome
        $baseSlug = Str::slug($request->name);
        $slug = $baseSlug;
        $counter = 1;
        
        // Garantir unicidade do slug
        while (Product::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        // Validação adicional: se parent_product_id está presente, stock_multiplier deve ser > 1
        if ($request->has('parent_product_id') && $request->parent_product_id) {
            if (!$request->has('stock_multiplier') || $request->stock_multiplier < 2) {
                return response()->json([
                    'error' => 'Para produtos Pack, o multiplicador de estoque deve ser maior que 1'
                ], 422);
            }
            // Para Packs, garantir que current_stock seja 0 (estoque é gerenciado pelo produto pai)
            $request->merge(['current_stock' => 0]);
        }

        $product = new Product();
        $product->name = $request->name;
        $product->slug = $slug;
        $product->description = $request->description;
        $product->price = $request->price;
        $product->delivery_price = $request->input('delivery_price') ?: null;
        $product->original_price = $request->input('original_price') ?: null;
        $product->cost_price = $request->input('cost_price', 0);
        $product->current_stock = $request->current_stock;
        $product->min_stock = $request->min_stock;
        $product->doses_por_garrafa = $request->doses_por_garrafa;
        $product->can_sell_by_dose = $request->boolean('can_sell_by_dose', false);
        $product->dose_price = $request->dose_price;
        $product->barcode = $request->barcode;
        $product->category_id = $request->category_id;
        $product->parent_product_id = $request->parent_product_id;
        $product->stock_multiplier = $request->input('stock_multiplier', 1);
        $product->is_active = $request->boolean('is_active', true);
        $product->visible_online = $request->boolean('visible_online', true);
        $product->featured = $request->boolean('featured', false);
        $product->offers = $request->boolean('offers', false);
        $product->popular = $request->boolean('popular', false);

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            $extension = $file->getClientOriginalExtension();
            
            // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
            $safeName = Str::slug($originalName) . '-' . time() . '.' . $extension;
            
            // Salva com o nome seguro
            $path = $file->storeAs('products', $safeName, 'public');
            $product->image_url = Storage::disk('public')->url($path);
        }

        if ($product->isPack()) {
            $product->current_stock = 0;
        }

        $product->save();

        if (!$product->isPack()) {
            $product->stockMovements()->create([
                'user_id' => auth()->id(),
                'type' => 'entrada',
                'quantity' => $request->current_stock,
                'description' => 'Estoque inicial'
            ]);
        }

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        \Log::info('Product Update Request:', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'all_data' => $request->all(),
            'has_name' => $request->has('name'),
            'name_value' => $request->input('name'),
            'content_type' => $request->header('Content-Type'),
            'files' => $request->allFiles()
        ]);

        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0',
            'delivery_price' => 'nullable|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0|gt:price',
            'cost_price' => 'nullable|numeric|min:0',
            'current_stock' => 'required|integer|min:0',
            'min_stock' => 'required|integer|min:0',
            'doses_por_garrafa' => 'required|integer|min:1',
            'can_sell_by_dose' => 'boolean',
            'dose_price' => 'nullable|numeric|min:0',
            'barcode' => 'nullable|string|unique:products,barcode,' . $product->id,
            'category_id' => 'required|exists:categories,id',
            'parent_product_id' => 'nullable|exists:products,id',
            'stock_multiplier' => 'nullable|integer|min:1',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:10240',
            'is_active' => 'boolean',
            'visible_online' => 'boolean',
            'featured' => 'boolean',
            'offers' => 'boolean',
            'popular' => 'boolean'
        ], [
            'image.image' => 'O arquivo deve ser uma imagem válida.',
            'image.max' => 'A imagem não pode ser maior que 10MB.',
            'image.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'image.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.',
            'original_price.gt' => 'O preço original deve ser maior que o preço de venda.'
        ]);

        $oldStock = $product->current_stock;
        $newStock = $request->current_stock;

        // Atualizar slug se o nome mudou
        if ($product->name !== $request->name) {
            $baseSlug = Str::slug($request->name);
            $slug = $baseSlug;
            $counter = 1;
            
            // Garantir unicidade do slug (excluindo o produto atual)
            while (Product::where('slug', $slug)->where('id', '!=', $product->id)->exists()) {
                $slug = $baseSlug . '-' . $counter;
                $counter++;
            }
            $product->slug = $slug;
        }

        // Validação adicional: se parent_product_id está presente, stock_multiplier deve ser > 1
        if ($request->has('parent_product_id') && $request->parent_product_id) {
            if (!$request->has('stock_multiplier') || $request->stock_multiplier < 2) {
                return response()->json([
                    'error' => 'Para produtos Pack, o multiplicador de estoque deve ser maior que 1'
                ], 422);
            }
        }

        $product->name = $request->name;
        $product->description = $request->description;
        $product->price = $request->price;
        $product->delivery_price = $request->input('delivery_price') ?: null;
        $product->original_price = $request->input('original_price') ?: null;
        $product->cost_price = $request->input('cost_price', $product->cost_price ?? 0);
        $product->current_stock = $newStock;
        $product->min_stock = $request->min_stock;
        $product->doses_por_garrafa = $request->doses_por_garrafa;
        $product->can_sell_by_dose = $request->boolean('can_sell_by_dose', false);
        $product->dose_price = $request->dose_price;
        $product->barcode = $request->barcode;
        $product->category_id = $request->category_id;
        $product->parent_product_id = $request->parent_product_id;
        $product->stock_multiplier = $request->input('stock_multiplier', $product->stock_multiplier ?? 1);
        $product->is_active = $request->boolean('is_active', true);
        $product->visible_online = $request->boolean('visible_online', true);
        $product->featured = $request->boolean('featured', false);
        $product->offers = $request->boolean('offers', false);
        $product->popular = $request->boolean('popular', false);

        if ($request->hasFile('image')) {
            // Deletar imagem anterior se existir
            if ($product->image_url) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $product->image_url));
            }

            $file = $request->file('image');
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            $extension = $file->getClientOriginalExtension();
            
            // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
            $safeName = Str::slug($originalName) . '-' . time() . '.' . $extension;
            
            // Salva com o nome seguro
            $path = $file->storeAs('products', $safeName, 'public');
            $product->image_url = Storage::disk('public')->url($path);
        }

        if ($product->isPack()) {
            $parentProduct = $product->getParentProduct();
            if (!$parentProduct) {
                return response()->json([
                    'error' => 'Produto pai não encontrado para o Pack'
                ], 400);
            }

            if ($oldStock != $newStock) {
                $difference = $newStock - $oldStock;
                $unidadesPai = abs($difference) * $product->stock_multiplier;
                $type = $difference > 0 ? 'entrada' : 'saida';

                if ($type === 'entrada') {
                    $parentProduct->increment('current_stock', $unidadesPai);
                } else {
                    if ($parentProduct->current_stock < $unidadesPai) {
                        return response()->json([
                            'error' => "Estoque insuficiente no produto pai. Tentativa de remover {$unidadesPai} unidades, mas há apenas {$parentProduct->current_stock} disponíveis."
                        ], 400);
                    }
                    $parentProduct->decrement('current_stock', $unidadesPai);
                }
                $parentProduct->save();

                $parentProduct->stockMovements()->create([
                    'type' => $type,
                    'quantity' => $unidadesPai,
                    'description' => "Ajuste de estoque Pack ({$product->name}): {$difference} pack(s) x {$product->stock_multiplier} = {$unidadesPai} unidades",
                    'user_id' => auth()->id()
                ]);
            }

            $product->current_stock = 0;
        }

        $product->save();

        if (!$product->isPack() && $oldStock != $newStock) {
            $difference = $newStock - $oldStock;
            $type = $difference > 0 ? 'entrada' : 'saida';
            $description = $difference > 0 ? 'Ajuste de estoque (entrada)' : 'Ajuste de estoque (saída)';

            $product->stockMovements()->create([
                'type' => $type,
                'quantity' => abs($difference),
                'description' => $description,
                'user_id' => auth()->id()
            ]);
        }

        return response()->json($product);
    }

    public function destroy(Product $product): JsonResponse
    {
        // Verificar se o produto tem pedidos
        if ($product->orderItems()->count() > 0) {
            return response()->json(['error' => 'Não é possível excluir produto com pedidos'], 400);
        }

        // Deletar imagem se existir
        if ($product->image_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $product->image_url));
        }

        // Deletar movimentos de estoque
        $product->stockMovements()->delete();

        $product->delete();

        return response()->json(null, 204);
    }

    public function toggleStatus(Product $product): JsonResponse
    {
        $product->is_active = !$product->is_active;
        $product->save();

        return response()->json($product);
    }

    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:10240'
        ], [
            'image.required' => 'Por favor, selecione uma imagem.',
            'image.image' => 'O arquivo deve ser uma imagem válida.',
            'image.max' => 'A imagem não pode ser maior que 10MB.',
            'image.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'image.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.'
        ]);

        // Deletar imagem anterior se existir
        if ($product->image_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $product->image_url));
        }

        $file = $request->file('image');
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $extension = $file->getClientOriginalExtension();
        
        // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
        $safeName = Str::slug($originalName) . '-' . time() . '.' . $extension;
        
        // Salva com o nome seguro
        $path = $file->storeAs('products', $safeName, 'public');
        $product->image_url = Storage::disk('public')->url($path);
        $product->save();

        return response()->json($product);
    }

    public function deleteImage(Product $product): JsonResponse
    {
        if ($product->image_url) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $product->image_url));
            $product->image_url = null;
            $product->save();
        }

        return response()->json($product);
    }

    public function validateBarcode(Request $request): JsonResponse
    {
        $request->validate([
            'barcode' => 'required|string',
            'exclude_id' => 'nullable|integer'
        ]);

        $query = Product::where('barcode', $request->barcode);
        
        if ($request->has('exclude_id')) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $exists = $query->exists();

        return response()->json(['valid' => !$exists]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,xlsx,xls'
        ]);

        return response()->json([
            'imported' => 0,
            'errors' => ['Funcionalidade de importação será implementada']
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        $request->validate([
            'format' => 'required|in:csv,xlsx'
        ]);

        return response()->json(['error' => 'Funcionalidade de exportação será implementada'], 501);
    }
}
