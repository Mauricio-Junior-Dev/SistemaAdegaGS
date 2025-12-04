<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Combo;
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
        $query = Combo::with(['products']);

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
        $combos = $query->paginate($perPage);

        return response()->json([
            'data' => $combos->items(),
            'total' => $combos->total(),
            'current_page' => $combos->currentPage(),
            'per_page' => $combos->perPage(),
            'last_page' => $combos->lastPage()
        ]);
    }

    public function show(Combo $combo): JsonResponse
    {
        $combo->load(['products']);
        return response()->json($combo);
    }

    public function store(Request $request): JsonResponse
    {
        // Debug: log dos dados recebidos
        \Log::info('Dados recebidos para criar combo:', $request->all());
        \Log::info('Produtos recebidos:', $request->input('products', []));

        $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'barcode' => 'nullable|string|unique:combos,barcode',
            'is_active' => 'nullable|boolean',
            'featured' => 'nullable|boolean',
            'offers' => 'nullable|boolean',
            'popular' => 'nullable|boolean',
            'products' => 'required|array',
            'products.*.product_id' => 'required|integer|exists:products,id',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.sale_type' => 'required|in:dose,garrafa',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:10240'
        ], [
            'images.*.image' => 'O arquivo deve ser uma imagem válida.',
            'images.*.max' => 'A imagem não pode ser maior que 10MB.',
            'images.*.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'images.*.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.'
        ]);

        try {
            DB::beginTransaction();

            $combo = new Combo();
            $combo->name = $request->name;
            $combo->slug = Str::slug($request->name);
            $combo->description = $request->description;
            $combo->price = $request->price;
            $combo->original_price = $request->original_price;
            $combo->discount_percentage = $request->discount_percentage;
            $combo->barcode = $request->barcode;
            // Converter '1'/'0' para boolean quando vem via FormData
            $combo->is_active = filter_var($request->input('is_active', true), FILTER_VALIDATE_BOOLEAN);
            $combo->featured = filter_var($request->input('featured', false), FILTER_VALIDATE_BOOLEAN);
            $combo->offers = filter_var($request->input('offers', false), FILTER_VALIDATE_BOOLEAN);
            $combo->popular = filter_var($request->input('popular', false), FILTER_VALIDATE_BOOLEAN);

            // Processar imagens
            if ($request->hasFile('images')) {
                $images = [];
                foreach ($request->file('images') as $image) {
                    $originalName = pathinfo($image->getClientOriginalName(), PATHINFO_FILENAME);
                    $extension = $image->getClientOriginalExtension();
                    
                    // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
                    $safeName = Str::slug($originalName) . '-' . time() . '-' . uniqid() . '.' . $extension;
                    
                    // Salva com o nome seguro
                    $path = $image->storeAs('combos', $safeName, 'public');
                    $images[] = Storage::url($path);
                }
                $combo->images = $images;
            }

            $combo->save();

            // Adicionar produtos ao combo
            foreach ($request->products as $productData) {
                $combo->products()->attach($productData['product_id'], [
                    'quantity' => $productData['quantity'],
                    'sale_type' => $productData['sale_type']
                ]);
            }

            DB::commit();

            return response()->json($combo->load(['products']), 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function update(Request $request, Combo $combo): JsonResponse
    {
        $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'barcode' => 'nullable|string|unique:combos,barcode,' . $combo->id,
            'is_active' => 'nullable|boolean',
            'featured' => 'nullable|boolean',
            'offers' => 'nullable|boolean',
            'popular' => 'nullable|boolean',
            'products' => 'required|array',
            'products.*.product_id' => 'required|integer|exists:products,id',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.sale_type' => 'required|in:dose,garrafa',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:10240'
        ], [
            'images.*.image' => 'O arquivo deve ser uma imagem válida.',
            'images.*.max' => 'A imagem não pode ser maior que 10MB.',
            'images.*.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'images.*.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.'
        ]);

        try {
            DB::beginTransaction();

            $combo->name = $request->name;
            $combo->slug = Str::slug($request->name);
            $combo->description = $request->description;
            $combo->price = $request->price;
            $combo->original_price = $request->original_price;
            $combo->discount_percentage = $request->discount_percentage;
            $combo->barcode = $request->barcode;
            // Converter '1'/'0' para boolean quando vem via FormData
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
                    
                    // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
                    $safeName = Str::slug($originalName) . '-' . time() . '-' . uniqid() . '.' . $extension;
                    
                    // Salva com o nome seguro
                    $path = $image->storeAs('combos', $safeName, 'public');
                    $images[] = Storage::url($path);
                }
                $combo->images = $images;
            }

            $combo->save();

            // Atualizar produtos do combo
            $combo->products()->detach();
            foreach ($request->products as $productData) {
                $combo->products()->attach($productData['product_id'], [
                    'quantity' => $productData['quantity'],
                    'sale_type' => $productData['sale_type']
                ]);
            }

            DB::commit();

            return response()->json($combo->load(['products']));

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function destroy(Combo $combo): JsonResponse
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

            // Remover relacionamentos com produtos
            $combo->products()->detach();

            $combo->delete();

            DB::commit();

            return response()->json(null, 204);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function toggleStatus(Combo $combo): JsonResponse
    {
        $combo->is_active = !$combo->is_active;
        $combo->save();

        return response()->json($combo);
    }

    public function uploadImage(Request $request, Combo $combo): JsonResponse
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

    public function deleteImage(Request $request, Combo $combo): JsonResponse
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

        $exists = Combo::where('barcode', $request->barcode)->exists();
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
        $query = Combo::with(['products'])
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
        $combos = $query->paginate($perPage);

        return response()->json([
            'data' => $combos->items(),
            'total' => $combos->total(),
            'current_page' => $combos->currentPage(),
            'per_page' => $combos->perPage(),
            'last_page' => $combos->lastPage()
        ]);
    }

    public function publicShow(Combo $combo): JsonResponse
    {
        if (!$combo->is_active) {
            return response()->json(['error' => 'Combo não encontrado'], 404);
        }

        $combo->load(['products']);
        return response()->json($combo);
    }
}