<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ProductBundle extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'bundle_type',
        'pricing_type',
        'base_price',
        'original_price',
        'discount_percentage',
        'barcode',
        'is_active',
        'featured',
        'offers',
        'popular',
        'images',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'original_price' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
        'is_active' => 'boolean',
        'featured' => 'boolean',
        'offers' => 'boolean',
        'popular' => 'boolean',
        'images' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($bundle) {
            if (empty($bundle->slug)) {
                $bundle->slug = Str::slug($bundle->name);
            }
        });

        static::updating(function ($bundle) {
            if ($bundle->isDirty('name') && empty($bundle->slug)) {
                $bundle->slug = Str::slug($bundle->name);
            }
        });
    }

    public function groups(): HasMany
    {
        return $this->hasMany(BundleGroup::class, 'bundle_id')
            ->orderBy('order');
    }

    /**
     * Acesso indireto a todas as opções através dos grupos.
     * Útil para relatórios e carregamentos agregados.
     */
    public function options(): HasMany
    {
        return $this->hasManyThrough(
            BundleOption::class,
            BundleGroup::class,
            'bundle_id',   // Chave FK em BundleGroup
            'group_id',    // Chave FK em BundleOption
            'id',          // Chave local em ProductBundle
            'id'           // Chave local em BundleGroup
        );
    }
}

