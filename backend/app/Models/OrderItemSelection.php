<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemSelection extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_item_id',
        'bundle_group_id',
        'product_id',
        'quantity',
        'sale_type',
        'price',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price' => 'decimal:2',
    ];

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(BundleGroup::class, 'bundle_group_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}

