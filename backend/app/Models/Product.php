<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
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
        'sku',
        'barcode',
        'is_active',
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
        'featured' => 'boolean',
        'offers' => 'boolean',
        'popular' => 'boolean',
        'images' => 'array'
    ];

    protected $appends = ['low_stock'];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function getLowStockAttribute(): bool
    {
        $currentStock = $this->current_stock;
        $minStock = $this->min_stock;
        return $currentStock <= $minStock;
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
     */
    public function atualizarEstoquePorVenda(int $quantidade, string $tipo): void
    {
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