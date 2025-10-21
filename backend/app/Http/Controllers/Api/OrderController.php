<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Address;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        Log::info('OrderController@index - Orders found: ' . $orders->count());

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
            ->where('user_id', auth()->id());

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
                'user_id' => auth()->id(),
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
                        'user_id' => auth()->id(),
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
                
                // Checar disponibilidade na coluna única
                $currentStock = (int) $product->current_stock;
                if ($currentStock < $item['quantity']) {
                    throw new \Exception("Produto {$product->name} não possui estoque suficiente");
                }

                $subtotal = $product->price * $item['quantity'];
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'price' => $product->price,
                    'subtotal' => $subtotal
                ]);

                // Atualizar estoque na coluna única
                $product->decrement('current_stock', $item['quantity']);
                
                // Registrar movimentação de estoque
                $product->stockMovements()->create([
                    'user_id' => auth()->id(),
                    'type' => 'saida',
                    'quantity' => $item['quantity'],
                    'description' => 'Venda - Pedido #' . $order->order_number
                ]);

                $total += $subtotal;
            }

            // Atualizar total do pedido
            $order->update(['total' => $total]);

            // Criar pagamento
            $order->payment()->create([
                'amount' => $total,
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

    public function show(Order $order)
    {
        return response()->json($order->load(['items.product', 'user', 'payment', 'deliveryAddress']));
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
                // Repor estoque na coluna única
                $item->product->increment('current_stock', $item->quantity);
                
                // Registrar movimentação de estoque
                $item->product->stockMovements()->create([
                    'user_id' => auth()->id(),
                    'type' => 'entrada',
                    'quantity' => $item->quantity,
                    'description' => 'Estorno - Pedido #' . $order->order_number . ' cancelado'
                ]);
            }

            // Atualizar status do pagamento
            if ($order->payment) {
                $order->payment->update(['status' => 'failed']);
            }
        }

        return response()->json($order->load(['items.product', 'user', 'payment']));
    }
}