<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Payment\PaymentClient;
use MercadoPago\Exceptions\MPApiException;

//teste cache update v1.0.0
class PaymentController extends Controller
{
    private $paymentClient;

    public function __construct()
    {
        MercadoPagoConfig::setAccessToken(config('services.mercadopago.access_token'));
        $this->paymentClient = new PaymentClient();
    }


    public function createPixPayment(Request $request, Order $order)
    {
        if ($request->user()->id !== $order->user_id) {
            return response()->json(['error' => 'Não autorizado.'], 403);
        }

        $existingPayment = $order->payment()->where('status', 'completed')->first();

        if ($order->status !== 'pending' || $existingPayment) {
            return response()->json(['error' => 'Este pedido não pode ser pago.'], 409);
        }

        $docNumber = preg_replace('/[^0-9]/', '', $order->user->document_number ?? '');
        if (empty($docNumber)) {
            Log::error("Erro PIX: Pedido #{$order->id} (Usuário {$order->user->id}) não possui CPF/CNPJ.");
            return response()->json(['error' => 'Para pagar com PIX, seu usuário precisa ter um CPF/CNPJ cadastrado.'], 400);
        }

        $docType = strlen($docNumber) === 11 ? 'CPF' : 'CNPJ';

        try {
            $paymentRequest = [
                'transaction_amount' => (float) round($order->total, 2),
                'description' => 'Pedido #' . $order->order_number . ' - Adega GS',
                'payment_method_id' => 'pix',
                'external_reference' => (string) $order->id,
                'notification_url' => 'https://jordy-sluglike-corruptively.ngrok-free.dev',
                'payer' => [
                    'email' => $order->user->email,
                    'first_name' => explode(' ', $order->user->name)[0],
                    'identification' => [
                        'type' => $docType,
                        'number' => $docNumber,
                    ],
                ],
            ];

            $payment = $this->paymentClient->create($paymentRequest);

            $order->payment()->update([
                'transaction_id' => $payment->id,
                'status' => 'pending_pix',
            ]);

            return response()->json([
                'payment_id' => $payment->id ?? null,
                'pix_copia_e_cola' => $payment->point_of_interaction->transaction_data->qr_code ?? null,
                'pix_qr_code_base64' => $payment->point_of_interaction->transaction_data->qr_code_base64 ?? null,
            ]);
        } catch (MPApiException $e) {
            Log::error('Erro API Mercado Pago: ' . json_encode($e->getApiResponse()->getContent()));
            return response()->json(['error' => 'Erro ao processar pagamento MP.'], 500);
        } catch (\Exception $e) {
            Log::error('Erro CRÍTICO ao criar pagamento PIX: ' . $e->getMessage());
            return response()->json(['error' => 'Falha na integração de pagamento.'], 500);
        }
    }
}
