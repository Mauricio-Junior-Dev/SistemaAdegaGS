<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Banner;

class BannerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $banners = [
            [
                'title' => 'ADEGA GS',
                'subtitle' => 'Delivery de bebidas na sua porta',
                'image_url' => 'storage/banners/banner1.jpg',
                'link' => '/produtos',
                'order' => 1,
                'is_active' => true,
            ],
            [
                'title' => 'Promoção Especial',
                'subtitle' => 'Descontos imperdíveis para você',
                'image_url' => 'storage/banners/banner2.jpg',
                'link' => '/produtos',
                'order' => 2,
                'is_active' => true,
            ],
            [
                'title' => 'Entrega Rápida',
                'subtitle' => 'Receba em até 30 minutos',
                'image_url' => 'storage/banners/banner3.jpg',
                'link' => '/produtos',
                'order' => 3,
                'is_active' => true,
            ],
        ];

        foreach ($banners as $banner) {
            Banner::create($banner);
        }
    }
}
