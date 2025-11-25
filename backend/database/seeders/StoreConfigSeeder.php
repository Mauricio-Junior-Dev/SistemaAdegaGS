<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Setting;

class StoreConfigSeeder extends Seeder
{
    public function run(): void
    {
        // Criar ou atualizar a configuração de loja aberta/fechada
        // O Setting model tem cast 'array', então passamos como array
        Setting::updateOrCreate(
            ['key' => 'is_store_open'],
            ['value' => ['is_open' => true]]
        );
    }
}

