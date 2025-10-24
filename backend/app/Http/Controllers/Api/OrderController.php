<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Address;
use App\Models\User;
use App\Models\DeliveryZone;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $query = Order::with(['items.product', 'user', 'payment', 'deliveryAddress']);

        // Filtros
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Busca por número do pedido ou nome do cliente
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Ordenação
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Paginação
        $perPage = $request->get('per_page', 15);
        $orders = $query->paginate($perPage);

        Log::info('OrderController@index - Orders found: ' . $orders->total());

        return response()->json([
            'data' => $orders->items(),
            'total' => $orders->total(),
            'current_page' => $orders->currentPage(),
            'per_page' => $orders->perPage(),
            'last_page' => $orders->lastPage()
        ]);
    }

    public function myOrders(Request $request)
    {
        $query = Order::with(['items.product', 'payment', 'deliveryAddress'])
            ->where('user_id', Auth::id());

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->latest()->get();
        return response()->json($orders);
    }

    public function store(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.sale_type' => 'required|in:dose,garrafa',
            'payment_method' => 'required|in:dinheiro,cartão de débito,cartão de crédito,pix',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:20',
            'delivery' => 'nullable|array',
            'delivery.address' => 'nullable|string|max:255',
            'delivery.number' => 'nullable|string|max:20',
            'delivery.complement' => 'nullable|string|max:255',
            'delivery.neighborhood' => 'nullable|string|max:255',
            'delivery.city' => 'nullable|string|max:255',
            'delivery.state' => 'nullable|string|max:2',
            'delivery.zipcode' => 'nullable|string|max:10',
            'delivery.phone' => 'nullable|string|max:20',
            'delivery.instructions' => 'nullable|string|max:500'
        ]);

        try {
            DB::beginTransaction();

            // Criar pedido
            $orderData = [
                'user_id' => Auth::id(),
                'order_number' => date('Ymd') . str_pad(Order::count() + 1, 4, '0', STR_PAD_LEFT),
                'status' => 'pending',
                'total' => 0 // Será calculado depois
            ];

            // Criar ou usar endereço
            $deliveryAddressId = null;
            if ($request->has('delivery') && is_array($request->delivery)) {
                $delivery = $request->delivery;
                
                // Se é um endereço salvo (tem ID)
                if (isset($delivery['address_id']) && $delivery['address_id']) {
                    $deliveryAddressId = $delivery['address_id'];
                } else {
                    // Criar novo endereço
                    $address = Address::create([
                        'user_id' => Auth::id(),
                        'name' => $delivery['name'] ?? 'Endereço de Entrega',
                        'street' => $delivery['address'] ?? '',
                        'number' => $delivery['number'] ?? '',
                        'complement' => $delivery['complement'] ?? null,
                        'neighborhood' => $delivery['neighborhood'] ?? '',
                        'city' => $delivery['city'] ?? '',
                        'state' => $delivery['state'] ?? '',
                        'zipcode' => $delivery['zipcode'] ?? '',
                        'notes' => $delivery['instructions'] ?? null,
                        'is_default' => false,
                        'is_active' => true
                    ]);
                    $deliveryAddressId = $address->id;
                }
                
                $orderData['delivery_address_id'] = $deliveryAddressId;
                $orderData['delivery_notes'] = $delivery['instructions'] ?? null;
            }

            $order = Order::create($orderData);

            $total = 0;

            // Adicionar itens
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $saleType = $item['sale_type'] ?? 'garrafa';
                
                // Verificar disponibilidade baseada no tipo de venda
                if ($saleType === 'garrafa') {
                    $currentStock = (int) $product->current_stock;
                    if ($currentStock < $item['quantity']) {
                        throw new \Exception("Produto {$product->name} não possui estoque suficiente de garrafas");
                    }
                } else {
                    // Para doses, verificar se há garrafas suficientes para converter
                    $dosesNecessarias = $item['quantity'];
                    $garrafasNecessarias = ceil($dosesNecessarias / $product->doses_por_garrafa);
                    $currentStock = (int) $product->current_stock;
                    
                    if ($currentStock < $garrafasNecessarias) {
                        throw new \Exception("Produto {$product->name} não possui garrafas suficientes para as doses solicitadas");
                    }
                }

                $subtotal = $product->price * $item['quantity'];
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'sale_type' => $saleType,
                    'price' => $product->price,
                    'subtotal' => $subtotal
                ]);

                // Usar a nova lógica de atualização de estoque
                $product->atualizarEstoquePorVenda($item['quantity'], $saleType);
                
                // Registrar movimentação de estoque
                $unitPrice = $saleType === 'dose' ? $product->dose_price : $product->price;
                $product->stockMovements()->create([
                    'user_id' => Auth::id(),
                    'type' => 'saida',
                    'quantity' => $item['quantity'],
                    'description' => "Venda ({$saleType}) - Pedido #" . $order->order_number,
                    'unit_cost' => $unitPrice
                ]);

                $total += $subtotal;
            }

            // Calcular frete baseado no bairro
            $frete = 0;
            if ($request->has('delivery') && isset($delivery['neighborhood'])) {
                $deliveryZone = DeliveryZone::ativo()
                    ->where('nome_bairro', 'LIKE', '%' . $delivery['neighborhood'] . '%')
                    ->first();
                
                if ($deliveryZone) {
                    $frete = $deliveryZone->valor_frete;
                }
            }

            // Atualizar total do pedido (subtotal + frete)
            $order->update(['total' => $total + $frete]);

            // Criar pagamento
            $order->payment()->create([
                'amount' => $total + $frete,
                'payment_method' => $request->payment_method,
                'status' => 'completed'
            ]);

            DB::commit();

            return response()->json(
                $order->load(['items.product', 'user', 'payment']),
                201
            );

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function createManualOrder(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.sale_type' => 'required|in:dose,garrafa',
            'payment_method' => 'required|in:dinheiro,cartão de débito,cartão de crédito,pix',
            'customer_name' => 'required|string|max:255',
            'customer_phone' => 'nullable|string|max:20',
            'customer_email' => 'nullable|email|max:255',
            'customer_document' => 'nullable|string|max:20',
            'delivery' => 'nullable|array',
            'delivery.address' => 'nullable|string|max:255',
            'delivery.number' => 'nullable|string|max:20',
            'delivery.complement' => 'nullable|string|max:255',
            'delivery.neighborhood' => 'nullable|string|max:255',
            'delivery.city' => 'nullable|string|max:255',
            'delivery.state' => 'nullable|string|max:2',
            'delivery.zipcode' => 'nullable|string|max:10',
            'delivery.phone' => 'nullable|string|max:20',
            'delivery.instructions' => 'nullable|string|max:500',
            'received_amount' => 'nullable|numeric|min:0',
            'change_amount' => 'nullable|numeric|min:0'
        ]);

        try {
            DB::beginTransaction();

            // Buscar ou criar cliente
            $customer = null;
            if ($request->customer_email) {
                $customer = User::where('email', $request->customer_email)->first();
            }

            if (!$customer && $request->customer_document) {
                $customer = User::where('document_number', $request->customer_document)->first();
            }

            if (!$customer) {
                // Criar novo cliente
                $customer = User::create([
                    'name' => $request->customer_name,
                    'email' => $request->customer_email ?? 'cliente@temp.com',
                    'phone' => $request->customer_phone,
                    'document_number' => $request->customer_document,
                    'type' => 'customer',
                    'is_active' => true,
                    'password' => bcrypt('temp123') // Senha temporária
                ]);
            }

            // Criar pedido
            $orderData = [
                'user_id' => $customer->id,
                'order_number' => date('Ymd') . str_pad(Order::count() + 1, 4, '0', STR_PAD_LEFT),
                'status' => 'pending',
                'total' => 0 // Será calculado depois
            ];

            // Criar ou usar endereço
            $deliveryAddressId = null;
            if ($request->has('delivery') && is_array($request->delivery)) {
                $delivery = $request->delivery;
                
                // Se é um endereço salvo (tem ID)
                if (isset($delivery['address_id']) && $delivery['address_id']) {
                    $deliveryAddressId = $delivery['address_id'];
                } else {
                    // Criar novo endereço
                    $address = Address::create([
                        'user_id' => $customer->id,
                        'name' => $delivery['name'] ?? 'Endereço de Entrega',
                        'street' => $delivery['address'] ?? '',
                        'number' => $delivery['number'] ?? '',
                        'complement' => $delivery['complement'] ?? null,
                        'neighborhood' => $delivery['neighborhood'] ?? '',
                        'city' => $delivery['city'] ?? '',
                        'state' => $delivery['state'] ?? '',
                        'zipcode' => $delivery['zipcode'] ?? '',
                        'notes' => $delivery['instructions'] ?? null,
                        'is_default' => false,
                        'is_active' => true
                    ]);
                    $deliveryAddressId = $address->id;
                }
                
                $orderData['delivery_address_id'] = $deliveryAddressId;
                $orderData['delivery_notes'] = $delivery['instructions'] ?? null;
            }

            $order = Order::create($orderData);

            $total = 0;

            // Adicionar itens
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $saleType = $item['sale_type'] ?? 'garrafa';
                
                // Verificar disponibilidade baseada no tipo de venda
                if ($saleType === 'garrafa') {
                    $currentStock = (int) $product->current_stock;
                    if ($currentStock < $item['quantity']) {
                        throw new \Exception("Produto {$product->name} não possui estoque suficiente de garrafas");
                    }
                } else {
                    // Para doses, verificar se há garrafas suficientes para converter
                    $dosesNecessarias = $item['quantity'];
                    $garrafasNecessarias = ceil($dosesNecessarias / $product->doses_por_garrafa);
                    $currentStock = (int) $product->current_stock;
                    
                    if ($currentStock < $garrafasNecessarias) {
                        throw new \Exception("Produto {$product->name} não possui garrafas suficientes para as doses solicitadas");
                    }
                }

                $subtotal = $product->price * $item['quantity'];
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'sale_type' => $saleType,
                    'price' => $product->price,
                    'subtotal' => $subtotal
                ]);

                // Usar a nova lógica de atualização de estoque
                $product->atualizarEstoquePorVenda($item['quantity'], $saleType);
                
                // Registrar movimentação de estoque
                $unitPrice = $saleType === 'dose' ? $product->dose_price : $product->price;
                $product->stockMovements()->create([
                    'user_id' => Auth::id(),
                    'type' => 'saida',
                    'quantity' => $item['quantity'],
                    'description' => "Venda Manual ({$saleType}) - Pedido #" . $order->order_number,
                    'unit_cost' => $unitPrice
                ]);

                $total += $subtotal;
            }

            // Calcular frete baseado no bairro
            $frete = 0;
            if ($request->has('delivery') && isset($delivery['neighborhood'])) {
                $deliveryZone = DeliveryZone::ativo()
                    ->where('nome_bairro', 'LIKE', '%' . $delivery['neighborhood'] . '%')
                    ->first();
                
                if ($deliveryZone) {
                    $frete = $deliveryZone->valor_frete;
                }
            }

            // Atualizar total do pedido (subtotal + frete)
            $order->update(['total' => $total + $frete]);

            // Criar pagamento
            $paymentData = [
                'amount' => $total + $frete,
                'payment_method' => $request->payment_method,
                'status' => 'completed'
            ];

            if ($request->received_amount) {
                $paymentData['received_amount'] = $request->received_amount;
            }

            if ($request->change_amount) {
                $paymentData['change_amount'] = $request->change_amount;
            }

            $order->payment()->create($paymentData);

            DB::commit();

            return response()->json([
                'order' => $order->load(['items.product', 'user', 'payment', 'deliveryAddress']),
                'customer' => $customer,
                'received_amount' => $request->received_amount,
                'change_amount' => $request->change_amount
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function show(Order $order)
    {
        return response()->json($order->load(['items.product', 'user', 'payment', 'deliveryAddress']));
    }

    public function searchCustomers(Request $request)
    {
        try {
            $request->validate([
                'search' => 'required|string|min:2'
            ]);

            $searchTerm = $request->search;
            
            $customers = User::where('type', 'customer')
                ->where('is_active', true)
                ->where(function($query) use ($searchTerm) {
                    $query->where('name', 'like', "%{$searchTerm}%")
                          ->orWhere('email', 'like', "%{$searchTerm}%")
                          ->orWhere('phone', 'like', "%{$searchTerm}%")
                          ->orWhere('document_number', 'like', "%{$searchTerm}%");
                })
                ->with(['addresses' => function($query) {
                    $query->where('is_active', true)->orderBy('is_default', 'desc');
                }])
                ->limit(10)
                ->get();

            return response()->json([
                'customers' => $customers->map(function($customer) {
                    return [
                        'id' => $customer->id,
                        'name' => $customer->name ?? '',
                        'email' => $customer->email ?? '',
                        'phone' => $customer->phone ?? '',
                        'document_number' => $customer->document_number ?? '',
                        'addresses' => $customer->addresses->map(function($address) {
                            return [
                                'id' => $address->id,
                                'name' => $address->name ?? '',
                                'full_address' => $address->full_address ?? '',
                                'short_address' => $address->short_address ?? '',
                                'is_default' => $address->is_default ?? false
                            ];
                        })
                    ];
                })
            ]);
        } catch (\Exception $e) {
            Log::error('Erro ao buscar clientes: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erro interno do servidor',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function createQuickCustomer(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'document_number' => 'nullable|string|max:20',
            'address' => 'nullable|array',
            'address.name' => 'required_with:address|string|max:255',
            'address.street' => 'required_with:address|string|max:255',
            'address.number' => 'required_with:address|string|max:20',
            'address.complement' => 'nullable|string|max:255',
            'address.neighborhood' => 'required_with:address|string|max:255',
            'address.city' => 'required_with:address|string|max:255',
            'address.state' => 'required_with:address|string|max:2',
            'address.zipcode' => 'nullable|string|max:10',
            'address.notes' => 'nullable|string|max:500'
        ]);

        // Verificar se já existe cliente com mesmo email ou documento
        $existingCustomer = null;
        if ($request->email) {
            $existingCustomer = User::where('email', $request->email)->where('type', 'customer')->first();
        }
        
        if (!$existingCustomer && $request->document_number) {
            $existingCustomer = User::where('document_number', $request->document_number)->where('type', 'customer')->first();
        }

        if ($existingCustomer) {
            return response()->json([
                'message' => 'Cliente já existe',
                'customer' => [
                    'id' => $existingCustomer->id,
                    'name' => $existingCustomer->name,
                    'email' => $existingCustomer->email,
                    'phone' => $existingCustomer->phone,
                    'document_number' => $existingCustomer->document_number,
                    'addresses' => []
                ]
            ], 409);
        }

        // Criar novo cliente
        $customer = User::create([
            'name' => $request->name,
            'email' => $request->email ?? 'cliente@temp.com',
            'phone' => $request->phone,
            'document_number' => $request->document_number,
            'type' => 'customer',
            'is_active' => true,
            'password' => bcrypt('temp123') // Senha temporária
        ]);

        $addresses = [];
        
        // Criar endereço se fornecido
        if ($request->address) {
            $address = \App\Models\Address::create([
                'user_id' => $customer->id,
                'name' => $request->address['name'],
                'street' => $request->address['street'],
                'number' => $request->address['number'],
                'complement' => $request->address['complement'] ?? null,
                'neighborhood' => $request->address['neighborhood'],
                'city' => $request->address['city'],
                'state' => $request->address['state'],
                'zipcode' => $request->address['zipcode'] ?? null,
                'notes' => $request->address['notes'] ?? null,
                'is_default' => true,
                'is_active' => true
            ]);
            
            $addresses = [[
                'id' => $address->id,
                'name' => $address->name,
                'full_address' => $address->full_address,
                'short_address' => $address->short_address,
                'is_default' => $address->is_default
            ]];
        }

        return response()->json([
            'message' => 'Cliente criado com sucesso',
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'document_number' => $customer->document_number,
                'addresses' => $addresses
            ]
        ], 201);
    }

    public function updateStatus(Request $request, Order $order)
    {
        $request->validate([
            'status' => 'required|in:pending,delivering,completed,cancelled'
        ]);

        $order->status = $request->status;
        $order->save();

        // Se o pedido for cancelado, estornar o estoque
        if ($request->status === 'cancelled') {
            foreach ($order->items as $item) {
                $saleType = $item->sale_type ?? 'garrafa';
                
                if ($saleType === 'garrafa') {
                    // Estorno direto de garrafas
                    $item->product->increment('current_stock', $item->quantity);
                } else {
                    // Para doses, reverter a lógica
                    // Calcular quantas garrafas foram deduzidas
                    $garrafasDeduzidas = floor($item->quantity / $item->product->doses_por_garrafa);
                    if ($garrafasDeduzidas > 0) {
                        $item->product->increment('current_stock', $garrafasDeduzidas);
                    }
                    
                    // Zerar o contador de doses vendidas
                    $item->product->update(['doses_vendidas' => 0]);
                }
                
                // Registrar movimentação de estoque
                $unitPrice = $saleType === 'dose' ? $item->product->dose_price : $item->product->price;
                $item->product->stockMovements()->create([
                    'user_id' => Auth::id(),
                    'type' => 'entrada',
                    'quantity' => $saleType === 'garrafa' ? $item->quantity : ($garrafasDeduzidas ?? 0),
                    'description' => "Estorno ({$saleType}) - Pedido #" . $order->order_number . ' cancelado',
                    'unit_cost' => $unitPrice
                ]);
            }

            // Atualizar status do pagamento
            if ($order->payment) {
                $order->payment->update(['status' => 'failed']);
            }
        }

        return response()->json($order->load(['items.product', 'user', 'payment']));
    }

    /**
     * Calculate delivery fee for a specific neighborhood
     */
    public function calculateFrete(Request $request)
    {
        $validated = $request->validate([
            'bairro' => 'required|string'
        ]);

        $deliveryZone = DeliveryZone::ativo()
            ->where('nome_bairro', 'LIKE', '%' . $validated['bairro'] . '%')
            ->first();

        if (!$deliveryZone) {
            return response()->json([
                'error' => 'Bairro não encontrado',
                'message' => 'Entre em contato para verificar disponibilidade',
                'valor_frete' => null,
                'tempo_estimado' => null
            ], 404);
        }

        return response()->json([
            'valor_frete' => $deliveryZone->valor_frete,
            'tempo_estimado' => $deliveryZone->tempo_estimado,
            'nome_bairro' => $deliveryZone->nome_bairro
        ]);
    }
}