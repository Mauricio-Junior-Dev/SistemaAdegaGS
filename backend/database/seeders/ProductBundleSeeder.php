<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ProductBundle;
use App\Models\BundleGroup;
use App\Models\BundleOption;
use App\Models\Product;
use Illuminate\Support\Str;

class ProductBundleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Criar o Bundle principal
        $bundle = ProductBundle::create([
            'name' => 'Kit Gin Tônica da Galera',
            'slug' => Str::slug('Kit Gin Tônica da Galera'),
            'description' => 'Monte seu kit personalizado escolhendo o gin, acompanhamentos e energéticos.',
            'bundle_type' => 'combo',
            'pricing_type' => 'calculated', // Preço calculado dinamicamente
            'base_price' => 0.00, // Preço base zero, será calculado
            'is_active' => true,
            'featured' => true,
        ]);

        // Grupo 1: Escolha seu Gin (Obrigatório, Min 1, Max 1)
        $group1 = BundleGroup::create([
            'bundle_id' => $bundle->id,
            'name' => 'Escolha seu Gin',
            'description' => 'Selecione o gin de sua preferência',
            'order' => 1,
            'is_required' => true,
            'min_selections' => 1,
            'max_selections' => 1,
            'selection_type' => 'single',
        ]);

        // Buscar produtos que contenham "Gin" no nome
        $ginProducts = Product::where('name', 'LIKE', '%Gin%')
            ->orWhere('name', 'LIKE', '%gin%')
            ->limit(3)
            ->get();

        // Se não encontrar 3 produtos com "Gin", buscar por ID ou criar opções genéricas
        if ($ginProducts->count() < 3) {
            // Buscar produtos alternativos ou usar os primeiros produtos disponíveis
            $allProducts = Product::where('is_active', true)
                ->limit(10)
                ->get();
            
            // Usar os primeiros 3 produtos disponíveis se não encontrar Gins
            $ginProducts = $ginProducts->merge($allProducts->take(3 - $ginProducts->count()));
        }

        // Adicionar opções ao Grupo 1
        foreach ($ginProducts->take(3) as $index => $product) {
            BundleOption::create([
                'group_id' => $group1->id,
                'product_id' => $product->id,
                'quantity' => 1,
                'sale_type' => 'dose', // Gins geralmente são vendidos por dose
                'price_adjustment' => 0.00,
                'order' => $index + 1,
            ]);
        }

        // Grupo 2: Acompanhamentos (Opcional, Min 0, Max 2)
        $group2 = BundleGroup::create([
            'bundle_id' => $bundle->id,
            'name' => 'Acompanhamentos',
            'description' => 'Escolha até 2 acompanhamentos (opcional)',
            'order' => 2,
            'is_required' => false,
            'min_selections' => 0,
            'max_selections' => 2,
            'selection_type' => 'multiple',
        ]);

        // Buscar produtos de Gelo e Limão
        $gelo = Product::where('name', 'LIKE', '%Gelo%')
            ->orWhere('name', 'LIKE', '%gelo%')
            ->first();
        
        $limao = Product::where('name', 'LIKE', '%Limão%')
            ->orWhere('name', 'LIKE', '%limão%')
            ->orWhere('name', 'LIKE', '%Lima%')
            ->first();

        // Se não encontrar, usar produtos alternativos ou criar placeholders
        if ($gelo) {
            BundleOption::create([
                'group_id' => $group2->id,
                'product_id' => $gelo->id,
                'quantity' => 1,
                'sale_type' => 'garrafa',
                'price_adjustment' => 0.00,
                'order' => 1,
            ]);
        }

        if ($limao) {
            BundleOption::create([
                'group_id' => $group2->id,
                'product_id' => $limao->id,
                'quantity' => 1,
                'sale_type' => 'garrafa',
                'price_adjustment' => 0.00,
                'order' => 2,
            ]);
        }

        // Se não encontrou nenhum, adicionar produtos genéricos como fallback
        if (!$gelo || !$limao) {
            $fallbackProducts = Product::where('is_active', true)
                ->whereNotIn('id', $ginProducts->pluck('id'))
                ->limit(2)
                ->get();
            
            foreach ($fallbackProducts as $index => $product) {
                BundleOption::create([
                    'group_id' => $group2->id,
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'sale_type' => 'garrafa',
                    'price_adjustment' => 0.00,
                    'order' => ($gelo ? 2 : 1) + $index,
                ]);
            }
        }

        // Grupo 3: Energético (Obrigatório, Min 2, Max 2)
        $group3 = BundleGroup::create([
            'bundle_id' => $bundle->id,
            'name' => 'Energético',
            'description' => 'Escolha exatamente 2 energéticos',
            'order' => 3,
            'is_required' => true,
            'min_selections' => 2,
            'max_selections' => 2,
            'selection_type' => 'multiple',
        ]);

        // Buscar Red Bull ou produtos com "Energético" no nome
        $redBull = Product::where('name', 'LIKE', '%Red Bull%')
            ->orWhere('name', 'LIKE', '%red bull%')
            ->orWhere('name', 'LIKE', '%Energético%')
            ->orWhere('name', 'LIKE', '%energético%')
            ->first();

        if ($redBull) {
            // Adicionar Red Bull como opção (pode ser selecionado 2 vezes)
            BundleOption::create([
                'group_id' => $group3->id,
                'product_id' => $redBull->id,
                'quantity' => 1,
                'sale_type' => 'garrafa',
                'price_adjustment' => 0.00,
                'order' => 1,
            ]);
        } else {
            // Fallback: usar qualquer produto disponível
            $fallbackProduct = Product::where('is_active', true)
                ->whereNotIn('id', $ginProducts->pluck('id'))
                ->first();
            
            if ($fallbackProduct) {
                BundleOption::create([
                    'group_id' => $group3->id,
                    'product_id' => $fallbackProduct->id,
                    'quantity' => 1,
                    'sale_type' => 'garrafa',
                    'price_adjustment' => 0.00,
                    'order' => 1,
                ]);
            }
        }

        $this->command->info("✅ Bundle '{$bundle->name}' criado com sucesso!");
        $this->command->info("   - Grupo 1 (Gin): {$group1->name} - {$ginProducts->count()} opções");
        $this->command->info("   - Grupo 2 (Acompanhamentos): {$group2->name} - " . $group2->options()->count() . " opções");
        $this->command->info("   - Grupo 3 (Energético): {$group3->name} - " . $group3->options()->count() . " opções");
    }
}
