<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\DeliveryZone;

class DeliveryZoneSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $deliveryZones = [
            [
                'nome_bairro' => 'Centro',
                'valor_frete' => 5.00,
                'tempo_estimado' => '30-45 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'Jardins',
                'valor_frete' => 7.50,
                'tempo_estimado' => '40-60 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'Vila Nova',
                'valor_frete' => 6.00,
                'tempo_estimado' => '35-50 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'São José',
                'valor_frete' => 8.00,
                'tempo_estimado' => '45-65 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'Bela Vista',
                'valor_frete' => 4.50,
                'tempo_estimado' => '25-40 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'Industrial',
                'valor_frete' => 10.00,
                'tempo_estimado' => '60-80 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'Residencial',
                'valor_frete' => 9.00,
                'tempo_estimado' => '50-70 min',
                'ativo' => true,
            ],
            [
                'nome_bairro' => 'Comercial',
                'valor_frete' => 3.00,
                'tempo_estimado' => '20-30 min',
                'ativo' => true,
            ],
        ];

        foreach ($deliveryZones as $zone) {
            DeliveryZone::create($zone);
        }
    }
}
