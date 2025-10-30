<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'opened_by',
        'opened_at',
        'closed_at',
        'initial_amount',
        'closing_amount',
        'is_open',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'is_open' => 'boolean',
        'initial_amount' => 'decimal:2',
        'closing_amount' => 'decimal:2',
    ];

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CashTransaction::class);
    }

    public function getCurrentAmountAttribute(): float
    {
        $entries = (float) $this->transactions()->where('type', 'entrada')->sum('amount');
        $exits = (float) $this->transactions()->where('type', 'saida')->sum('amount');
        return (float) $this->initial_amount + $entries - $exits;
    }
}


