<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductBundle;
use App\Models\BundleGroup;
use App\Models\BundleOption;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ComboController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ProductBundle::with(['groups.options.product']);

        // Filtros
        if ($request->has('search') && $request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                  ->orWhere('barcode', 'like', '%' . $request->search . '%');
            });
        }

        if ($request->has('is_active')) {
            $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_active', $isActive);
        }

        if ($request->has('featured') && $request->featured) {
            $query->where('featured', true);
        }

        if ($request->has('offers') && $request->offers) {
            $query->where('offers', true);
        }

        // Ordenação
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // Paginação
        $perPage = $request->get('per_page', 10);
        $bundles = $query->paginate($perPage);

        return response()->json([
            'data' => $bundles->items(),
            'total' => $bundles->total(),
            'current_page' => $bundles->currentPage(),
            'per_page' => $bundles->perPage(),
            'last_page' => $bundles->lastPage()
        ]);
    }

    public function show(ProductBundle $combo): JsonResponse
    {
        $combo->load(['groups.options.product']);
        return response()->json($combo);
    }

    public function store(Request $request): JsonResponse
    {
        // Normalizar dados do FormData (arrays aninhados podem vir como strings)
        $this->normalizeFormData($request);

        // Validação para nova estrutura (base_price e groups)
        $validationRules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'bundle_type' => 'nullable|in:combo,copao,custom',
            'pricing_type' => 'required|in:fixed,calculated',
            'base_price' => 'required_if:pricing_type,fixed|nullable|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'barcode' => 'nullable|string|unique:product_bundles,barcode',
            'is_active' => 'nullable|boolean',
            'featured' => 'nullable|boolean',
            'offers' => 'nullable|boolean',
            'popular' => 'nullable|boolean',
            'groups' => 'required|array|min:1',
            'groups.*.name' => 'required|string|max:255',
            'groups.*.description' => 'nullable|string',
            'groups.*.order' => 'nullable|integer|min:0',
            'groups.*.is_required' => 'nullable|boolean',
            'groups.*.min_selections' => 'required|integer|min:0',
            'groups.*.max_selections' => 'required|integer|min:1',
            'groups.*.selection_type' => 'required|in:single,multiple',
            'groups.*.options' => 'required|array|min:1',
            'groups.*.options.*.product_id' => 'required|integer|exists:products,id',
            'groups.*.options.*.quantity' => 'required|integer|min:1',
            'groups.*.options.*.sale_type' => 'required|in:dose,garrafa',
            'groups.*.options.*.price_adjustment' => 'nullable|numeric',
            'groups.*.options.*.order' => 'nullable|integer|min:0',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:10240'
        ];

        // Compatibilidade: se vier com 'price' e 'products' (estrutura antiga), mapear
        if ($request->has('price') && !$request->has('base_price')) {
            $validationRules['price'] = 'required|numeric|min:0';
            $validationRules['products'] = 'required|array|min:1';
            $validationRules['products.*.product_id'] = 'required|integer|exists:products,id';
            $validationRules['products.*.quantity'] = 'required|integer|min:1';
            $validationRules['products.*.sale_type'] = 'required|in:dose,garrafa';
        }

        $request->validate($validationRules, [
            'images.*.image' => 'O arquivo deve ser uma imagem válida.',
            'images.*.max' => 'A imagem não pode ser maior que 10MB.',
            'images.*.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'images.*.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.',
            'base_price.required_if' => 'O campo base_price é obrigatório quando pricing_type é fixed.',
            'groups.required' => 'É necessário pelo menos um grupo.',
            'groups.*.options.required' => 'Cada grupo deve ter pelo menos uma opção.',
        ]);

        try {
            DB::beginTransaction();

            // Criar o bundle
            $bundle = new ProductBundle();
            $bundle->name = $request->name;
            $bundle->slug = Str::slug($request->name);
            $bundle->description = $request->description;
            $bundle->bundle_type = $request->input('bundle_type', 'combo');
            $bundle->pricing_type = $request->pricing_type;
            
            // Mapear price para base_price se necessário (compatibilidade)
            if ($request->has('price') && !$request->has('base_price')) {
                $bundle->base_price = $request->price;
            } else {
                $bundle->base_price = $request->base_price;
            }
            
            $bundle->original_price = $request->original_price;
            $bundle->discount_percentage = $request->discount_percentage;
            $bundle->barcode = $request->barcode;
            $bundle->is_active = filter_var($request->input('is_active', true), FILTER_VALIDATE_BOOLEAN);
            $bundle->featured = filter_var($request->input('featured', false), FILTER_VALIDATE_BOOLEAN);
            $bundle->offers = filter_var($request->input('offers', false), FILTER_VALIDATE_BOOLEAN);
            $bundle->popular = filter_var($request->input('popular', false), FILTER_VALIDATE_BOOLEAN);

            // Processar imagens
            if ($request->hasFile('images')) {
                $images = [];
                foreach ($request->file('images') as $image) {
                    $originalName = pathinfo($image->getClientOriginalName(), PATHINFO_FILENAME);
                    $extension = $image->getClientOriginalExtension();
                    $safeName = Str::slug($originalName) . '-' . time() . '-' . uniqid() . '.' . $extension;
                    $path = $image->storeAs('combos', $safeName, 'public');
                    $images[] = Storage::url($path);
                }
                $bundle->images = $images;
            }

            $bundle->save();

            // Processar grupos e opções
            $groupsData = $request->input('groups', []);
            
            // Se vier com estrutura antiga (products), converter para grupos
            if (empty($groupsData) && $request->has('products')) {
                $groupsData = [
                    [
                        'name' => 'Produtos do Combo',
                        'description' => '',
                        'order' => 0,
                        'is_required' => true,
                        'min_selections' => 1,
                        'max_selections' => count($request->products),
                        'selection_type' => 'multiple',
                        'options' => array_map(function($product) {
                            return [
                                'product_id' => $product['product_id'],
                                'quantity' => $product['quantity'],
                                'sale_type' => $product['sale_type'],
                                'price_adjustment' => 0,
                                'order' => 0
                            ];
                        }, $request->products)
                    ]
                ];
            }

            // Criar grupos e opções
            foreach ($groupsData as $groupIndex => $groupData) {
                // Validar dados do grupo
                if (empty($groupData['name']) || !isset($groupData['options']) || !is_array($groupData['options']) || empty($groupData['options'])) {
                    continue; // Pular grupos inválidos
                }

                $group = new BundleGroup();
                $group->bundle_id = $bundle->id;
                $group->name = $groupData['name'];
                $group->description = $groupData['description'] ?? null;
                $group->order = isset($groupData['order']) ? (int)$groupData['order'] : $groupIndex;
                $group->is_required = filter_var($groupData['is_required'] ?? true, FILTER_VALIDATE_BOOLEAN);
                $group->min_selections = isset($groupData['min_selections']) ? (int)$groupData['min_selections'] : 1;
                $group->max_selections = isset($groupData['max_selections']) ? (int)$groupData['max_selections'] : 1;
                $group->selection_type = $groupData['selection_type'] ?? 'single';
                
                if (!$group->save()) {
                    throw new \Exception("Erro ao salvar grupo: {$groupData['name']}");
                }

                // Criar opções do grupo
                foreach ($groupData['options'] as $optionIndex => $optionData) {
                    // Validar dados da opção
                    if (empty($optionData['product_id'])) {
                        continue; // Pular opções inválidas
                    }

                    $option = new BundleOption();
                    $option->group_id = $group->id;
                    $option->product_id = (int)$optionData['product_id'];
                    $option->quantity = isset($optionData['quantity']) ? (int)$optionData['quantity'] : 1;
                    $option->sale_type = $optionData['sale_type'] ?? 'garrafa';
                    $option->price_adjustment = isset($optionData['price_adjustment']) ? (float)$optionData['price_adjustment'] : 0;
                    $option->order = isset($optionData['order']) ? (int)$optionData['order'] : $optionIndex;
                    
                    if (!$option->save()) {
                        throw new \Exception("Erro ao salvar opção do grupo: {$group->name}");
                    }
                }
            }

            DB::commit();

            return response()->json($bundle->load(['groups.options.product']), 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Erro ao criar bundle:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Erro ao criar bundle',
                'message' => $e->getMessage()
            ], 422);
        }
    }

    public function update(Request $request, ProductBundle $combo): JsonResponse
    {
        // Normalizar dados do FormData (arrays aninhados podem vir como strings)
        $this->normalizeFormData($request);
        
        // Validação para nova estrutura (base_price e groups)
        $validationRules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'bundle_type' => 'nullable|in:combo,copao,custom',
            'pricing_type' => 'required|in:fixed,calculated',
            'base_price' => 'required_if:pricing_type,fixed|nullable|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'barcode' => 'nullable|string|unique:product_bundles,barcode,' . $combo->id,
            'is_active' => 'nullable|boolean',
            'featured' => 'nullable|boolean',
            'offers' => 'nullable|boolean',
            'popular' => 'nullable|boolean',
            'groups' => 'required|array|min:1',
            'groups.*.name' => 'required|string|max:255',
            'groups.*.description' => 'nullable|string',
            'groups.*.order' => 'nullable|integer|min:0',
            'groups.*.is_required' => 'nullable|boolean',
            'groups.*.min_selections' => 'required|integer|min:0',
            'groups.*.max_selections' => 'required|integer|min:1',
            'groups.*.selection_type' => 'required|in:single,multiple',
            'groups.*.options' => 'required|array|min:1',
            'groups.*.options.*.product_id' => 'required|integer|exists:products,id',
            'groups.*.options.*.quantity' => 'required|integer|min:1',
            'groups.*.options.*.sale_type' => 'required|in:dose,garrafa',
            'groups.*.options.*.price_adjustment' => 'nullable|numeric',
            'groups.*.options.*.order' => 'nullable|integer|min:0',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:10240'
        ];

        // Compatibilidade: se vier com 'price' e 'products' (estrutura antiga), mapear
        if ($request->has('price') && !$request->has('base_price')) {
            $validationRules['price'] = 'required|numeric|min:0';
            $validationRules['products'] = 'required|array|min:1';
            $validationRules['products.*.product_id'] = 'required|integer|exists:products,id';
            $validationRules['products.*.quantity'] = 'required|integer|min:1';
            $validationRules['products.*.sale_type'] = 'required|in:dose,garrafa';
        }

        $request->validate($validationRules, [
            'images.*.image' => 'O arquivo deve ser uma imagem válida.',
            'images.*.max' => 'A imagem não pode ser maior que 10MB.',
            'images.*.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'images.*.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.',
            'base_price.required_if' => 'O campo base_price é obrigatório quando pricing_type é fixed.',
            'groups.required' => 'É necessário pelo menos um grupo.',
            'groups.*.options.required' => 'Cada grupo deve ter pelo menos uma opção.',
        ]);

        try {
            DB::beginTransaction();

            // Atualizar o bundle
            $combo->name = $request->name;
            $combo->slug = Str::slug($request->name);
            $combo->description = $request->description;
            $combo->bundle_type = $request->input('bundle_type', 'combo');
            $combo->pricing_type = $request->pricing_type;
            
            // Mapear price para base_price se necessário (compatibilidade)
            if ($request->has('price') && !$request->has('base_price')) {
                $combo->base_price = $request->price;
            } else {
                $combo->base_price = $request->base_price;
            }
            
            $combo->original_price = $request->original_price;
            $combo->discount_percentage = $request->discount_percentage;
            $combo->barcode = $request->barcode;
            $combo->is_active = filter_var($request->input('is_active', true), FILTER_VALIDATE_BOOLEAN);
            $combo->featured = filter_var($request->input('featured', false), FILTER_VALIDATE_BOOLEAN);
            $combo->offers = filter_var($request->input('offers', false), FILTER_VALIDATE_BOOLEAN);
            $combo->popular = filter_var($request->input('popular', false), FILTER_VALIDATE_BOOLEAN);

            // Processar imagens
            if ($request->hasFile('images')) {
                // Deletar imagens anteriores
                if ($combo->images) {
                    foreach ($combo->images as $imageUrl) {
                        $path = str_replace('/storage/', '', $imageUrl);
                        Storage::disk('public')->delete($path);
                    }
                }

                $images = [];
                foreach ($request->file('images') as $image) {
                    $originalName = pathinfo($image->getClientOriginalName(), PATHINFO_FILENAME);
                    $extension = $image->getClientOriginalExtension();
                    $safeName = Str::slug($originalName) . '-' . time() . '-' . uniqid() . '.' . $extension;
                    $path = $image->storeAs('combos', $safeName, 'public');
                    $images[] = Storage::url($path);
                }
                $combo->images = $images;
            }

            $combo->save();

            // Remover grupos e opções antigas
            $combo->groups()->each(function($group) {
                $group->options()->delete();
            });
            $combo->groups()->delete();

            // Processar grupos e opções
            $groupsData = $request->input('groups', []);
            
            // Se vier com estrutura antiga (products), converter para grupos
            if (empty($groupsData) && $request->has('products')) {
                $groupsData = [
                    [
                        'name' => 'Produtos do Combo',
                        'description' => '',
                        'order' => 0,
                        'is_required' => true,
                        'min_selections' => 1,
                        'max_selections' => count($request->products),
                        'selection_type' => 'multiple',
                        'options' => array_map(function($product) {
                            return [
                                'product_id' => $product['product_id'],
                                'quantity' => $product['quantity'],
                                'sale_type' => $product['sale_type'],
                                'price_adjustment' => 0,
                                'order' => 0
                            ];
                        }, $request->products)
                    ]
                ];
            }

            // Criar novos grupos e opções
            foreach ($groupsData as $groupIndex => $groupData) {
                // Validar dados do grupo
                if (empty($groupData['name']) || !isset($groupData['options']) || !is_array($groupData['options']) || empty($groupData['options'])) {
                    continue; // Pular grupos inválidos
                }

                $group = new BundleGroup();
                $group->bundle_id = $combo->id;
                $group->name = $groupData['name'];
                $group->description = $groupData['description'] ?? null;
                $group->order = isset($groupData['order']) ? (int)$groupData['order'] : $groupIndex;
                $group->is_required = filter_var($groupData['is_required'] ?? true, FILTER_VALIDATE_BOOLEAN);
                $group->min_selections = isset($groupData['min_selections']) ? (int)$groupData['min_selections'] : 1;
                $group->max_selections = isset($groupData['max_selections']) ? (int)$groupData['max_selections'] : 1;
                $group->selection_type = $groupData['selection_type'] ?? 'single';
                
                if (!$group->save()) {
                    throw new \Exception("Erro ao salvar grupo: {$groupData['name']}");
                }

                // Criar opções do grupo
                foreach ($groupData['options'] as $optionIndex => $optionData) {
                    // Validar dados da opção
                    if (empty($optionData['product_id'])) {
                        continue; // Pular opções inválidas
                    }

                    $option = new BundleOption();
                    $option->group_id = $group->id;
                    $option->product_id = (int)$optionData['product_id'];
                    $option->quantity = isset($optionData['quantity']) ? (int)$optionData['quantity'] : 1;
                    $option->sale_type = $optionData['sale_type'] ?? 'garrafa';
                    $option->price_adjustment = isset($optionData['price_adjustment']) ? (float)$optionData['price_adjustment'] : 0;
                    $option->order = isset($optionData['order']) ? (int)$optionData['order'] : $optionIndex;
                    
                    if (!$option->save()) {
                        throw new \Exception("Erro ao salvar opção do grupo: {$group->name}");
                    }
                }
            }

            DB::commit();

            return response()->json($combo->load(['groups.options.product']));

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Erro ao atualizar bundle:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Erro ao atualizar bundle',
                'message' => $e->getMessage()
            ], 422);
        }
    }

    public function destroy(ProductBundle $combo): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Deletar imagens se existirem
            if ($combo->images) {
                foreach ($combo->images as $imageUrl) {
                    $path = str_replace('/storage/', '', $imageUrl);
                    Storage::disk('public')->delete($path);
                }
            }

            // Remover grupos e opções (cascade)
            $combo->groups()->each(function($group) {
                $group->options()->delete();
            });
            $combo->groups()->delete();

            $combo->delete();

            DB::commit();

            return response()->json(null, 204);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function toggleStatus(ProductBundle $combo): JsonResponse
    {
        $combo->is_active = !$combo->is_active;
        $combo->save();

        return response()->json($combo);
    }

    public function uploadImage(Request $request, ProductBundle $combo): JsonResponse
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

        $file = $request->file('image');
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $extension = $file->getClientOriginalExtension();
        
        // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
        $safeName = Str::slug($originalName) . '-' . time() . '.' . $extension;
        
        // Salva com o nome seguro
        $path = $file->storeAs('combos', $safeName, 'public');
        $imageUrl = Storage::url($path);

        $images = $combo->images ?? [];
        $images[] = $imageUrl;
        $combo->images = $images;
        $combo->save();

        return response()->json($combo);
    }

    public function deleteImage(Request $request, ProductBundle $combo): JsonResponse
    {
        $request->validate([
            'image_url' => 'required|string'
        ]);

        $images = $combo->images ?? [];
        $imageUrl = $request->image_url;

        // Remover da lista de imagens
        $images = array_filter($images, function($img) use ($imageUrl) {
            return $img !== $imageUrl;
        });

        // Deletar arquivo físico
        $path = str_replace('/storage/', '', $imageUrl);
        Storage::disk('public')->delete($path);

        $combo->images = array_values($images);
        $combo->save();

        return response()->json($combo);
    }

    public function validateBarcode(Request $request): JsonResponse
    {
        $request->validate([
            'barcode' => 'required|string'
        ]);

        $exists = ProductBundle::where('barcode', $request->barcode)->exists();
        return response()->json(['available' => !$exists]);
    }

    public function getProducts(): JsonResponse
    {
        $products = Product::where('is_active', true)
            ->select('id', 'name', 'price', 'current_stock')
            ->get();

        return response()->json($products);
    }

    public function calculatePrice(Request $request): JsonResponse
    {
        $request->validate([
            'products' => 'required|array',
            'products.*.product_id' => 'required|string',
            'products.*.quantity' => 'required|string',
            'products.*.sale_type' => 'required|string',
            'discount_percentage' => 'nullable|numeric|min:0|max:100'
        ]);

        $totalPrice = 0;
        $products = [];

        foreach ($request->products as $productData) {
            $product = Product::find($productData['product_id']);
            $price = $productData['sale_type'] === 'dose' ? $product->dose_price : $product->price;
            $subtotal = $price * $productData['quantity'];
            
            $products[] = [
                'product' => $product,
                'quantity' => $productData['quantity'],
                'sale_type' => $productData['sale_type'],
                'unit_price' => $price,
                'subtotal' => $subtotal
            ];
            
            $totalPrice += $subtotal;
        }

        $discountPercentage = $request->discount_percentage ?? 0;
        $discountAmount = ($totalPrice * $discountPercentage) / 100;
        $finalPrice = $totalPrice - $discountAmount;

        return response()->json([
            'products' => $products,
            'total_original_price' => $totalPrice,
            'discount_percentage' => $discountPercentage,
            'discount_amount' => $discountAmount,
            'final_price' => $finalPrice
        ]);
    }

    public function publicIndex(Request $request): JsonResponse
    {
        $query = ProductBundle::with(['groups.options.product'])
            ->where('is_active', true);

        // Filtros
        if ($request->has('featured') && $request->featured) {
            $query->where('featured', true);
        }

        if ($request->has('offers') && $request->offers) {
            $query->where('offers', true);
        }

        if ($request->has('search') && $request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                  ->orWhere('description', 'like', '%' . $request->search . '%');
            });
        }

        // Ordenação
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // Paginação
        $perPage = $request->get('per_page', 12);
        $bundles = $query->paginate($perPage);

        return response()->json([
            'data' => $bundles->items(),
            'total' => $bundles->total(),
            'current_page' => $bundles->currentPage(),
            'per_page' => $bundles->perPage(),
            'last_page' => $bundles->lastPage()
        ]);
    }

    public function publicShow(ProductBundle $combo): JsonResponse
    {
        if (!$combo->is_active) {
            return response()->json(['error' => 'Bundle não encontrado'], 404);
        }

        $combo->load(['groups.options.product']);
        return response()->json($combo);
    }

    /**
     * Normaliza dados do FormData para garantir que arrays aninhados sejam processados corretamente
     */
    private function normalizeFormData(Request $request): void
    {
        // Se groups vier como string JSON, decodificar
        if ($request->has('groups') && is_string($request->input('groups'))) {
            $groups = json_decode($request->input('groups'), true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($groups)) {
                $request->merge(['groups' => $groups]);
            }
        }

        // Garantir que groups seja um array
        if ($request->has('groups') && !is_array($request->input('groups'))) {
            $request->merge(['groups' => []]);
        }

        // Normalizar cada grupo e suas opções
        if ($request->has('groups') && is_array($request->input('groups'))) {
            $groups = $request->input('groups');
            $normalizedGroups = [];
            
            foreach ($groups as $index => $group) {
                // Se o grupo não for um array, pular
                if (!is_array($group)) {
                    continue;
                }
                
                $normalizedGroup = [
                    'name' => $group['name'] ?? '',
                    'description' => $group['description'] ?? null,
                    'order' => isset($group['order']) ? (int)$group['order'] : $index,
                    'is_required' => isset($group['is_required']) ? filter_var($group['is_required'], FILTER_VALIDATE_BOOLEAN) : true,
                    'min_selections' => isset($group['min_selections']) ? (int)$group['min_selections'] : 1,
                    'max_selections' => isset($group['max_selections']) ? (int)$group['max_selections'] : 1,
                    'selection_type' => $group['selection_type'] ?? 'single',
                    'options' => []
                ];
                
                // Processar opções do grupo
                if (isset($group['options'])) {
                    // Se options vier como string JSON, decodificar
                    if (is_string($group['options'])) {
                        $options = json_decode($group['options'], true);
                        if (json_last_error() === JSON_ERROR_NONE && is_array($options)) {
                            $normalizedGroup['options'] = $options;
                        }
                    } elseif (is_array($group['options'])) {
                        // Normalizar cada opção
                        foreach ($group['options'] as $optIndex => $option) {
                            if (!is_array($option)) {
                                continue;
                            }
                            
                            $normalizedOption = [
                                'product_id' => isset($option['product_id']) ? (int)$option['product_id'] : null,
                                'quantity' => isset($option['quantity']) ? (int)$option['quantity'] : 1,
                                'sale_type' => $option['sale_type'] ?? 'garrafa',
                                'price_adjustment' => isset($option['price_adjustment']) ? (float)$option['price_adjustment'] : 0,
                                'order' => isset($option['order']) ? (int)$option['order'] : $optIndex
                            ];
                            
                            // Só adicionar se tiver product_id válido
                            if ($normalizedOption['product_id'] > 0) {
                                $normalizedGroup['options'][] = $normalizedOption;
                            }
                        }
                    }
                }
                
                // Só adicionar grupo se tiver nome e pelo menos uma opção
                if (!empty($normalizedGroup['name']) && !empty($normalizedGroup['options'])) {
                    $normalizedGroups[] = $normalizedGroup;
                }
            }
            
            $request->merge(['groups' => $normalizedGroups]);
        }
    }
}