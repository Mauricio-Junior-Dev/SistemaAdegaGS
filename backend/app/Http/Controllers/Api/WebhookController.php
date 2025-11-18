<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Payment\PaymentClient;
use MercadoPago\Exceptions\MPApiException;

class WebhookController extends Controller
{
    private $paymentClient;

    public function __construct()
    {
        MercadoPagoConfig::setAccessToken(config('services.mercadopago.access_token'));
        $this->paymentClient = new PaymentClient();
    }

    public function handleMercadoPago(Request $request)
    {
        try {
            // O Mercado Pago envia o webhook com 'type' e 'data'
            $type = $request->input('type');
            $data = $request->input('data');

            // Verificar se é um evento de pagamento
            if ($type !== 'payment' || !isset($data['id'])) {
                return response()->json(['status' => 'ignored'], 200);
            }

            $paymentId = $data['id'];

            // Buscar o pagamento na API do Mercado Pago
            try {
                $mpPayment = $this->paymentClient->get($paymentId);
            } catch (MPApiException $e) {
                Log::error("Erro ao buscar pagamento no Mercado Pago: {$paymentId}", [
                    'error' => $e->getMessage(),
                    'response' => $e->getApiResponse() ? $e->getApiResponse()->getContent() : null
                ]);
                return response()->json(['status' => 'error', 'message' => 'Payment not found'], 404);
            }

            $mpStatus = $mpPayment->status ?? null;
            $externalReference = $mpPayment->external_reference ?? null;

            if (!$externalReference) {
                Log::warning("Pagamento sem external_reference: {$paymentId}");
                return response()->json(['status' => 'ignored', 'message' => 'No external reference'], 200);
            }

            // Atualizar o status do pagamento e do pedido se necessário
            // Usar lock pessimista para evitar race condition com comando de cancelamento
            DB::beginTransaction();
            try {
                // Lock do pedido para evitar processamento simultâneo
                $order = Order::lockForUpdate()->find($externalReference);
                if (!$order) {
                    DB::rollBack();
                    Log::warning("Pedido não encontrado após lock: {$externalReference}");
                    return response()->json(['status' => 'ignored', 'message' => 'Order not found'], 200);
                }

                // Lock do pagamento também
                $payment = Payment::lockForUpdate()
                    ->where('order_id', $order->id)
                    ->where('transaction_id', $paymentId)
                    ->first();

                if (!$payment) {
                    DB::rollBack();
                    Log::warning("Pagamento não encontrado no banco após lock para order_id: {$order->id}, transaction_id: {$paymentId}");
                    return response()->json(['status' => 'ignored', 'message' => 'Payment not found'], 200);
                }

                $statusUpdated = false;
                $needsStockReservation = false;

                // Mapear status do Mercado Pago para nosso sistema
                $newPaymentStatus = null;

                switch ($mpStatus) {
                    case 'approved':
                        $newPaymentStatus = 'completed';
                        
                        // CRÍTICO: Se o pedido foi cancelado mas o pagamento foi aprovado,
                        // precisamos reativar o pedido E re-reservar o estoque
                        if ($order->status === 'cancelled') {
                            Log::warning("Pedido #{$order->order_number} foi cancelado mas pagamento foi aprovado. Reativando...", [
                                'order_id' => $order->id,
                                'payment_id' => $payment->id,
                                'transaction_id' => $paymentId
                            ]);
                            $needsStockReservation = true;
                        }
                        
                        // Quando o pagamento é aprovado, atualizamos o status do pedido para 'processing'
                        // (Pago, Aguardando Preparo)
                        // O funcionário mudará para 'delivering' quando sair para entrega
                        $statusUpdated = true;
                        break;
                    case 'rejected':
                    case 'cancelled':
                        $newPaymentStatus = 'failed';
                        // Mantém o pedido como pending para permitir nova tentativa
                        break;
                    case 'refunded':
                        $newPaymentStatus = 'refunded';
                        // Quando reembolsado, pode cancelar o pedido
                        if ($order->status !== 'cancelled') {
                            $order->status = 'cancelled';
                        }
                        break;
                    default:
                        // Status como 'pending', 'in_process', etc. - não fazemos nada ainda
                        break;
                }

                if ($statusUpdated && $newPaymentStatus) {
                    // Atualizar o pagamento
                    $payment->status = $newPaymentStatus;
                    $payment->save();

                    // Se o pedido estava cancelado, re-reservar o estoque antes de reativar
                    if ($needsStockReservation) {
                        try {
                            $this->reserveStock($order);
                        } catch (\Exception $stockException) {
                            // Se não houver estoque, fazer estorno automático
                            if (str_contains($stockException->getMessage(), 'Estoque insuficiente')) {
                                DB::rollBack();
                                
                                // Iniciar nova transação para o estorno
                                DB::beginTransaction();
                                try {
                                    // Fazer estorno no Mercado Pago
                                    try {
                                        $refundResult = $this->paymentClient->refund($paymentId);
                                        Log::info("Estorno realizado no Mercado Pago", [
                                            'payment_id' => $paymentId,
                                            'refund_id' => $refundResult->id ?? null,
                                            'order_id' => $order->id
                                        ]);
                                    } catch (MPApiException $refundException) {
                                        Log::error("Erro ao fazer estorno no Mercado Pago", [
                                            'payment_id' => $paymentId,
                                            'order_id' => $order->id,
                                            'error' => $refundException->getMessage(),
                                            'response' => $refundException->getApiResponse() ? $refundException->getApiResponse()->getContent() : null
                                        ]);
                                        // Mesmo se o estorno falhar, atualizamos o status localmente
                                    }

                                    // Atualizar status do pagamento para refunded
                                    $payment->status = 'refunded';
                                    $payment->save();

                                    // Manter o pedido como cancelled
                                    $order->status = 'cancelled';
                                    $order->save();

                                    DB::commit();

                                    Log::warning("Estorno automático realizado para Pedido #{$order->order_number} por falta de estoque.", [
                                        'order_id' => $order->id,
                                        'order_number' => $order->order_number,
                                        'payment_id' => $payment->id,
                                        'transaction_id' => $paymentId,
                                        'error' => $stockException->getMessage()
                                    ]);

                                    return response()->json([
                                        'status' => 'refunded',
                                        'message' => 'Pagamento estornado automaticamente por falta de estoque',
                                        'order_id' => $order->id,
                                        'payment_status' => 'refunded',
                                        'order_status' => 'cancelled'
                                    ], 200);

                                } catch (\Exception $refundError) {
                                    DB::rollBack();
                                    Log::error("Erro ao processar estorno automático", [
                                        'order_id' => $order->id,
                                        'payment_id' => $payment->id,
                                        'error' => $refundError->getMessage(),
                                        'trace' => $refundError->getTraceAsString()
                                    ]);
                                    throw $refundError;
                                }
                            } else {
                                // Se for outra exceção, relançar
                                throw $stockException;
                            }
                        }
                    }

                    // Quando o pagamento é aprovado, mudar o status do pedido para 'processing'
                    // (Pago, Aguardando Preparo)
                    $order->status = 'processing';
                    $order->save();
                } else {
                    // Atualizar apenas o status do pagamento se mudou
                    if ($newPaymentStatus && $payment->status !== $newPaymentStatus) {
                        $payment->status = $newPaymentStatus;
                        $payment->save();
                        
                        // Se foi reembolsado, atualizar o pedido também
                        if ($newPaymentStatus === 'refunded' && $order->status !== 'cancelled') {
                            $order->status = 'cancelled';
                            $order->save();
                        }
                    }
                }

                DB::commit();
                
                // Recarregar o pedido para ter os dados atualizados
                $order->refresh();
                
                return response()->json([
                    'status' => 'processed',
                    'order_id' => $order->id,
                    'payment_status' => $payment->status,
                    'order_status' => $order->status
                ], 200);

            } catch (\Exception $e) {
                DB::rollBack();
                Log::error("Erro ao atualizar status no banco: " . $e->getMessage(), [
                    'order_id' => $order->id,
                    'payment_id' => $payment->id,
                    'trace' => $e->getTraceAsString()
                ]);
                return response()->json(['status' => 'error', 'message' => 'Database error'], 500);
            }

        } catch (\Exception $e) {
            Log::error("Erro geral no webhook: " . $e->getMessage(), [
                'request' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['status' => 'error', 'message' => 'Internal error'], 500);
        }
    }

    /**
     * Re-reserva o estoque de um pedido que foi reativado após cancelamento
     */
    private function reserveStock(Order $order)
    {
        foreach ($order->items as $item) {
            if ($item->is_combo) {
                // Reservar produtos do combo
                $combo = $item->combo;
                if (!$combo) {
                    Log::warning("Combo não encontrado para item #{$item->id} do pedido #{$order->order_number}");
                    continue;
                }

                foreach ($combo->products as $comboProduct) {
                    if (!$comboProduct) {
                        continue;
                    }

                    $product = $comboProduct;
                    $quantity = $comboProduct->pivot->quantity * $item->quantity;
                    $saleType = $comboProduct->pivot->sale_type;

                    // Verificar disponibilidade antes de reservar
                    if ($saleType === 'garrafa') {
                        $currentStock = (int) $product->current_stock;
                        if ($currentStock < $quantity) {
                            Log::error("Estoque insuficiente ao re-reservar combo. Produto: {$product->name}, Necessário: {$quantity}, Disponível: {$currentStock}", [
                                'order_id' => $order->id,
                                'product_id' => $product->id
                            ]);
                            throw new \Exception("Estoque insuficiente para reativar pedido. Produto: {$product->name}");
                        }
                        $product->decrement('current_stock', $quantity);
                    } else {
                        // Para doses, calcular garrafas necessárias
                        $garrafasNecessarias = ceil($quantity / $product->doses_por_garrafa);
                        $currentStock = (int) $product->current_stock;
                        
                        if ($currentStock < $garrafasNecessarias) {
                            Log::error("Estoque insuficiente ao re-reservar combo (doses). Produto: {$product->name}, Necessário: {$garrafasNecessarias}, Disponível: {$currentStock}", [
                                'order_id' => $order->id,
                                'product_id' => $product->id
                            ]);
                            throw new \Exception("Estoque insuficiente para reativar pedido. Produto: {$product->name}");
                        }
                        $product->decrement('current_stock', $garrafasNecessarias);
                        $product->increment('doses_vendidas', $quantity);
                    }

                    // Registrar movimentação de estoque
                    $unitPrice = $saleType === 'dose' ? $product->dose_price : $product->price;
                    $product->stockMovements()->create([
                        'user_id' => null, // Webhook automático
                        'type' => 'saida',
                        'quantity' => $saleType === 'garrafa' ? $quantity : $garrafasNecessarias,
                        'description' => "Re-reserva Combo ({$saleType}) - Pedido #" . $order->order_number . ' reativado após pagamento aprovado',
                        'unit_cost' => $unitPrice
                    ]);
                }
            } else {
                // Reservar produto individual
                if (!$item->product) {
                    Log::warning("Produto não encontrado para item #{$item->id} do pedido #{$order->order_number}");
                    continue;
                }

                $saleType = $item->sale_type ?? 'garrafa';

                // Verificar disponibilidade antes de reservar
                if ($saleType === 'garrafa') {
                    $currentStock = (int) $item->product->current_stock;
                    if ($currentStock < $item->quantity) {
                        Log::error("Estoque insuficiente ao re-reservar produto. Produto: {$item->product->name}, Necessário: {$item->quantity}, Disponível: {$currentStock}", [
                            'order_id' => $order->id,
                            'product_id' => $item->product->id
                        ]);
                        throw new \Exception("Estoque insuficiente para reativar pedido. Produto: {$item->product->name}");
                    }
                    $item->product->decrement('current_stock', $item->quantity);
                } else {
                    // Para doses, calcular garrafas necessárias
                    $garrafasNecessarias = ceil($item->quantity / $item->product->doses_por_garrafa);
                    $currentStock = (int) $item->product->current_stock;
                    
                    if ($currentStock < $garrafasNecessarias) {
                        Log::error("Estoque insuficiente ao re-reservar produto (doses). Produto: {$item->product->name}, Necessário: {$garrafasNecessarias}, Disponível: {$currentStock}", [
                            'order_id' => $order->id,
                            'product_id' => $item->product->id
                        ]);
                        throw new \Exception("Estoque insuficiente para reativar pedido. Produto: {$item->product->name}");
                    }
                    $item->product->decrement('current_stock', $garrafasNecessarias);
                    $item->product->increment('doses_vendidas', $item->quantity);
                }

                // Registrar movimentação de estoque
                $unitPrice = $saleType === 'dose' ? $item->product->dose_price : $item->product->price;
                $item->product->stockMovements()->create([
                    'user_id' => null, // Webhook automático
                    'type' => 'saida',
                    'quantity' => $saleType === 'garrafa' ? $item->quantity : $garrafasNecessarias,
                    'description' => "Re-reserva ({$saleType}) - Pedido #" . $order->order_number . ' reativado após pagamento aprovado',
                    'unit_cost' => $unitPrice
                ]);
            }
        }
    }
}

