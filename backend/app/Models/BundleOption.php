<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BundleOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'group_id',
        'product_id',
        'quantity',
        'sale_type',
        'price_adjustment',
        'order',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price_adjustment' => 'decimal:2',
        'order' => 'integer',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(BundleGroup::class, 'group_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}

