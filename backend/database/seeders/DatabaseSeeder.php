<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Category;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\StockMovement;
use App\Models\Address;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        // Criar usuários
        $admin = User::create([
            'name' => 'Administrador',
            'email' => 'admin@adegags.com',
            'password' => bcrypt('12345678'),
            'type' => 'admin',
            'is_active' => true
        ]);

        $employee = User::create([
            'name' => 'Funcionário',
            'email' => 'funcionario@adegags.com',
            'password' => bcrypt('12345678'),
            'type' => 'employee',
            'is_active' => true,
        ]);

        // Criar alguns clientes
        $customers = [];
        for ($i = 1; $i <= 5; $i++) {
            $customers[] = User::create([
                'name' => "Cliente {$i}",
                'email' => "cliente{$i}@example.com",
                'password' => bcrypt('12345678'),
                'type' => 'customer',
                'is_active' => true,
                'phone' => "11 9999-999{$i}"
            ]);
        }

        // Criar alguns endereços de exemplo para os clientes
        $addresses = [
            [
                'user_id' => $customers[0]->id,
                'name' => 'Casa',
                'street' => 'Rua das Flores',
                'number' => '123',
                'complement' => 'Apto 45',
                'neighborhood' => 'Centro',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zipcode' => '01234-567',
                'notes' => 'Portão azul',
                'is_default' => true,
                'is_active' => true
            ],
            [
                'user_id' => $customers[0]->id,
                'name' => 'Trabalho',
                'street' => 'Avenida Paulista',
                'number' => '1000',
                'complement' => 'Sala 501',
                'neighborhood' => 'Bela Vista',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zipcode' => '01310-100',
                'notes' => 'Recepção no térreo',
                'is_default' => false,
                'is_active' => true
            ],
            [
                'user_id' => $customers[1]->id,
                'name' => 'Casa',
                'street' => 'Rua da Paz',
                'number' => '456',
                'neighborhood' => 'Vila Madalena',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zipcode' => '05435-000',
                'notes' => 'Casa com jardim',
                'is_default' => true,
                'is_active' => true
            ]
        ];

        foreach ($addresses as $addressData) {
            Address::create($addressData);
        }

        // Criar categorias
        $categories = [
            [
                'name' => 'Pack Cervejas Lata',
                'description' => 'Packs de cerveja em lata com ótimo custo-benefício',
                'is_active' => true
            ],
            [
                'name' => 'Pack Long Neck',
                'description' => 'Packs de cerveja long neck para todas as ocasiões',
                'is_active' => true
            ],
            [
                'name' => 'Bebidas Ice',
                'description' => 'Bebidas ice refrescantes e saborosas',
                'is_active' => true
            ],
            [
                'name' => 'Drinks',
                'description' => 'Drinks prontos para consumo',
                'is_active' => true
            ],
            [
                'name' => 'Energéticos',
                'description' => 'Energéticos para mais disposição',
                'is_active' => true
            ],
            [
                'name' => 'Bebidas Quentes',
                'description' => 'Destilados e licores premium',
                'is_active' => true
            ],
            [
                'name' => 'Refrigerantes',
                'description' => 'Refrigerantes de diversas marcas',
                'is_active' => true
            ],
            [
                'name' => 'Sucos',
                'description' => 'Sucos naturais e néctares',
                'is_active' => true
            ]
        ];

        $createdCategories = [];
        foreach ($categories as $index => $category) {
            $createdCategories[] = Category::create([
                'name' => $category['name'],
                'slug' => Str::slug($category['name']),
                'description' => $category['description'],
                'is_active' => $category['is_active'],
                'position' => $index + 1 // Definir posição baseada na ordem do array
            ]);
        }

        // Array de produtos
        $products = [
            // Pack Cervejas Lata
            [
                'category_id' => 1,
                'name' => 'Pack Cerveja Brahma Duplo Malte Lata 350ml - 12 Unidades',
                'price' => 39.90,
                'cost_price' => 30.00,
                'current_stock' => 50,
                'min_stock' => 20,
                'featured' => true,
                'initial_stock' => 100
            ],
            [
                'category_id' => 1,
                'name' => 'Pack Cerveja Original Lata 350ml - 12 Unidades',
                'price' => 45.90,
                'cost_price' => 35.00,
                'current_stock' => 5,
                'min_stock' => 15,
                'featured' => true,
                'initial_stock' => 50
            ],
            [
                'category_id' => 1,
                'name' => 'Pack Cerveja Heineken Lata 350ml - 12 Unidades',
                'price' => 52.90,
                'cost_price' => 42.00,
                'current_stock' => 10,
                'min_stock' => 10,
                'featured' => true,
                'initial_stock' => 30
            ],

            // Pack Long Neck
            [
                'category_id' => 2,
                'name' => 'Pack Cerveja Stella Artois Long Neck 275ml - 6 Unidades',
                'price' => 39.90,
                'cost_price' => 30.00,
                'current_stock' => 40,
                'min_stock' => 15,
                'featured' => false,
                'initial_stock' => 40
            ],
            [
                'category_id' => 2,
                'name' => 'Pack Cerveja Budweiser Long Neck 330ml - 6 Unidades',
                'price' => 36.90,
                'cost_price' => 28.00,
                'current_stock' => 45,
                'min_stock' => 15,
                'featured' => true,
                'initial_stock' => 45
            ],

            // Bebidas Ice
            [
                'category_id' => 3,
                'name' => 'Smirnoff Ice 275ml',
                'price' => 9.90,
                'cost_price' => 7.00,
                'current_stock' => 8,
                'min_stock' => 20,
                'featured' => true,
                'initial_stock' => 100
            ],
            [
                'category_id' => 3,
                'name' => 'Skol Beats Senses 313ml',
                'price' => 8.90,
                'cost_price' => 6.50,
                'current_stock' => 80,
                'min_stock' => 30,
                'featured' => false,
                'initial_stock' => 80
            ],

            // Energéticos
            [
                'category_id' => 5,
                'name' => 'Red Bull Energy Drink 250ml',
                'price' => 9.90,
                'cost_price' => 7.50,
                'current_stock' => 100,
                'min_stock' => 50,
                'featured' => true,
                'initial_stock' => 100
            ],
            [
                'category_id' => 5,
                'name' => 'Monster Energy 473ml',
                'price' => 11.90,
                'cost_price' => 8.50,
                'current_stock' => 80,
                'min_stock' => 40,
                'featured' => true,
                'initial_stock' => 80
            ],

            // Bebidas Quentes
            [
                'category_id' => 6,
                'name' => 'Whisky Jack Daniels 1L',
                'price' => 159.90,
                'cost_price' => 120.00,
                'current_stock' => 3,
                'min_stock' => 5,
                'featured' => true,
                'initial_stock' => 20
            ],
            [
                'category_id' => 6,
                'name' => 'Vodka Absolut Original 750ml',
                'price' => 89.90,
                'cost_price' => 65.00,
                'current_stock' => 30,
                'min_stock' => 10,
                'featured' => false,
                'initial_stock' => 30
            ],
            [
                'category_id' => 6,
                'name' => 'Gin Tanqueray 750ml',
                'price' => 129.90,
                'cost_price' => 95.00,
                'current_stock' => 25,
                'min_stock' => 8,
                'featured' => true,
                'initial_stock' => 25
            ],

            // Refrigerantes
            [
                'category_id' => 7,
                'name' => 'Coca-Cola 2L',
                'price' => 9.90,
                'cost_price' => 7.00,
                'current_stock' => 100,
                'min_stock' => 50,
                'featured' => false,
                'initial_stock' => 100
            ],
            [
                'category_id' => 7,
                'name' => 'Guaraná Antarctica 2L',
                'price' => 8.90,
                'cost_price' => 6.00,
                'current_stock' => 100,
                'min_stock' => 50,
                'featured' => false,
                'initial_stock' => 100
            ],
            [
                'category_id' => 7,
                'name' => 'Fanta Laranja 2L',
                'price' => 8.90,
                'cost_price' => 6.00,
                'current_stock' => 80,
                'min_stock' => 40,
                'featured' => false,
                'initial_stock' => 80
            ],

            // Sucos
            [
                'category_id' => 8,
                'name' => 'Del Valle Uva 1L',
                'price' => 7.90,
                'cost_price' => 5.00,
                'current_stock' => 60,
                'min_stock' => 30,
                'featured' => false,
                'initial_stock' => 60
            ],
            [
                'category_id' => 8,
                'name' => 'Suco Natural One Laranja 1.5L',
                'price' => 14.90,
                'cost_price' => 10.00,
                'current_stock' => 40,
                'min_stock' => 20,
                'featured' => true,
                'initial_stock' => 40
            ],

            // PRODUTOS EM OFERTA
            [
                'category_id' => 1,
                'name' => 'Cerveja Heineken Lata 350ml - Pack 12 Unidades',
                'price' => 52.90,
                'original_price' => 65.90,
                'cost_price' => 42.00,
                'current_stock' => 50,
                'min_stock' => 10,
                'featured' => true,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 50
            ],
            [
                'category_id' => 6,
                'name' => 'Vodka Smirnoff 1L',
                'price' => 89.90,
                'original_price' => 120.00,
                'cost_price' => 70.00,
                'current_stock' => 30,
                'min_stock' => 5,
                'featured' => true,
                'popular' => false,
                'offers' => true,
                'initial_stock' => 30
            ],
            [
                'category_id' => 6,
                'name' => 'Whisky Johnnie Walker Red Label 1L',
                'price' => 149.90,
                'original_price' => 199.90,
                'cost_price' => 120.00,
                'current_stock' => 25,
                'min_stock' => 5,
                'featured' => true,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 25
            ],
            [
                'category_id' => 1,
                'name' => 'Cerveja Corona Extra 355ml - Pack 6 Unidades',
                'price' => 45.90,
                'original_price' => 58.90,
                'cost_price' => 35.00,
                'current_stock' => 40,
                'min_stock' => 10,
                'featured' => false,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 40
            ],
            [
                'category_id' => 6,
                'name' => 'Gin Bombay Sapphire 750ml',
                'price' => 129.90,
                'original_price' => 169.90,
                'cost_price' => 100.00,
                'current_stock' => 20,
                'min_stock' => 5,
                'featured' => true,
                'popular' => false,
                'offers' => true,
                'initial_stock' => 20
            ],
            [
                'category_id' => 1,
                'name' => 'Cerveja Stella Artois 330ml - Pack 12 Unidades',
                'price' => 68.90,
                'original_price' => 85.90,
                'cost_price' => 55.00,
                'current_stock' => 35,
                'min_stock' => 10,
                'featured' => true,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 35
            ],
            [
                'category_id' => 6,
                'name' => 'Rum Havana Club 7 Anos 1L',
                'price' => 79.90,
                'original_price' => 99.90,
                'cost_price' => 60.00,
                'current_stock' => 28,
                'min_stock' => 5,
                'featured' => false,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 28
            ],
            [
                'category_id' => 1,
                'name' => 'Cerveja Budweiser 350ml - Pack 24 Unidades',
                'price' => 89.90,
                'original_price' => 115.90,
                'cost_price' => 70.00,
                'current_stock' => 60,
                'min_stock' => 15,
                'featured' => true,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 60
            ],
            [
                'category_id' => 6,
                'name' => 'Tequila Jose Cuervo Especial 750ml',
                'price' => 95.90,
                'original_price' => 125.90,
                'cost_price' => 75.00,
                'current_stock' => 22,
                'min_stock' => 5,
                'featured' => true,
                'popular' => false,
                'offers' => true,
                'initial_stock' => 22
            ],
            [
                'category_id' => 1,
                'name' => 'Cerveja Brahma 350ml - Pack 12 Unidades',
                'price' => 32.90,
                'original_price' => 42.90,
                'cost_price' => 25.00,
                'current_stock' => 80,
                'min_stock' => 20,
                'featured' => false,
                'popular' => true,
                'offers' => true,
                'initial_stock' => 80
            ]
        ];

        // Criar produtos e suas movimentações iniciais
        $createdProducts = [];
        foreach ($products as $productData) {
            $initialStock = $productData['initial_stock'];
            unset($productData['initial_stock']);

            $product = Product::create([
                'category_id' => $productData['category_id'],
                'name' => $productData['name'],
                'slug' => Str::slug($productData['name']),
                'description' => $productData['name'],
                'price' => $productData['price'],
                'original_price' => $productData['original_price'] ?? null,
                'cost_price' => $productData['cost_price'],
                'current_stock' => $productData['current_stock'],
                'min_stock' => $productData['min_stock'],
                'sku' => Str::upper(Str::random(8)),
                'is_active' => true,
                'featured' => $productData['featured'] ?? false,
                'offers' => $productData['offers'] ?? false,
                'popular' => $productData['popular'] ?? false,
                'images' => []
            ]);

            $createdProducts[] = $product;

            // Criar movimentação inicial de estoque
            StockMovement::create([
                'product_id' => $product->id,
                'user_id' => $admin->id,
                'type' => 'entrada',
                'quantity' => $initialStock,
                'description' => 'Estoque inicial',
                'unit_cost' => $productData['cost_price']
            ]);

            // Se o estoque atual for diferente do inicial, criar uma movimentação de saída
            if ($initialStock != $productData['current_stock']) {
                $saidaQuantity = $initialStock - $productData['current_stock'];
                
                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $employee->id,
                    'type' => 'saida',
                    'quantity' => $saidaQuantity,
                    'description' => 'Vendas realizadas',
                ]);
            }
        }

        // Criar alguns pedidos
        $statuses = ['pending', 'delivering', 'completed', 'cancelled'];
        $paymentMethods = ['dinheiro', 'cartão de crédito', 'cartão de débito', 'pix'];

        // Gerar pedidos recentes (últimos 7 dias), garantindo maioria concluída para alimentar relatórios
        for ($i = 0; $i < 24; $i++) {
            $customer = $customers[array_rand($customers)];
            // 70% completed, 20% pending, 10% delivering
            $statusRoll = rand(1, 100);
            if ($statusRoll <= 70) {
                $status = 'completed';
            } elseif ($statusRoll <= 90) {
                $status = 'pending';
            } else {
                $status = 'delivering';
            }
            // Distribuir métodos com mais peso em PIX e Cartão Crédito
            $pmRoll = rand(1, 100);
            if ($pmRoll <= 45) $paymentMethod = 'pix';
            elseif ($pmRoll <= 75) $paymentMethod = 'cartão de crédito';
            elseif ($pmRoll <= 95) $paymentMethod = 'cartão de débito';
            else $paymentMethod = 'dinheiro';
            
            // Buscar endereço do cliente (ou criar um se não existir)
            $customerAddress = Address::where('user_id', $customer->id)->first();
            if (!$customerAddress) {
                $customerAddress = Address::create([
                    'user_id' => $customer->id,
                    'name' => 'Endereço Principal',
                    'street' => 'Rua Exemplo',
                    'number' => '123',
                    'neighborhood' => 'Centro',
                    'city' => 'São Paulo',
                    'state' => 'SP',
                    'zipcode' => '01234-567',
                    'is_default' => true,
                    'is_active' => true
                ]);
            }
            
            // Criar pedido
            $orderNumber = date('Ymd') . str_pad($i + 1, 4, '0', STR_PAD_LEFT);
            $order = Order::create([
                'user_id' => $customer->id,
                'order_number' => $orderNumber,
                'status' => $status,
                'total' => 0, // Será calculado após adicionar os itens
                'delivery_address_id' => $customerAddress->id,
                'delivery_notes' => 'Entrega padrão'
            ]);

            // Adicionar 1-5 itens aleatórios ao pedido
            $numItems = rand(1, 5);
            $total = 0;

            for ($j = 0; $j < $numItems; $j++) {
                $product = $createdProducts[array_rand($createdProducts)];
                $quantity = rand(1, 3);
                $subtotal = $product->price * $quantity;
                $total += $subtotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'price' => $product->price,
                    'subtotal' => $subtotal
                ]);
            }

            // Atualizar o total do pedido
            $order->update(['total' => $total]);

            // Criar pagamento
            Payment::create([
                'order_id' => $order->id,
                'amount' => $total,
                'payment_method' => $paymentMethod,
                'status' => $status === 'cancelled' ? 'failed' : 'completed'
            ]);

            // Definir data aleatória nos últimos 7 dias
            $date = now()->subDays(rand(0, 6))->setTime(rand(9, 22), rand(0, 59), 0);
            $order->created_at = $date;
            $order->updated_at = $date;
            $order->save();
        }

        // Criar movimentações de estoque para os gráficos
        for ($i = 0; $i < 15; $i++) {
            $product = $createdProducts[array_rand($createdProducts)];
            $quantity = rand(1, 10);
            $type = rand(0, 1) ? 'entrada' : 'saida';
            $date = now()->subDays(rand(0, 6))->setTime(rand(8, 18), rand(0, 59), 0);
            
            StockMovement::create([
                'product_id' => $product->id,
                'type' => $type,
                'quantity' => $quantity,
                'description' => $type === 'entrada' ? 'Compra' : 'Venda',
                'created_at' => $date,
                'updated_at' => $date
            ]);
        }

        // Criar dados de novos clientes para os gráficos
        for ($i = 0; $i < 10; $i++) {
            $date = now()->subDays(rand(0, 6));
            User::create([
                'name' => 'Cliente Teste ' . ($i + 1),
                'email' => 'cliente' . ($i + 1) . '@teste.com',
                'password' => bcrypt('password'),
                'created_at' => $date,
                'updated_at' => $date
            ]);
        }

    }
}