<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Combo;
use App\Models\ProductBundle;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class StockService
{
    public function getProductStock(int $productId): Product
    {
        return Product::with(['stockMovements' => function ($query) {
            $query->latest()->limit(10);
        }])->findOrFail($productId);
    }

    public function getAllStock(array $filters = []): LengthAwarePaginator
    {
        $perPage = isset($filters['per_page']) && (int)$filters['per_page'] > 0 ? (int)$filters['per_page'] : 15;

        $query = Product::query()
            ->with(['category'])
            // Filtrar apenas produtos ativos
            ->where('is_active', true)
            // Filtro por categoria
            ->when(isset($filters['category']) && $filters['category'] !== '', function ($query) use ($filters) {
                $query->where('category_id', $filters['category']);
            })
            // Filtro por status do estoque (opcional - quando usuário escolhe filtrar)
            ->when(isset($filters['stock_filter']) && $filters['stock_filter'] !== 'all', function ($query) use ($filters) {
                switch ($filters['stock_filter']) {
                    case 'low':
                        $query->whereRaw('current_stock > 0 AND current_stock <= min_stock');
                        break;
                    case 'out':
                        $query->where('current_stock', 0);
                        break;
                    case 'normal':
                        $query->whereRaw('current_stock > min_stock');
                        break;
                }
            })
            // Filtro de baixo estoque (legado - quando low_stock=true)
            ->when(!empty($filters['low_stock']), function ($query) {
                $query->whereRaw('current_stock <= min_stock');
            })
            // Busca por nome ou código de barras
            ->when(isset($filters['search']) && $filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            // Ordenação ponderada por urgência: 1=Esgotados, 2=Baixo, 3=Normal
            // Desempate: menores quantidades primeiro, depois ordem alfabética
            ->orderByRaw('CASE WHEN current_stock = 0 THEN 1 WHEN current_stock <= min_stock THEN 2 ELSE 3 END ASC')
            ->orderBy('current_stock', 'asc')
            ->orderBy('name', 'asc');

        $paginator = $query->paginate($perPage);

        // PDV: quando há busca, incluir Combos/Bundles na lista para venda no caixa.
        // Unificar como arrays para evitar serialização mista (Model + objeto) que pode causar Erro 500.
        $search = isset($filters['search']) && trim($filters['search']) !== '' ? trim($filters['search']) : null;
        if ($search !== null) {
            try {
                $bundles = ProductBundle::query()
                    ->where('is_active', true)
                    ->where(function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                            ->orWhere('barcode', 'like', "%{$search}%");
                    })
                    ->orderBy('name')
                    ->limit(20)
                    ->get();

                $bundleRows = $bundles->map(function (ProductBundle $bundle): array {
                    return $this->bundleToStockItemArray($bundle);
                })->all();

                // Converter produtos a array e mesclar com bundles (todos como array) para serialização consistente
                $productArrays = $paginator->getCollection()->map(fn (Product $p) => $p->toArray())->all();
                $mergedData = array_values(array_merge($productArrays, $bundleRows));
                $total = $paginator->total() + $bundles->count();

                $paginator = new LengthAwarePaginator(
                    $mergedData,
                    $total,
                    $perPage,
                    $paginator->currentPage(),
                    ['path' => \Illuminate\Pagination\Paginator::resolveCurrentPath()]
                );
            } catch (\Throwable $e) {
                Log::warning('StockService: falha ao incluir bundles na busca PDV, retornando apenas produtos.', [
                    'search' => $search,
                    'message' => $e->getMessage(),
                ]);
                // Em caso de erro (ex.: coluna faltando, tabela diferente), retorna só produtos
            }
        }

        return $paginator;
    }

    /**
     * Converte um ProductBundle em array no formato esperado pelo PDV (compatível com Product).
     * Inclui campos que o frontend pode acessar (id, name, price, etc.) e preenche com null/0
     * os que não existem em bundles para evitar erros de serialização ou acesso.
     */
    private function bundleToStockItemArray(ProductBundle $bundle): array
    {
        $price = (float) ($bundle->base_price ?? 0);
        return [
            'id' => $bundle->id,
            'name' => $bundle->name,
            'price' => $price,
            'base_price' => $price,
            'current_stock' => 0,
            'is_bundle' => true,
            'type' => 'bundle',
            'barcode' => $bundle->barcode ?? null,
            'category_id' => null,
            'category' => null,
            // Campos opcionais que Product pode ter (evitar undefined no frontend)
            'slug' => $bundle->slug ?? null,
            'description' => $bundle->description ?? null,
            'delivery_price' => null,
            'original_price' => $bundle->original_price ? (float) $bundle->original_price : null,
            'cost_price' => null,
            'min_stock' => 0,
            'doses_por_garrafa' => null,
            'doses_vendidas' => null,
            'can_sell_by_dose' => false,
            'dose_price' => null,
            'is_active' => (bool) $bundle->is_active,
            'visible_online' => null,
            'featured' => (bool) $bundle->featured,
            'offers' => (bool) $bundle->offers,
            'popular' => (bool) $bundle->popular,
            'images' => $bundle->images ?? null,
            'low_stock' => false,
            'discount_percentage' => $bundle->discount_percentage ? (float) $bundle->discount_percentage : null,
            'has_discount' => false,
        ];
    }

    public function updateStock(
        int $productId,
        int $quantity,
        string $type,
        ?string $description = null,
        ?float $unitCost = null
    ): Product {
        $product = Product::findOrFail($productId);

        // Validar apenas current_stock
        if ($type === 'saida' && $quantity > $product->current_stock) {
            throw new \Exception('Quantidade insuficiente em estoque');
        }

        $product->updateStock($quantity, $type, $description, $unitCost);

        return $product->fresh();
    }

    public function getStockMovements(int $productId): Collection
    {
        return StockMovement::with(['user'])
            ->where('product_id', $productId)
            ->latest()
            ->get();
    }

    public function getLowStockProducts(): Collection
    {
        return Product::where('is_active', true)
            ->whereRaw('current_stock <= min_stock')
            ->with('category')
            ->get();
    }

    /**
     * Resumo de estoque considerando apenas produtos físicos (exclui bundles/combos virtuais).
     * Combos não têm estoque próprio; somá-los geraria erro ou dados incorretos.
     * Chaves retornadas alinhadas ao frontend: total_products, low_stock_count, out_of_stock_count, total_value.
     */
    public function getStockSummary(): array
    {
        $query = Product::query()
            ->where('is_active', true);

        // Se a tabela tiver coluna type, considerar apenas produtos não-bundle
        if (Schema::hasColumn('products', 'type')) {
            $query->where(function (Builder $q) {
                $q->whereNull('type')->orWhere('type', '!=', 'bundle');
            });
        }
        // Se tiver is_bundle, excluir bundles
        if (Schema::hasColumn('products', 'is_bundle')) {
            $query->where(function (Builder $q) {
                $q->where('is_bundle', false)->orWhereNull('is_bundle');
            });
        }

        $totalProducts = (clone $query)->count();
        $totalItemsInStock = (clone $query)->sum('current_stock');
        $lowStockCount = (clone $query)
            ->where('current_stock', '>', 0)
            ->whereColumn('current_stock', '<=', 'min_stock')
            ->count();
        $outOfStockCount = (clone $query)->where('current_stock', 0)->count();

        // total_value: soma de current_stock * cost_price (COALESCE evita NULL em cost_price)
        $totalValue = (clone $query)->sum(
            DB::raw('current_stock * COALESCE(price, 0)')
        );

        return [
            'total_products' => $totalProducts,
            'total_items_in_stock' => (int) $totalItemsInStock,
            'low_stock_count' => $lowStockCount,
            'out_of_stock_count' => $outOfStockCount,
            'total_value' => (float) $totalValue,
        ];
    }

    public function getComboStockInfo(int $comboId): array
    {
        $combo = Combo::with('products')->findOrFail($comboId);
        
        $productsInfo = [];
        $canSell = true;
        $lowStockProducts = [];
        
        foreach ($combo->products as $product) {
            $quantity = $product->pivot->quantity;
            $saleType = $product->pivot->sale_type;
            
            $availableStock = $product->current_stock;
            $requiredStock = $saleType === 'dose' ? 
                ceil($quantity / $product->doses_por_garrafa) : 
                $quantity;
            
            $productsInfo[] = [
                'product' => $product,
                'required_quantity' => $quantity,
                'sale_type' => $saleType,
                'available_stock' => $availableStock,
                'required_stock' => $requiredStock,
                'can_sell' => $availableStock >= $requiredStock,
                'is_low_stock' => $availableStock <= $product->min_stock
            ];
            
            if ($availableStock < $requiredStock) {
                $canSell = false;
            }
            
            if ($availableStock <= $product->min_stock) {
                $lowStockProducts[] = $product->name;
            }
        }
        
        return [
            'combo' => $combo,
            'products_info' => $productsInfo,
            'can_sell' => $canSell,
            'low_stock_products' => $lowStockProducts
        ];
    }

    public function getAllCombosStockInfo(): Collection
    {
        $combos = Combo::where('is_active', true)->with('products')->get();
        
        return $combos->map(function ($combo) {
            $stockInfo = $this->getComboStockInfo($combo->id);
            return [
                'combo' => $combo,
                'can_sell' => $stockInfo['can_sell'],
                'low_stock_products' => $stockInfo['low_stock_products'],
                'products_count' => $combo->products->count()
            ];
        });
    }
}
