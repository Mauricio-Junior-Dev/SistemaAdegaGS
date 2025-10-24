<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

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
            // Filtro de baixo estoque apenas quando valor truthy
            ->when(!empty($filters['low_stock']), function ($query) {
                $query->whereRaw('current_stock <= min_stock');
            })
            // Filtro por categoria
            ->when(isset($filters['category']) && $filters['category'] !== '', function ($query) use ($filters) {
                $query->where('category_id', $filters['category']);
            })
            // Filtro por status do estoque
            ->when(isset($filters['stock_filter']) && $filters['stock_filter'] !== 'all', function ($query) use ($filters) {
                switch ($filters['stock_filter']) {
                    case 'low':
                        $query->whereRaw('current_stock <= min_stock');
                        break;
                    case 'out':
                        $query->whereRaw('current_stock = 0');
                        break;
                    case 'normal':
                        $query->whereRaw('current_stock > min_stock');
                        break;
                }
            })
            // Busca por nome, SKU ou código de barras
            ->when(isset($filters['search']) && $filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            // Ordenar por estoque ascendente
            ->orderByRaw('current_stock ASC');

        return $query->paginate($perPage);
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

    public function getStockSummary(): array
    {
        return [
            'total_products' => Product::where('is_active', true)->count(),
            'low_stock_count' => Product::where('is_active', true)->whereRaw('current_stock <= min_stock')->count(),
            'out_of_stock_count' => Product::where('is_active', true)->where('current_stock', 0)->count(),
            'total_stock_value' => Product::where('is_active', true)->sum(DB::raw('current_stock * cost_price'))
        ];
    }
}
