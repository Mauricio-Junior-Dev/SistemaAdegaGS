<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Order;
use App\Models\Payment;
use MercadoPago\SDK;
use MercadoPago\Payment as MPPayment;

class WebhookController extends Controller
{
    public function __construct()
    {
        SDK::setAccessToken(config('services.mercadopago.access_token'));
    }

    /**
     * Manipula as notificações de Webhook do Mercado Pago
     */
    public function handleMercadoPago(Request $request)
    {
        Log::info('Webhook MercadoPago recebido:', $request->all());

        $topic = $request->input('topic'); // 'topic' (ex: 'payment')
        $id = $request->input('id');     // 'id' (ex: o ID do pagamento)

        // No PIX, o 'topic' pode não vir, e sim 'action' e 'data.id'
        if ($request->input('action') === 'payment.updated') {
            $id = $request->input('data.id');
            $topic = 'payment';
        }

        if ($topic === 'payment' && $id) {
            try {
                // 1. Busca os detalhes do pagamento na API do Mercado Pago
                // Usando o alias MPPayment (definido no use statement: use MercadoPago\Payment as MPPayment;)
                $payment = MPPayment::find_by_id($id);

                if (!$payment) {
                    Log::warning("Webhook MP: Pagamento ID $id não encontrado na API MP.");
                    return response()->json(['status' => 'not_found'], 404);
                }

                // 2. Pega o ID do *nosso* pedido
                $ourOrderId = $payment->external_reference;
                if (!$ourOrderId) {
                    Log::warning("Webhook MP: Pagamento ID $id não tem external_reference (nosso ID).");
                    return response()->json(['status' => 'no_ref'], 200); // 200 para o MP parar de tentar
                }

                // 3. Busca o pedido no *nosso* banco de dados
                $order = Order::find($ourOrderId);
                if (!$order) {
                    Log::error("Webhook MP: Pedido ID $ourOrderId (MP ID: $id) não encontrado no DB local.");
                    return response()->json(['status' => 'order_not_found'], 404);
                }

                // 4. A LÓGICA PRINCIPAL: Atualizar o Status
                if ($payment->status == 'approved' && $order->status == 'pending') {

                    $order->status = 'processing'; // Ou 'completed', dependendo do seu fluxo
                    $order->save();

                    // Atualiza o 'payment' local (se você salvou um no 'createPixPayment')
                    // Busca o pagamento mais recente do pedido que seja PIX
                    $localPayment = $order->payment()
                        ->where('payment_method', 'pix')
                        ->orderBy('created_at', 'desc')
                        ->first();
                    
                    if ($localPayment) {
                        $localPayment->status = 'completed';
                        $localPayment->save();
                    }

                    Log::info("Webhook MP: Pedido ID $ourOrderId PAGO com sucesso (Status: {$payment->status}).");

                    // (AQUI O SEU OrderPollingService VAI VER A MUDANÇA E MANDAR IMPRIMIR!)

                } else {
                    Log::info("Webhook MP: Status do pagamento recebido: $payment->status (Pedido ID: $ourOrderId, Status atual do pedido: {$order->status})");
                }

                // 5. Retorna 200 OK para o Mercado Pago saber que recebemos.
                return response()->json(['status' => 'received'], 200);

            } catch (\Exception $e) {
                Log::error("Erro ao processar Webhook MP: " . $e->getMessage());
                Log::error("Stack trace: " . $e->getTraceAsString());
                return response()->json(['error' => 'internal_error'], 500);
            }
        }

        return response()->json(['status' => 'ignored'], 200);
    }
}

