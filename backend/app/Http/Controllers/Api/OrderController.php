<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Combo;
use App\Models\Address;
use App\Models\User;
use App\Models\DeliveryZone;
use App\Models\CashSession;
use App\Models\CashTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Services\PrintService;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $query = Order::with([
            'user',
            'items.product',
            'items.combo',
            'delivery_address',
            'payment' => function ($query) {
                // Garantir que received_amount e change_amount sejam selecionados explicitamente
                $query->select(
                    'id',
                    'order_id',
                    'payment_method',
                    'amount',
                    'status',
                    'received_amount',
                    'change_amount',
                    'transaction_id',
                    'qr_code',
                    'expires_at',
                    'created_at',
                    'updated_at'
                );
            }
        ]);
        $user = $request->user();

        // --- CORREÇÃO DE PERMISSÃO ---
        if ($user->type === 'customer') {
            // Clientes SÓ podem ver seus próprios pedidos
            $query->where('user_id', $user->id);
        } elseif ($user->type === 'employee' || $user->type === 'admin') {
            // Funcionários/Admins podem ver todos (ou filtrar por status)
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }
        } else {
            // Se não for nenhum, não retorna nada
            return response()->json(['error' => 'Não autorizado'], 403);
        }

        $orders = $query->orderBy('created_at', 'desc')->paginate(20);
        return response()->json($orders);
    }

    public function myOrders(Request $request)
    {
        $query = Order::with([
            'items.product',
            'items.combo',
            'delivery_address',
            'payment' => function ($query) {
                // Garantir que received_amount e change_amount sejam selecionados explicitamente
                $query->select(
                    'id',
                    'order_id',
                    'payment_method',
                    'amount',
                    'status',
                    'received_amount',
                    'change_amount',
                    'transaction_id',
                    'qr_code',
                    'expires_at',
                    'created_at',
                    'updated_at'
                );
            }
        ])->where('user_id', Auth::id());

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->orderBy('created_at', 'desc')->get();
        return response()->json($orders);
    }

    public function store(Request $request)
    {
        // Debug: Log do payload recebido
        Log::info('Payload recebido no Store:', $request->all());

        // Determinar tipo de pedido baseado no STATUS, não no tipo de usuário
        $requestedStatus = $request->input('status', 'pending');
        $isCompleted = $requestedStatus === 'completed'; // Venda Balcão
        $isPending = $requestedStatus === 'pending'; // Entrega/Delivery
        
        // Verificar se é pedido do Caixa (funcionário/admin) - apenas para transação de caixa
        $user = $request->user();
        $isEmployeeOrAdmin = $user && in_array($user->type, ['employee', 'admin']);

        // Validação simplificada para debug
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.sale_type' => 'required|in:dose,garrafa',
            'payment_method' => 'required|in:dinheiro,cartão de débito,cartão de crédito,pix',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:20',
            'delivery' => 'nullable|array',
            'received_amount' => 'nullable|numeric|min:0',
            'change_amount' => 'nullable|numeric|min:0'
        ]);

        // Validação customizada para garantir que cada item tenha product_id ou combo_id
        foreach ($request->items as $index => $item) {
            if (empty($item['product_id']) && empty($item['combo_id'])) {
                return response()->json([
                    'message' => 'Erro de validação',
                    'errors' => [
                        "items.{$index}" => ['Item deve ter product_id ou combo_id']
                    ]
                ], 422);
            }
            
            if (!empty($item['product_id']) && !empty($item['combo_id'])) {
                return response()->json([
                    'message' => 'Erro de validação',
                    'errors' => [
                        "items.{$index}" => ['Item não pode ter product_id e combo_id ao mesmo tempo']
                    ]
                ], 422);
            }
        }

        try {
            DB::beginTransaction();

            $user = $request->user();

            // Criar pedido
            // Respeitar status enviado pelo frontend (para caixa: completed ou pending)
            $orderData = [
                'user_id' => Auth::id(),
                'order_number' => date('Ymd') . str_pad(Order::count() + 1, 4, '0', STR_PAD_LEFT),
                'status' => in_array($requestedStatus, ['pending', 'completed']) ? $requestedStatus : 'pending',
                'total' => 0 // Será calculado depois
            ];

            // Lógica baseada no STATUS:
            // - status == 'completed' (Balcão): Frete = 0, Endereço opcional
            // - status == 'pending' (Delivery): Endereço obrigatório, validar zona, calcular frete
            $deliveryAddressId = null;
            $deliveryZipcode = null;
            $requiresDelivery = $isPending; // Se for pending, requer entrega
            
            if ($request->has('delivery') && is_array($request->delivery)) {
                $delivery = $request->delivery;
                
                // Se é um endereço salvo (tem ID)
                if (isset($delivery['address_id']) && $delivery['address_id']) {
                    $savedAddress = Address::find($delivery['address_id']);
                    if (!$savedAddress) {
                        if ($requiresDelivery) {
                            DB::rollBack();
                            return response()->json([
                                'error' => 'Endereço não encontrado'
                            ], 404);
                        }
                        // Se não requer entrega, apenas ignora o endereço inválido
                    } else {
                        // Se for cliente, verificar se o endereço pertence a ele
                        // Se for funcionário/admin, pode usar endereço de qualquer cliente
                        if (!$isEmployeeOrAdmin && $savedAddress->user_id !== Auth::id()) {
                            DB::rollBack();
                            return response()->json([
                                'error' => 'Endereço não encontrado ou não pertence ao usuário'
                            ], 404);
                        }
                        $deliveryAddressId = $savedAddress->id;
                        $deliveryZipcode = $savedAddress->zipcode;
                    }
                } else {
                    // Criar novo endereço
                    // Validação de zona de entrega será feita no cálculo do frete (se for pending)
                    // Para completed (balcão), não precisa validar zona
                    if ($requiresDelivery || !empty($delivery['address']) || !empty($delivery['zipcode'])) {
                        // Para funcionário, criar endereço associado ao cliente (se houver user_id no delivery)
                        $addressUserId = $isEmployeeOrAdmin && isset($delivery['user_id']) 
                            ? $delivery['user_id'] 
                            : Auth::id();
                        
                        $address = Address::create([
                            'user_id' => $addressUserId,
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
                        $deliveryZipcode = $address->zipcode;
                    }
                }
                
                // Adicionar endereço ao pedido apenas se existir
                if ($deliveryAddressId) {
                    $orderData['delivery_address_id'] = $deliveryAddressId;
                    $orderData['delivery_notes'] = $delivery['instructions'] ?? null;
                }
            }
            
            // Validação final: Se for pending (entrega), DEVE ter endereço
            // (A validação de zona de entrega será feita no cálculo do frete)
            if ($isPending && !$deliveryAddressId) {
                DB::rollBack();
                return response()->json([
                    'error' => 'Endereço de entrega é obrigatório para pedidos de entrega.'
                ], 422);
            }

            $order = Order::create($orderData);

            $total = 0;

            // Adicionar itens
            foreach ($request->items as $item) {
                // Validar se é produto ou combo
                if (empty($item['product_id']) && empty($item['combo_id'])) {
                    throw new \Exception('Item deve ter product_id ou combo_id');
                }

                if (!empty($item['product_id']) && !empty($item['combo_id'])) {
                    throw new \Exception('Item não pode ter product_id e combo_id ao mesmo tempo');
                }

                if (!empty($item['product_id'])) {
                    // Processar produto individual
                    $product = Product::findOrFail($item['product_id']);
                    $saleType = $item['sale_type'] ?? 'garrafa';
                    
                    // Verificar disponibilidade baseada no tipo de venda
                    if ($saleType === 'garrafa') {
                        $currentStock = (int) $product->current_stock;
                        if ($currentStock < $item['quantity']) {
                            DB::rollBack();
                            return response()->json([
                                'error' => "Estoque insuficiente para {$product->name}. Restam apenas {$currentStock} unidades."
                            ], 400);
                        }
                    } else {
                        // Para doses, verificar se há garrafas suficientes para converter
                        $dosesNecessarias = $item['quantity'];
                        $garrafasNecessarias = ceil($dosesNecessarias / $product->doses_por_garrafa);
                        $currentStock = (int) $product->current_stock;
                        
                        if ($currentStock < $garrafasNecessarias) {
                            DB::rollBack();
                            return response()->json([
                                'error' => "Estoque insuficiente para {$product->name}. Restam apenas {$currentStock} garrafas para as doses solicitadas."
                            ], 400);
                        }
                    }

                    // Usar o preço do item se fornecido (Caixa pode enviar preço customizado), senão usar do produto
                    $itemPrice = isset($item['price']) && $item['price'] > 0 
                        ? (float) $item['price'] 
                        : ($saleType === 'dose' && $product->dose_price ? (float) $product->dose_price : (float) $product->price);
                    
                    $subtotal = $itemPrice * $item['quantity'];
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $product->id,
                        'combo_id' => null,
                        'is_combo' => false,
                        'quantity' => $item['quantity'],
                        'sale_type' => $saleType,
                        'price' => $itemPrice,
                        'subtotal' => $subtotal
                    ]);

                    // Usar a nova lógica de atualização de estoque
                    $product->atualizarEstoquePorVenda($item['quantity'], $saleType);
                    
                    // Registrar movimentação de estoque
                    $unitPrice = $saleType === 'dose' ? $product->dose_price : $itemPrice;
                    $product->stockMovements()->create([
                        'user_id' => Auth::id(),
                        'type' => 'saida',
                        'quantity' => $item['quantity'],
                        'description' => "Venda ({$saleType}) - Pedido #" . $order->order_number,
                        'unit_cost' => $unitPrice
                    ]);

                    $total += $subtotal;

                } else {
                    // Processar combo
                    $combo = Combo::with('products')->findOrFail($item['combo_id']);
                    
                    if (!$combo->is_active) {
                        throw new \Exception("Combo {$combo->name} não está ativo");
                    }

                    // Verificar estoque de todos os produtos do combo
                    foreach ($combo->products as $comboProduct) {
                        $product = $comboProduct;
                        $quantity = $comboProduct->pivot->quantity * $item['quantity'];
                        $saleType = $comboProduct->pivot->sale_type;
                        
                        if ($saleType === 'garrafa') {
                            $currentStock = (int) $product->current_stock;
                            if ($currentStock < $quantity) {
                                DB::rollBack();
                                return response()->json([
                                    'error' => "Estoque insuficiente para {$product->name} do combo {$combo->name}. Restam apenas {$currentStock} unidades."
                                ], 400);
                            }
                        } else {
                            // Para doses, verificar se há garrafas suficientes para converter
                            $dosesNecessarias = $quantity;
                            $garrafasNecessarias = ceil($dosesNecessarias / $product->doses_por_garrafa);
                            $currentStock = (int) $product->current_stock;
                            
                            if ($currentStock < $garrafasNecessarias) {
                                DB::rollBack();
                                return response()->json([
                                    'error' => "Estoque insuficiente para {$product->name} do combo {$combo->name}. Restam apenas {$currentStock} garrafas para as doses solicitadas."
                                ], 400);
                            }
                        }
                    }

                    $subtotal = $combo->price * $item['quantity'];
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => null,
                        'combo_id' => $combo->id,
                        'is_combo' => true,
                        'quantity' => $item['quantity'],
                        'sale_type' => $item['sale_type'] ?? 'garrafa',
                        'price' => $combo->price,
                        'subtotal' => $subtotal
                    ]);

                    // Atualizar estoque de todos os produtos do combo
                    foreach ($combo->products as $comboProduct) {
                        $product = $comboProduct;
                        $quantity = $comboProduct->pivot->quantity * $item['quantity'];
                        $saleType = $comboProduct->pivot->sale_type;
                        
                        // Usar a nova lógica de atualização de estoque
                        $product->atualizarEstoquePorVenda($quantity, $saleType);
                        
                        // Registrar movimentação de estoque
                        $unitPrice = $saleType === 'dose' ? $product->dose_price : $product->price;
                        $product->stockMovements()->create([
                            'user_id' => Auth::id(),
                            'type' => 'saida',
                            'quantity' => $quantity,
                            'description' => "Venda Combo ({$saleType}) - Pedido #" . $order->order_number,
                            'unit_cost' => $unitPrice
                        ]);
                    }

                    $total += $subtotal;
                }
            }

            // Calcular frete baseado no status e endereço
            $frete = 0;
            
            if ($isCompleted) {
                // Venda Balcão: Frete sempre zero
                $frete = 0;
            } elseif ($isPending && $deliveryAddressId) {
                // Entrega: Calcular frete usando o endereço
                $address = Address::find($deliveryAddressId);
                if ($address && $address->zipcode) {
                    $cleanZipcode = preg_replace('/[^0-9]/', '', $address->zipcode);
                    
                    $deliveryZone = DeliveryZone::ativo()
                        ->where('cep_inicio', '<=', $cleanZipcode)
                        ->where('cep_fim', '>=', $cleanZipcode)
                        ->first();
                    
                    if ($deliveryZone) {
                        $frete = (float) $deliveryZone->valor_frete;
                    } else {
                        // Se não encontrou zona de entrega, mas é obrigatório, retornar erro
                        DB::rollBack();
                        return response()->json([
                            'error' => 'Infelizmente não entregamos neste endereço.'
                        ], 422);
                    }
                } else {
                    // Se não tem CEP no endereço e é obrigatório, retornar erro
                    DB::rollBack();
                    return response()->json([
                        'error' => 'Endereço de entrega inválido ou sem CEP.'
                    ], 422);
                }
            } elseif ($isPending) {
                // Se é pending mas não tem endereço, retornar erro
                DB::rollBack();
                return response()->json([
                    'error' => 'Endereço de entrega é obrigatório para pedidos de entrega.'
                ], 422);
            }
            
            // Se o frontend enviou delivery_fee, usar o maior valor (segurança)
            $frontendFrete = (float) $request->input('delivery_fee', 0);
            if ($frontendFrete > $frete) {
                $frete = $frontendFrete;
            }

            // Atualizar total do pedido (subtotal + frete) e salvar o frete
            $order->update([
                'total' => $total + $frete,
                'delivery_fee' => $frete
            ]);

            // Respeitar payment_status enviado pelo frontend (para caixa: completed ou pending)
            $requestedPaymentStatus = $request->input('payment_status', 'pending');
            $paymentData = [
                'amount' => $total + $frete,
                'payment_method' => $request->payment_method,
                'status' => in_array($requestedPaymentStatus, ['pending', 'completed']) ? $requestedPaymentStatus : 'pending'
            ];

            // Incluir received_amount e change_amount se fornecidos
            if ($request->has('received_amount') && $request->received_amount !== null) {
                $paymentData['received_amount'] = $request->received_amount;
            }

            if ($request->has('change_amount') && $request->change_amount !== null) {
                $paymentData['change_amount'] = $request->change_amount;
            }

            $order->payment()->create($paymentData);

            // Se for venda balcão (completed) do Caixa, criar transação de caixa imediatamente
            if ($isEmployeeOrAdmin && $isCompleted) {
                $this->createCashTransactionForOrder($order);
            }

            DB::commit();

            return response()->json(
                $order->load([
                    'items.product',
                    'items.combo',
                    'user',
                    'payment' => function ($query) {
                        // Garantir que received_amount e change_amount sejam selecionados explicitamente
                        $query->select(
                            'id',
                            'order_id',
                            'payment_method',
                            'amount',
                            'status',
                            'received_amount',
                            'change_amount',
                            'created_at',
                            'updated_at'
                        );
                    }
                ]),
                201
            );

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('OrderController@store - Erro ao criar pedido:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $request->all()
            ]);
            return response()->json([
                'message' => 'Erro ao processar pedido: ' . $e->getMessage()
            ], 500);
        }
    }

    public function createManualOrder(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.combo_id' => 'nullable|exists:combos,id',
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
                // Validar se é produto ou combo
                if (empty($item['product_id']) && empty($item['combo_id'])) {
                    throw new \Exception('Item deve ter product_id ou combo_id');
                }

                if (!empty($item['product_id']) && !empty($item['combo_id'])) {
                    throw new \Exception('Item não pode ter product_id e combo_id ao mesmo tempo');
                }

                if (!empty($item['product_id'])) {
                    // Processar produto individual
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
                        'combo_id' => null,
                        'is_combo' => false,
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

                } else {
                    // Processar combo
                    $combo = Combo::with('products')->findOrFail($item['combo_id']);
                    
                    if (!$combo->is_active) {
                        throw new \Exception("Combo {$combo->name} não está ativo");
                    }

                    // Verificar estoque de todos os produtos do combo
                    foreach ($combo->products as $comboProduct) {
                        $product = $comboProduct;
                        $quantity = $comboProduct->pivot->quantity * $item['quantity'];
                        $saleType = $comboProduct->pivot->sale_type;
                        
                        if ($saleType === 'garrafa') {
                            $currentStock = (int) $product->current_stock;
                            if ($currentStock < $quantity) {
                                throw new \Exception("Produto {$product->name} do combo não possui estoque suficiente de garrafas");
                            }
                        } else {
                            // Para doses, verificar se há garrafas suficientes para converter
                            $dosesNecessarias = $quantity;
                            $garrafasNecessarias = ceil($dosesNecessarias / $product->doses_por_garrafa);
                            $currentStock = (int) $product->current_stock;
                            
                            if ($currentStock < $garrafasNecessarias) {
                                throw new \Exception("Produto {$product->name} do combo não possui garrafas suficientes para as doses solicitadas");
                            }
                        }
                    }

                    $subtotal = $combo->price * $item['quantity'];
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => null,
                        'combo_id' => $combo->id,
                        'is_combo' => true,
                        'quantity' => $item['quantity'],
                        'sale_type' => $item['sale_type'] ?? 'garrafa',
                        'price' => $combo->price,
                        'subtotal' => $subtotal
                    ]);

                    // Atualizar estoque de todos os produtos do combo
                    foreach ($combo->products as $comboProduct) {
                        $product = $comboProduct;
                        $quantity = $comboProduct->pivot->quantity * $item['quantity'];
                        $saleType = $comboProduct->pivot->sale_type;
                        
                        // Usar a nova lógica de atualização de estoque
                        $product->atualizarEstoquePorVenda($quantity, $saleType);
                        
                        // Registrar movimentação de estoque
                        $unitPrice = $saleType === 'dose' ? $product->dose_price : $product->price;
                        $product->stockMovements()->create([
                            'user_id' => Auth::id(),
                            'type' => 'saida',
                            'quantity' => $quantity,
                            'description' => "Venda Manual Combo ({$saleType}) - Pedido #" . $order->order_number,
                            'unit_cost' => $unitPrice
                        ]);
                    }

                    $total += $subtotal;
                }
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

            $paymentData = [
                'amount' => $total + $frete,
                'payment_method' => $request->payment_method,
                'status' => 'pending'
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
                'order' => $order->load([
                    'items.product',
                    'items.combo',
                    'user',
                    'delivery_address',
                    'payment' => function ($query) {
                        // Garantir que received_amount e change_amount sejam selecionados explicitamente
                        $query->select(
                            'id',
                            'order_id',
                            'payment_method',
                            'amount',
                            'status',
                            'received_amount',
                            'change_amount',
                            'created_at',
                            'updated_at'
                        );
                    }
                ]),
                'customer' => $customer,
                'received_amount' => $request->received_amount,
                'change_amount' => $request->change_amount
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function show(Request $request, Order $order)
    {
        $user = $request->user();

        // Verificação de segurança
        if (!$user) {
            return response()->json(['error' => 'Não autenticado.'], 401);
        }

        // Se for cliente, só pode ver seus próprios pedidos
        if ($user->type === 'customer' && $order->user_id !== $user->id) {
            return response()->json(['error' => 'Não autorizado.'], 403);
        }

        // Se for funcionário ou admin, pode ver qualquer pedido
        return response()->json($order->load([
            'items.product',
            'items.combo',
            'user',
            'delivery_address',
            'payment' => function ($query) {
                // Garantir que received_amount e change_amount sejam selecionados explicitamente
                $query->select(
                    'id',
                    'order_id',
                    'payment_method',
                    'amount',
                    'status',
                    'received_amount',
                    'change_amount',
                    'transaction_id',
                    'qr_code',
                    'expires_at',
                    'created_at',
                    'updated_at'
                );
            }
        ]));
    }

    /**
     * Imprime um pedido automaticamente via backend
     */
    public function printOrder(Order $order)
    {
        try {
            $printService = new PrintService();
            $copies = 2; // 2 cópias conforme solicitado
            
            $success = $printService->printOrder($order, $copies);
            
            if ($success) {
                return response()->json([
                    'success' => true,
                    'message' => "Pedido #{$order->order_number} enviado para impressão ({$copies} cópias)"
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao enviar pedido para impressão'
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error("Erro ao imprimir pedido #{$order->order_number}: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao imprimir: ' . $e->getMessage()
            ], 500);
        }
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
            'status' => 'required|in:pending,processing,preparing,delivering,completed,cancelled'
        ]);

        $oldStatus = $order->status;
        $order->status = $request->status;
        $order->save();

        // Se o pedido for cancelado, estornar o estoque
        if ($request->status === 'cancelled') {
            try {
                // Carregar itens com relacionamentos necessários
                $order->load(['items.product', 'items.combo.products']);
                
                foreach ($order->items as $item) {
                    if ($item->is_combo) {
                        // Estornar produtos do combo
                        $combo = $item->combo;
                        foreach ($combo->products as $comboProduct) {
                            $product = $comboProduct;
                            $quantity = $comboProduct->pivot->quantity * $item->quantity;
                            $saleType = $comboProduct->pivot->sale_type;
                            
                            if ($saleType === 'garrafa') {
                                // Estorno direto de garrafas
                                $product->increment('current_stock', $quantity);
                            } else {
                                // Para doses, reverter a lógica
                                // Calcular quantas garrafas foram deduzidas
                                $garrafasDeduzidas = floor($quantity / $product->doses_por_garrafa);
                                if ($garrafasDeduzidas > 0) {
                                    $product->increment('current_stock', $garrafasDeduzidas);
                                }
                                
                                // Zerar o contador de doses vendidas
                                $product->update(['doses_vendidas' => 0]);
                            }
                            
                            // Registrar movimentação de estoque
                            $unitPrice = $saleType === 'dose' ? $product->dose_price : $product->price;
                            $product->stockMovements()->create([
                                'user_id' => Auth::id(),
                                'type' => 'entrada',
                                'quantity' => $saleType === 'garrafa' ? $quantity : ($garrafasDeduzidas ?? 0),
                                'description' => "Estorno Combo ({$saleType}) - Pedido #" . $order->order_number . ' cancelado',
                                'unit_cost' => $unitPrice
                            ]);
                        }
                    } else {
                        // Estornar produto individual
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
                }

                // Atualizar status do pagamento (payment é hasMany, pegar o primeiro)
                $payment = $order->payment()->first();
                if ($payment) {
                    $payment->update(['status' => 'failed']);
                }
            } catch (\Exception $e) {
                // Log do erro mas não interrompe o cancelamento
                Log::error('Erro ao estornar estoque ao cancelar pedido #' . $order->order_number . ': ' . $e->getMessage());
                // Continuar o fluxo mesmo se houver erro no estorno
            }
        }

        // Quando o pedido é marcado como completed, criar transação de caixa se necessário
        if ($request->status === 'completed' && $oldStatus !== 'completed') {
            try {
                $this->createCashTransactionForOrder($order);
            } catch (\Exception $e) {
                // Log do erro mas não interrompe a atualização de status
                Log::error('Erro ao criar transação de caixa para pedido #' . $order->order_number . ': ' . $e->getMessage());
            }
        }

        try {
            // --- CORREÇÃO DO BUG 500 ---
            // Recarrega o objeto $order do banco de dados (refresh)
            // e carrega (load) as relações exatas que o frontend espera,
            // incluindo a consulta 'payment' corrigida.
            $order->refresh()->load([
                'user',
                'items.product',
                'items.combo.products', // Carregar produtos do combo também
                'delivery_address',
                'payment' => function ($query) {
                    // Garantir que received_amount e change_amount sejam selecionados explicitamente
                    $query->select(
                        'id',
                        'order_id',
                        'payment_method',
                        'amount',
                        'status',
                        'received_amount',
                        'change_amount',
                        'transaction_id',
                        'qr_code',
                        'expires_at',
                        'created_at',
                        'updated_at'
                    );
                }
            ]);

            // Agora retorna o objeto "limpo" e completo
            return response()->json($order);
        } catch (\Exception $e) {
            // Se houver erro ao carregar relacionamentos, retornar o pedido básico
            Log::error('Erro ao carregar relacionamentos do pedido #' . $order->order_number . ': ' . $e->getMessage());
            
            // Retornar pedido básico sem relacionamentos complexos
            $order->refresh();
            return response()->json([
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'total' => $order->total,
                'delivery_fee' => $order->delivery_fee,
                'created_at' => $order->created_at,
                'updated_at' => $order->updated_at,
                'message' => 'Status atualizado com sucesso. Alguns dados podem não estar disponíveis.'
            ]);
        }
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

    public function confirmDelivery(Order $order)
    {
        // Verificar se o cliente logado é o dono do pedido
        if ($order->user_id !== Auth::id()) {
            return response()->json(['error' => 'Você não tem permissão para confirmar este pedido.'], 403);
        }

        // A regra de negócio: só pode confirmar se estiver "em entrega"
        if ($order->status !== 'delivering') {
            return response()->json(['error' => 'Este pedido não pode ser confirmado. Apenas pedidos em entrega podem ser confirmados.'], 422);
        }

        // Atualiza o status
        $oldStatus = $order->status;
        $order->status = 'completed';
        $order->save();

        // Criar transação de caixa quando o pedido é marcado como completed
        if ($oldStatus !== 'completed') {
            $this->createCashTransactionForOrder($order);
        }

        // Carregar as relações necessárias para retornar o pedido completo
        $order->load(['items.product', 'items.combo', 'delivery_address', 'payment']);

        return response()->json($order);
    }

    /**
     * Cria uma transação de caixa quando um pedido de entrega é marcado como completed
     */
    private function createCashTransactionForOrder(Order $order): void
    {
        try {
            // Verificar se há caixa aberto
            $cashSession = CashSession::where('is_open', true)->latest('opened_at')->first();
            if (!$cashSession) {
                Log::warning("Tentativa de criar transação de caixa para pedido #{$order->order_number}, mas não há caixa aberto");
                return;
            }

            // Verificar se já existe uma transação para este pedido (evitar duplicatas)
            $existingTransaction = CashTransaction::where('cash_session_id', $cashSession->id)
                ->where('description', 'like', "%Pedido #{$order->order_number}%")
                ->first();
            
            if ($existingTransaction) {
                Log::info("Transação de caixa já existe para o pedido #{$order->order_number}");
                return;
            }

            // Recarregar o pedido com o relacionamento payment
            $order->refresh();
            $order->load('payment');

            // Obter o pagamento do pedido (relacionamento hasMany retorna Collection)
            $payment = $order->payment()->first();
            
            if (!$payment) {
                Log::warning("Pedido #{$order->order_number} não possui pagamento associado");
                return;
            }

            // Determinar o tipo de transação baseado no método de pagamento
            $paymentMethod = $payment->payment_method ?? '';
            $amount = (float) $order->total;
            
            // Criar descrição da transação
            $description = "Venda - Pedido #{$order->order_number}";
            if ($paymentMethod === 'dinheiro') {
                $description .= " (Dinheiro)";
            } elseif (in_array($paymentMethod, ['cartão de débito', 'cartão de crédito'])) {
                $description .= " ({$paymentMethod})";
            } elseif ($paymentMethod === 'pix') {
                $description .= " (PIX)";
            }

            // Criar transação de entrada no caixa
            CashTransaction::create([
                'cash_session_id' => $cashSession->id,
                'type' => 'entrada',
                'amount' => $amount,
                'description' => $description,
                'created_by' => Auth::id(),
            ]);

            // Atualizar status do pagamento para completed se ainda não estiver
            if ($payment->status !== 'completed') {
                $payment->status = 'completed';
                $payment->save();
            }

            Log::info("Transação de caixa criada para pedido #{$order->order_number} - Valor: R$ {$amount}");
        } catch (\Exception $e) {
            Log::error("Erro ao criar transação de caixa para pedido #{$order->order_number}: " . $e->getMessage());
            // Não lançar exceção para não quebrar o fluxo de atualização de status
        }
    }
}