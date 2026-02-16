<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;

class BlockedZipCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'zip_code',
        'reason',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    /**
     * Sempre armazenar o CEP apenas com dígitos para facilitar comparação.
     */
    protected function zipCode(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => preg_replace('/[^0-9]/', '', (string) $value),
        );
    }
}

