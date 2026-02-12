<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderPayment extends Model
{
    public const METHOD_MONEY = 'money';
    public const METHOD_PIX = 'pix';
    public const METHOD_CREDIT_CARD = 'credit_card';
    public const METHOD_DEBIT_CARD = 'debit_card';

    /** @var array<string> Métodos de pagamento válidos (Split Payment - PDV) */
    public const PAYMENT_METHODS = [
        self::METHOD_MONEY,
        self::METHOD_PIX,
        self::METHOD_CREDIT_CARD,
        self::METHOD_DEBIT_CARD,
    ];

    protected $fillable = [
        'order_id',
        'payment_method',
        'amount',
        'change',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'change' => 'decimal:2',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
