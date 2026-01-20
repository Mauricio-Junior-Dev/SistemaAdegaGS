<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BundleGroup extends Model
{
    use HasFactory;

    protected $fillable = [
        'bundle_id',
        'name',
        'description',
        'order',
        'is_required',
        'min_selections',
        'max_selections',
        'selection_type',
    ];

    protected $casts = [
        'order' => 'integer',
        'is_required' => 'boolean',
        'min_selections' => 'integer',
        'max_selections' => 'integer',
    ];

    public function bundle(): BelongsTo
    {
        return $this->belongsTo(ProductBundle::class, 'bundle_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(BundleOption::class, 'group_id')
            ->orderBy('order');
    }
}

