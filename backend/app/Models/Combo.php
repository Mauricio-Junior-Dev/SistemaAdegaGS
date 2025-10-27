<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Combo extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'original_price',
        'discount_percentage',
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
        'discount_percentage' => 'decimal:2',
        'is_active' => 'boolean',
        'featured' => 'boolean',
        'offers' => 'boolean',
        'popular' => 'boolean',
        'images' => 'array'
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($combo) {
            if (empty($combo->slug)) {
                $combo->slug = Str::slug($combo->name);
            }
        });
        
        static::updating(function ($combo) {
            if ($combo->isDirty('name') && empty($combo->slug)) {
                $combo->slug = Str::slug($combo->name);
            }
        });
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'combo_products')
                    ->withPivot(['quantity', 'sale_type'])
                    ->withTimestamps();
    }

    public function comboProducts()
    {
        return $this->hasMany(ComboProduct::class);
    }

    public function getTotalOriginalPriceAttribute()
    {
        return $this->products->sum(function ($product) {
            $price = $product->pivot->sale_type === 'dose' ? $product->dose_price : $product->price;
            return $price * $product->pivot->quantity;
        });
    }

    public function getDiscountAmountAttribute()
    {
        if ($this->original_price) {
            return $this->original_price - $this->price;
        }
        return $this->getTotalOriginalPriceAttribute() - $this->price;
    }

    public function getFormattedDiscountAttribute()
    {
        if ($this->discount_percentage) {
            return $this->discount_percentage . '%';
        }
        
        $originalPrice = $this->original_price ?? $this->getTotalOriginalPriceAttribute();
        if ($originalPrice > 0) {
            $discount = (($originalPrice - $this->price) / $originalPrice) * 100;
            return number_format($discount, 1) . '%';
        }
        
        return '0%';
    }
}
