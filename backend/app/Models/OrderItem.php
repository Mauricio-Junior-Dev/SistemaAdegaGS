<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'product_bundle_id',
        'is_bundle',
        'quantity',
        'sale_type',
        'price',
        'subtotal',
        'bundle_snapshot',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'is_bundle' => 'boolean',
        'bundle_snapshot' => 'array',
    ];

    /**
     * Atributos computados para API/impressão: nome unificado, flag de combo, sub-itens e objeto combo.
     */
    protected $appends = ['name', 'is_combo', 'sub_lines', 'combo'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productBundle(): BelongsTo
    {
        return $this->belongsTo(ProductBundle::class, 'product_bundle_id');
    }

    public function selections(): HasMany
    {
        return $this->hasMany(OrderItemSelection::class);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($item) {
            if (empty($item->subtotal)) {
                $item->subtotal = $item->quantity * $item->price;
            }
        });
    }

    /**
     * Nome unificado para API/impressão: produto, bundle ou fallback.
     */
    public function getNameAttribute(): string
    {
        if ($this->relationLoaded('product') && $this->product) {
            return $this->product->name ?? 'Item sem nome';
        }
        if ($this->relationLoaded('productBundle') && $this->productBundle) {
            return $this->productBundle->name ?? 'Item sem nome';
        }
        if ($this->product_id) {
            return $this->product->name ?? 'Item sem nome';
        }
        if ($this->product_bundle_id) {
            return $this->productBundle->name ?? 'Item sem nome';
        }
        return 'Item sem nome';
    }

    /**
     * Indica se o item é combo/bundle (para impressora e frontend).
     */
    public function getIsComboAttribute(): bool
    {
        return (bool) $this->product_bundle_id;
    }

    /**
     * Linhas de sub-itens para impressão (combo): ex. ["- 1x Coca-Cola", "- 1x Gelo de Coco"].
     */
    public function getSubLinesAttribute(): array
    {
        if (!$this->product_bundle_id) {
            return [];
        }
        $lines = [];
        $selections = $this->relationLoaded('selections') ? $this->selections : $this->selections()->with('product')->get();
        foreach ($selections as $sel) {
            $qty = (int) ($sel->quantity ?? 1);
            $productName = $sel->relationLoaded('product') && $sel->product
                ? $sel->product->name
                : ($sel->product ? $sel->product->name : 'Item');
            $lines[] = "- {$qty}x {$productName}";
        }
        return $lines;
    }

    /**
     * Objeto combo com nome para compatibilidade com C#/frontend (evita "Produto desconhecido").
     */
    public function getComboAttribute(): ?array
    {
        if (!$this->product_bundle_id) {
            return null;
        }
        $bundle = $this->productBundle;
        if (!$bundle) {
            return null;
        }
        return ['name' => $bundle->name ?? 'Combo'];
    }
}