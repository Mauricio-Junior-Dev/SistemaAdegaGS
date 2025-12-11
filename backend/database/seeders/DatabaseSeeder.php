<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement; // Importante para logar a entrada inicial (mesmo que zero)
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        // 1. Criar Usuário Admin (Obrigatório)
        if (!User::where('email', 'admin@adegags.com')->exists()) {
            User::create([
                'name' => 'Administrador',
                'email' => 'admin@adegags.com',
                'password' => bcrypt('Joaoadegags11@'),
                'type' => 'admin',
                'is_active' => true,
                'document_number' => '00000000000' // CPF fictício para o admin sistema
            ]);
            echo "✅ Usuário Admin criado com sucesso!\n";
        }

        // 2. Categorias da Adega
        $categorias = [
            'Cervejas Lata',
            'Cervejas Long Neck',
            'Bebidas Ice',
            'Energéticos',
            'Destilados',
            'Refrigerantes',
            'Águas',
            'Carvão & Gelo',
            'Gás de Cozinha',
            'Outros'
        ];

        $categoriasCriadas = [];
        foreach ($categorias as $i => $nome) {
            $categoriasCriadas[$nome] = Category::firstOrCreate(
                ['name' => $nome],
                [
                    'slug' => Str::slug($nome),
                    'description' => "Categoria de {$nome}",
                    'is_active' => true,
                    'position' => $i + 1
                ]
            );
        }
        echo "✅ Categorias criadas!\n";

        // 3. Produtos Iniciais (Lista Real)
        $produtos = [
            // 🍺 CERVEJAS LATA
            ['Cervejas Lata', 'Brahma Duplo Malte Lata 350ml'],
            ['Cervejas Lata', 'Skol Lata 350ml'],
            ['Cervejas Lata', 'Brahma Chopp Lata 350ml'],
            ['Cervejas Lata', 'Antarctica Lata 350ml'],
            ['Cervejas Lata', 'Heineken Lata 350ml'],

            // 🍺 LONG NECK
            ['Cervejas Long Neck', 'Heineken Long Neck 330ml'],
            ['Cervejas Long Neck', 'Budweiser Long Neck 330ml'],
            ['Cervejas Long Neck', 'Stella Artois Long Neck 275ml'],

            // 🍹 BEATS & ICE
            ['Bebidas Ice', 'Smirnoff Ice 275ml'],
            ['Bebidas Ice', 'Skol Beats Senses 313ml'],
            ['Bebidas Ice', 'Skol Beats 150 BPM'],
            ['Bebidas Ice', 'Skol Beats GT'],

            // ⚡ ENERGÉTICOS
            ['Energéticos', 'Red Bull 250ml'],
            ['Energéticos', 'Monster Energy 473ml'],
            ['Energéticos', 'Fusion Energy Drink 250ml'],

            // 🥃 DESTILADOS
            ['Destilados', 'Vodka Smirnoff 1L'],
            ['Destilados', 'Vodka Absolut 1L'],
            ['Destilados', 'Whisky Ballantines 1L'],
            ['Destilados', 'Whisky Red Label 1L'],
            ['Destilados', 'Gin Tanqueray 750ml'],
            ['Destilados', 'Gin Bombay Sapphire 750ml'],
            ['Destilados', 'Tequila Jose Cuervo 750ml'],

            // 🧃 REFRIGERANTES
            ['Refrigerantes', 'Coca-Cola 2L'],
            ['Refrigerantes', 'Guaraná Antarctica 2L'],
            ['Refrigerantes', 'Coca-Cola Lata 350ml'],
            ['Refrigerantes', 'Guaraná Antarctica Lata 350ml'],
            ['Refrigerantes', 'Fanta Laranja 2L'],

            // 💧 ÁGUA
            ['Águas', 'Água Mineral Sem Gás 500ml'],
            ['Águas', 'Água Mineral Com Gás 500ml'],
            ['Águas', 'Água Mineral 1,5L'],

            // ❄ GELO & CARVÃO
            ['Carvão & Gelo', 'Gelo 5kg'],
            ['Carvão & Gelo', 'Gelo 3kg'],
            ['Carvão & Gelo', 'Carvão 5kg'],

            // 🏠 GÁS
            ['Gás de Cozinha', 'Botijão de Gás P13'],
            ['Gás de Cozinha', 'Botijão de Gás P45'],

            // OUTROS
            ['Outros', 'Copo descartável 200ml'],
            ['Outros', 'Guardanapo'],
        ];

        foreach ($produtos as [$categoria, $nome]) {
            // Verifica se o produto já existe para não duplicar
            if (!Product::where('name', $nome)->exists()) {
                Product::create([
                    'category_id' => $categoriasCriadas[$categoria]->id,
                    'name'        => $nome,
                    'slug'        => Str::slug($nome),
                    'description' => $nome,
                    'price'       => 0.00,  // Dono ajusta depois
                    'cost_price'  => 0.00,  // Obrigatório ter valor (mesmo que zero)
                    'current_stock' => 0,   // Estoque zerado
                    'min_stock'     => 5,
                    'is_active'     => true,
                    'visible_online' => true
                ]);
            }
        }
        echo "✅ Produtos criados com estoque zerado!\n";

        // 4. Configuração da Loja
        $this->call(StoreConfigSeeder::class);
        echo "✅ Configurações da loja aplicadas!\n";
    }
}
