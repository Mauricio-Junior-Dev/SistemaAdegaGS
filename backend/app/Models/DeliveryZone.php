<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryZone extends Model
{
    use HasFactory;

    protected $fillable = [
        'nome_bairro',
        'valor_frete',
        'tempo_estimado',
        'ativo'
    ];

    protected $casts = [
        'valor_frete' => 'decimal:2',
        'ativo' => 'boolean'
    ];

    public function scopeAtivo($query)
    {
        return $query->where('ativo', true);
    }
}
