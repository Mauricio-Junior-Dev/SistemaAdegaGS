<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'order_id',
        'amount',
        'payment_method',
        'status',
        'received_amount',
        'change_amount',
        'transaction_id',
        'qr_code',
        'expires_at'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'received_amount' => 'decimal:2',
        'change_amount' => 'decimal:2',
        'expires_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}