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

            // Buscar o pedido pelo external_reference (que é o order_id)
            $order = Order::find($externalReference);
            if (!$order) {
                Log::warning("Pedido não encontrado: {$externalReference}");
                return response()->json(['status' => 'ignored', 'message' => 'Order not found'], 200);
            }

            // Buscar o pagamento no banco pelo transaction_id
            $payment = Payment::where('order_id', $order->id)
                ->where('transaction_id', $paymentId)
                ->first();

            if (!$payment) {
                Log::warning("Pagamento não encontrado no banco para order_id: {$order->id}, transaction_id: {$paymentId}");
                return response()->json(['status' => 'ignored', 'message' => 'Payment not found'], 200);
            }

            // Atualizar o status do pagamento e do pedido se necessário
            DB::beginTransaction();
            try {
                $statusUpdated = false;

                // Mapear status do Mercado Pago para nosso sistema
                $newPaymentStatus = null;

                switch ($mpStatus) {
                    case 'approved':
                        $newPaymentStatus = 'completed';
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
}

