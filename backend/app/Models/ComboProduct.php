<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComboProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'combo_id',
        'product_id',
        'quantity',
        'sale_type'
    ];

    protected $casts = [
        'quantity' => 'integer'
    ];

    public function combo(): BelongsTo
    {
        return $this->belongsTo(Combo::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
