<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;

class DeliveryZone extends Model
{
    use HasFactory;

    protected $fillable = [
        'nome_bairro', // Mantido como rótulo
        'cep_inicio',  // NOVO
        'cep_fim',     // NOVO
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

    // Mutator: Limpa hífens dos CEPs antes de salvar no DB
    protected function cepInicio(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => preg_replace('/[^0-9]/', '', $value),
        );
    }

    protected function cepFim(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => preg_replace('/[^0-9]/', '', $value),
        );
    }
}
