<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Product;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\CashSession;
use App\Models\CashTransaction;
use App\Models\Setting;
use App\Models\Combo;
use Illuminate\Support\Facades\Hash;

class CriticalFlowsTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;
    protected $employee;
    protected $cashSession;
    protected $category;

    protected function setUp(): void
    {
        parent::setUp();

        // Criar Admin
        $this->admin = User::create([
            'name' => 'Admin Teste',
            'email' => 'admin@teste.com',
            'password' => Hash::make('password'),
            'type' => 'admin',
            'is_active' => true,
        ]);

        // Criar Funcionário
        $this->employee = User::create([
            'name' => 'Funcionário Teste',
            'email' => 'funcionario@teste.com',
            'password' => Hash::make('password'),
            'type' => 'employee',
            'is_active' => true,
        ]);

        // Criar Categoria
        $this->category = Category::create([
            'name' => 'Bebidas',
            'slug' => 'bebidas',
            'is_active' => true,
        ]);

        // Criar CashSession (Caixa Aberto) para o funcionário
        $this->cashSession = CashSession::create([
            'opened_by' => $this->employee->id,
            'opened_at' => now(),
            'initial_amount' => 100.00,
            'is_open' => true,
        ]);

        // Criar Setting para loja aberta
        Setting::create([
            'key' => 'is_store_open',
            'value' => ['is_open' => true],
        ]);
    }

    /**
     * Teste de Estoque Unitário
     * 
     * Cria um produto "Coca Lata" com estoque 100.
     * Simula uma venda de 5 unidades.
     * Marca como completed.
     * Verifica se o estoque caiu para 95.
     */
    public function test_estoque_unitario_ao_vender_produto(): void
    {
        // Criar produto "Coca Lata" com estoque 100
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Coca Lata',
            'slug' => 'coca-lata',
            'price' => 5.00,
            'cost_price' => 2.50,
            'current_stock' => 100,
            'is_active' => true,
        ]);

        // Verificar estoque inicial
        $this->assertEquals(100, $product->fresh()->current_stock);

        // Simular venda de 5 unidades (autenticado como funcionário)
        $response = $this->actingAs($this->employee, 'sanctum')
            ->postJson('/api/orders', [
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 5,
                        'sale_type' => 'garrafa',
                    ]
                ],
                'payment_method' => 'dinheiro',
                'status' => 'completed',
                'payment_status' => 'completed',
            ]);

        // Verificar se a venda foi criada com sucesso
        $response->assertStatus(201);
        $order = Order::latest()->first();
        $this->assertNotNull($order);
        $this->assertEquals('completed', $order->status);

        // Verificar se o estoque caiu para 95
        $product->refresh();
        $this->assertEquals(95, $product->current_stock, 'O estoque deveria ter caído de 100 para 95 após vender 5 unidades');
    }

    /**
     * Teste de Pack/Caixa (Lógica de Pai/Filho)
     * 
     * Cria um Produto Pai "Skol Lata" com estoque 120.
     * Cria um Produto Filho "Fardo Skol" com parent_id do Pai e multiplier = 12.
     * Simula a venda de 2 Fardos.
     * Verifica se o estoque da "Skol Lata" (Pai) caiu de 120 para 96 (120 - 24).
     */
    public function test_estoque_pack_caixa_lógica_pai_filho(): void
    {
        // Criar Produto Pai "Skol Lata" com estoque 120
        $parentProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Skol Lata',
            'slug' => 'skol-lata',
            'price' => 3.50,
            'cost_price' => 1.75,
            'current_stock' => 120,
            'is_active' => true,
        ]);

        // Criar Produto Filho "Fardo Skol" com parent_id do Pai e multiplier = 12
        $packProduct = Product::create([
            'category_id' => $this->category->id,
            'parent_product_id' => $parentProduct->id,
            'stock_multiplier' => 12,
            'name' => 'Fardo Skol',
            'slug' => 'fardo-skol',
            'price' => 40.00, // Preço do fardo (12 latas)
            'cost_price' => 20.00,
            'current_stock' => 0, // Pack não tem estoque próprio
            'is_active' => true,
        ]);

        // Verificar estoque inicial do pai
        $this->assertEquals(120, $parentProduct->fresh()->current_stock);

        // Simular venda de 2 Fardos (autenticado como funcionário)
        $response = $this->actingAs($this->employee, 'sanctum')
            ->postJson('/api/orders', [
                'items' => [
                    [
                        'product_id' => $packProduct->id,
                        'quantity' => 2,
                        'sale_type' => 'garrafa',
                    ]
                ],
                'payment_method' => 'dinheiro',
                'status' => 'completed',
                'payment_status' => 'completed',
            ]);

        // Verificar se a venda foi criada com sucesso
        $response->assertStatus(201);
        $order = Order::latest()->first();
        $this->assertNotNull($order);
        $this->assertEquals('completed', $order->status);

        // Verificar se o estoque do produto pai caiu de 120 para 96 (120 - 24)
        // 2 fardos x 12 unidades = 24 unidades descontadas
        $parentProduct->refresh();
        $this->assertEquals(96, $parentProduct->current_stock, 'O estoque do produto pai deveria ter caído de 120 para 96 após vender 2 fardos (24 unidades)');
    }

    /**
     * Teste Financeiro (Caixa)
     * 
     * Verifica se, após completar a venda, foi criada uma linha na tabela cash_transactions.
     * Verifica se o valor da transação bate com o valor do pedido.
     */
    public function test_transacao_caixa_ao_completar_venda(): void
    {
        // Criar produto para venda
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Produto Teste',
            'slug' => 'produto-teste',
            'price' => 10.00,
            'cost_price' => 5.00,
            'current_stock' => 50,
            'is_active' => true,
        ]);

        // Contar transações antes
        $transactionsBefore = CashTransaction::count();

        // Simular venda (autenticado como funcionário)
        $response = $this->actingAs($this->employee, 'sanctum')
            ->postJson('/api/orders', [
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 2,
                        'sale_type' => 'garrafa',
                    ]
                ],
                'payment_method' => 'dinheiro',
                'status' => 'completed',
                'payment_status' => 'completed',
            ]);

        // Verificar se a venda foi criada com sucesso
        $response->assertStatus(201);
        $order = Order::latest()->first();
        $this->assertNotNull($order);
        $this->assertEquals('completed', $order->status);

        // Verificar se foi criada uma transação de caixa
        $transactionsAfter = CashTransaction::count();
        $this->assertEquals($transactionsBefore + 1, $transactionsAfter, 'Deveria ter sido criada uma transação de caixa');

        // Buscar a transação criada
        $transaction = CashTransaction::latest()->first();
        $this->assertNotNull($transaction);
        $this->assertEquals('entrada', $transaction->type);
        $this->assertEquals($this->cashSession->id, $transaction->cash_session_id);
        $this->assertEquals($this->employee->id, $transaction->created_by);

        // Verificar se o valor da transação bate com o valor do pedido
        $order->refresh();
        $this->assertEquals((float) $order->total, (float) $transaction->amount, 'O valor da transação de caixa deve ser igual ao total do pedido');
    }

    /**
     * Teste de Cancelamento (Estorno)
     * 
     * Pega o pedido criado no teste de estoque unitário.
     * Chama o endpoint de atualizar status para cancelled.
     * Verifica se o estoque da "Coca Lata" voltou para 100.
     */
    public function test_estorno_estoque_ao_cancelar_pedido(): void
    {
        // Criar produto "Coca Lata" com estoque 100
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Coca Lata',
            'slug' => 'coca-lata',
            'price' => 5.00,
            'cost_price' => 2.50,
            'current_stock' => 100,
            'is_active' => true,
        ]);

        // Verificar estoque inicial
        $this->assertEquals(100, $product->fresh()->current_stock);

        // Simular venda de 5 unidades (autenticado como funcionário)
        $response = $this->actingAs($this->employee, 'sanctum')
            ->postJson('/api/orders', [
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 5,
                        'sale_type' => 'garrafa',
                    ]
                ],
                'payment_method' => 'dinheiro',
                'status' => 'completed',
                'payment_status' => 'completed',
            ]);

        // Verificar se a venda foi criada
        $response->assertStatus(201);
        $order = Order::latest()->first();
        $this->assertNotNull($order);

        // Verificar se o estoque caiu para 95
        $product->refresh();
        $this->assertEquals(95, $product->current_stock);

        // Cancelar o pedido (autenticado como funcionário)
        $cancelResponse = $this->actingAs($this->employee, 'sanctum')
            ->patchJson("/api/orders/{$order->id}/status", [
                'status' => 'cancelled',
            ]);

        // Verificar se o cancelamento foi bem-sucedido
        $cancelResponse->assertStatus(200);
        $order->refresh();
        $this->assertEquals('cancelled', $order->status);

        // Verificar se o estoque voltou para 100
        $product->refresh();
        $this->assertEquals(100, $product->current_stock, 'O estoque deveria ter voltado para 100 após cancelar o pedido');
    }

    /**
     * Teste de Venda de Combo
     * 
     * Verifica se a venda de combos está baixando o estoque dos produtos vinculados corretamente.
     */
    public function test_venda_de_combo_baixa_estoque_dos_produtos_vinculados(): void
    {
        // 1. Criar Produtos do Combo
        $vodka = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Vodka Absolut',
            'slug' => 'vodka-absolut',
            'price' => 100.00,
            'cost_price' => 50.00,
            'current_stock' => 10,
            'is_active' => true,
            'visible_online' => true,
        ]);

        $energetico = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Red Bull',
            'slug' => 'red-bull',
            'price' => 10.00,
            'cost_price' => 5.00,
            'current_stock' => 20,
            'is_active' => true,
            'visible_online' => true,
        ]);

        // 2. Criar o Combo
        $combo = Combo::create([
            'name' => 'Kit Festa',
            'slug' => 'kit-festa',
            'description' => '1 Vodka + 6 Red Bulls',
            'price' => 140.00, // Preço promocional
            'is_active' => true,
            'images' => [], // Campo JSON obrigatório
        ]);

        // 3. Vincular Produtos ao Combo (Pivot)
        $combo->products()->attach([
            $vodka->id => [
                'quantity' => 1,
                'sale_type' => 'garrafa'
            ],
            $energetico->id => [
                'quantity' => 6,
                'sale_type' => 'garrafa'
            ]
        ]);

        // Verificar estoque inicial
        $this->assertEquals(10, $vodka->fresh()->current_stock);
        $this->assertEquals(20, $energetico->fresh()->current_stock);

        // 4. Simular Venda do Combo (autenticado como funcionário)
        $response = $this->actingAs($this->employee, 'sanctum')
            ->postJson('/api/orders', [
                'items' => [
                    [
                        'combo_id' => $combo->id,
                        'quantity' => 1, // 1 Kit
                        'sale_type' => 'garrafa',
                    ]
                ],
                'payment_method' => 'dinheiro',
                'status' => 'completed',
                'payment_status' => 'completed',
            ]);

        // Verificar se a venda foi criada com sucesso
        $response->assertStatus(201);
        $order = Order::latest()->first();
        $this->assertNotNull($order);
        $this->assertEquals('completed', $order->status);

        // 5. Verificar Estoque
        // Vodka: 10 - 1 = 9
        $vodka->refresh();
        $this->assertEquals(9, $vodka->current_stock, 'O estoque da Vodka deveria ter caído de 10 para 9 após vender 1 combo');

        // Energético: 20 - 6 = 14
        $energetico->refresh();
        $this->assertEquals(14, $energetico->current_stock, 'O estoque do Red Bull deveria ter caído de 20 para 14 após vender 1 combo (6 unidades)');
    }
}

