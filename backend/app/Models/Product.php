<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'parent_product_id',
        'stock_multiplier',
        'name',
        'slug',
        'description',
        'price',
        'original_price',
        'cost_price',
        'current_stock',
        'min_stock',
        'doses_por_garrafa',
        'doses_vendidas',
        'can_sell_by_dose',
        'dose_price',
        'barcode',
        'is_active',
        'visible_online',
        'featured',
        'offers',
        'popular',
        'images'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'original_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'current_stock' => 'integer',
        'min_stock' => 'integer',
        'doses_por_garrafa' => 'integer',
        'doses_vendidas' => 'integer',
        'can_sell_by_dose' => 'boolean',
        'dose_price' => 'decimal:2',
        'is_active' => 'boolean',
        'visible_online' => 'boolean',
        'featured' => 'boolean',
        'offers' => 'boolean',
        'popular' => 'boolean',
        'images' => 'array',
        'parent_product_id' => 'integer',
        'stock_multiplier' => 'integer'
    ];

    protected $appends = ['low_stock', 'discount_percentage', 'has_discount'];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function parentProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'parent_product_id');
    }

    public function childProducts(): HasMany
    {
        return $this->hasMany(Product::class, 'parent_product_id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function combos()
    {
        return $this->belongsToMany(Combo::class, 'combo_products')
                    ->withPivot(['quantity', 'sale_type'])
                    ->withTimestamps();
    }

    /**
     * Verifica se este produto é um Pack (tem parent_product_id e stock_multiplier > 1)
     */
    public function isPack(): bool
    {
        return !is_null($this->parent_product_id) && $this->stock_multiplier > 1;
    }

    /**
     * Obtém o produto pai (unidade base) deste pack
     */
    public function getParentProduct(): ?Product
    {
        if (!$this->parent_product_id) {
            return null;
        }
        return $this->parentProduct;
    }

    public function getLowStockAttribute(): bool
    {
        $currentStock = $this->current_stock;
        $minStock = $this->min_stock;
        return $currentStock <= $minStock;
    }

    /**
     * Calcula a porcentagem de desconto
     * Retorna 0 se não houver desconto válido
     */
    public function getDiscountPercentageAttribute(): int
    {
        if (!$this->original_price || $this->original_price <= $this->price) {
            return 0;
        }
        return (int) round((($this->original_price - $this->price) / $this->original_price) * 100);
    }

    /**
     * Verifica se o produto tem desconto válido
     */
    public function getHasDiscountAttribute(): bool
    {
        return $this->original_price !== null && $this->original_price > $this->price;
    }

    public function updateStock(int $quantity, string $type, ?string $description = null, ?float $unitCost = null): void
    {
        $movement = new StockMovement([
            'user_id' => auth()->id(),
            'type' => $type,
            'quantity' => $quantity,
            'description' => $description,
            'unit_cost' => $unitCost
        ]);

        $this->stockMovements()->save($movement);

        // Coluna única
        if ($type === 'entrada') {
            $this->increment('current_stock', $quantity);
        } elseif ($type === 'saida') {
            $currentValue = (int) $this->current_stock;
            if ($currentValue < $quantity) {
                throw new \Exception('Quantidade insuficiente em estoque');
            }
            $this->decrement('current_stock', $quantity);
        } else { // ajuste
            $this->update(['current_stock' => $quantity]);
        }
    }

    /**
     * Atualiza o estoque baseado no tipo de venda (dose ou garrafa)
     * Suporta lógica de Packs: se o produto é um Pack, desconta do produto pai
     */
    public function atualizarEstoquePorVenda(int $quantidade, string $tipo): void
    {
        // LÓGICA DE PACK: Se este produto é um Pack, desconta do produto pai
        if ($this->isPack()) {
            $parentProduct = $this->getParentProduct();
            if (!$parentProduct) {
                throw new \Exception('Produto pai não encontrado para o Pack');
            }

            // Calcula quantas unidades do produto pai devem ser descontadas
            $unidadesPai = $quantidade * $this->stock_multiplier;

            // Verifica estoque do produto pai
            if ($parentProduct->current_stock < $unidadesPai) {
                throw new \Exception("Estoque insuficiente no produto pai. Necessário: {$unidadesPai}, Disponível: {$parentProduct->current_stock}");
            }

            // Desconta do produto pai
            $parentProduct->decrement('current_stock', $unidadesPai);
            $parentProduct->save();

            // Registra movimentação no produto pai
            $parentProduct->stockMovements()->create([
                'user_id' => auth()->id(),
                'type' => 'saida',
                'quantity' => $unidadesPai,
                'description' => "Venda Pack ({$tipo}) - {$quantidade} pack(s) x {$this->stock_multiplier} unidades = {$unidadesPai} unidades",
                'unit_cost' => $this->cost_price ?? 0
            ]);

            // Pack não tem estoque próprio, apenas referencia o pai
            return;
        }

        // LÓGICA NORMAL: Produto não é Pack, usa lógica padrão
        if ($tipo === 'dose') {
            // Incrementa o contador de doses vendidas
            $this->increment('doses_vendidas', $quantidade);
            
            // Verifica se atingiu o limite para deduzir garrafas
            if ($this->doses_vendidas >= $this->doses_por_garrafa) {
                $garrafas_a_deduzir = floor($this->doses_vendidas / $this->doses_por_garrafa);
                
                // Verifica se há estoque suficiente
                if ($this->current_stock < $garrafas_a_deduzir) {
                    throw new \Exception('Estoque insuficiente de garrafas');
                }
                
                // Deduz as garrafas do estoque
                $this->decrement('current_stock', $garrafas_a_deduzir);
                
                // Atualiza o contador de doses vendidas com o resto
                $this->doses_vendidas = $this->doses_vendidas % $this->doses_por_garrafa;
            }
        } else {
            // Venda direta de garrafa - deduz do estoque
            if ($this->current_stock < $quantidade) {
                throw new \Exception('Estoque insuficiente de garrafas');
            }
            $this->decrement('current_stock', $quantidade);
        }
        
        $this->save();
    }
}