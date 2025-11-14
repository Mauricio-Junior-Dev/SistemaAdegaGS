<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Payment\PaymentClient;
use MercadoPago\Exceptions\MPApiException;
use MercadoPago\Client\Common\RequestOptions;

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
    // Sua validação (Está perfeita, mantenha)
    if ($request->user()->id !== $order->user_id) {
        return response()->json(['error' => 'Não autorizado.'], 403);
    }
    if ($order->status !== 'pending' || $order->payment()->where('status', 'completed')->first()) {
        return response()->json(['error' => 'Este pedido não pode ser pago.'], 409);
    }

    // Sua busca pelo CPF (Está perfeita, mantenha)
    $docNumber = preg_replace('/[^0-9]/', '', $order->user->document_number ?? '');
    if (empty($docNumber)) {
        Log::error("Erro PIX: Pedido #{$order->id} (Usuário {$order->user->id}) não possui CPF/CNPJ.");
        return response()->json(['error' => 'Para pagar com PIX, seu usuário precisa ter um CPF/CNPJ cadastrado.'], 400);
    }
    $docType = strlen($docNumber) === 11 ? 'CPF' : 'CNPJ';

    // --- INÍCIO DAS CORREÇÕES ---

    // 1. Pegar o NOME REAL do usuário do pedido e separar
    $nomeCompleto = $order->user->name;
    $partesNome = explode(' ', $nomeCompleto, 2);
    $firstName = $partesNome[0];
    $lastName = $partesNome[1] ?? 'Comprador'; // Fallback, MP exige sobrenome

    // 2. Pegar o EMAIL REAL (o test_user_... que geramos)
    $userEmail = $order->user->email;

    // 3. (Opcional, mas recomendado pela doc) Chave de Idempotência
    $idempotencyKey = $order->id . '-' . uniqid(); // Evita cobrança duplicada
    $requestOptions = new RequestOptions();
    $requestOptions->setCustomHeaders(["X-Idempotency-Key: " . $idempotencyKey]);

    // --- FIM DAS CORREÇÕES ---

    try {
        $paymentRequest = [
            // 'id' => '1234567890', // <-- REMOVIDO! (Erro 3)

            'transaction_amount' => (float) round($order->total, 2),
            'description' => 'Pedido #' . $order->order_number . ' - Adega GS',
            'payment_method_id' => 'pix',
            'external_reference' => (string) $order->id,
            'notification_url' => 'https://jordy-sluglike-corruptively.ngrok-free.dev/api/webhooks/mercadopago', // Mantenha seu ngrok
            
            // --- PAYER CORRIGIDO ---
            'payer' => [
                'email' => $userEmail,       // <-- CORREÇÃO 1: Usando o email real
                'first_name' => $firstName,  // <-- CORREÇÃO 2: Usando o nome real
                'last_name' => $lastName,    // <-- CORREÇÃO 2: Usando o sobrenome real
                
                'identification' => [
                    'type' => $docType,
                    'number' => $docNumber, // (Já estava certo)
                ],
            ],
        ];

        // Passando os $requestOptions como segundo argumento
        $payment = $this->paymentClient->create($paymentRequest, $requestOptions);

        // Seu código para atualizar o banco (Já estava certo)
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
        $errorContent = $e->getApiResponse()->getContent();
        Log::error('Erro API Mercado Pago: ' . json_encode($errorContent));
        // Log extra para sabermos EXATAMENTE o que falhou:
        Log::error('Payload Enviado: ' . json_encode($paymentRequest));
        return response()->json(['error' => 'Erro ao processar pagamento MP.', 'details' => $errorContent], 500);

    } catch (\Exception $e) {
        Log::error('Erro CRÍTICO ao criar pagamento PIX: ' . $e->getMessage());
        return response()->json(['error' => 'Falha na integração de pagamento.'], 500);
    }
}
}
