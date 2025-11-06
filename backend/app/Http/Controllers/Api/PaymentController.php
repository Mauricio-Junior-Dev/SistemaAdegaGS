<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use MercadoPago\SDK;
use MercadoPago\Payment as MPPayment;
use MercadoPago\Payer;

class PaymentController extends Controller
{
    public function __construct()
    {
        // Garante que o SDK esteja configurado (apenas se a classe estiver disponível)
        if (class_exists(\MercadoPago\SDK::class)) {
            SDK::setAccessToken(config('services.mercadopago.access_token'));
        }
    }

    /**
     * Cria uma intenção de pagamento PIX para um pedido existente.
     * Chamado pelo Angular após o cliente confirmar o checkout.
     */
    public function createPixPayment(Request $request, Order $order)
    {
        // 1. Verificação de segurança (Opcional, mas recomendado)
        // Garanta que o $request->user()->id é o dono do $order->user_id
        if ($request->user()->id !== $order->user_id) {
            return response()->json(['error' => 'Você não tem permissão para pagar este pedido.'], 403);
        }

        // 2. Verifica se o pedido já não foi pago
        $existingPayment = $order->payment()->where('status', 'completed')->first();
        if ($order->status !== 'pending' || $existingPayment) {
            return response()->json(['error' => 'Este pedido não pode ser pago.'], 409);
        }

        // 3. Validação do CPF/CNPJ (ANTES de criar o objeto de pagamento)
        // --- CORREÇÃO AQUI ---
        // 1. Pega o documento do usuário (CPF ou CNPJ)
        $docNumber = preg_replace('/[^0-9]/', '', $order->user->document_number ?? ''); // Limpa pontos/hífens

        // 2. VALIDAÇÃO (A Causa do Erro 500)
        if (empty($docNumber)) {
            Log::error("Erro PIX: Pedido #{$order->id} não pode ser processado. Usuário {$order->user->id} não possui CPF/CNPJ cadastrado.");
            // Retorna um erro 400 (Bad Request) em vez de 500
            return response()->json(['error' => 'Para pagar com PIX, seu usuário precisa ter um CPF/CNPJ cadastrado.'], 400);
        }

        $docType = strlen($docNumber) === 11 ? 'CPF' : 'CNPJ';

        // Validação adicional: verifica se o documento tem tamanho válido
        if (strlen($docNumber) !== 11 && strlen($docNumber) !== 14) {
            Log::error("Erro PIX: Pedido #{$order->id} não pode ser processado. Documento do usuário {$order->user->id} é inválido (não é CPF nem CNPJ).");
            return response()->json(['error' => 'CPF/CNPJ inválido. Por favor, verifique seus dados.'], 400);
        }
        // --- FIM DA CORREÇÃO ---

        try {
            // 4. Cria o pagamento no Mercado Pago
            // Usando o alias MPPayment (definido no use statement: use MercadoPago\Payment as MPPayment;)
            $payment = new MPPayment();
            $payment->transaction_amount = (float) $order->total;
            $payment->description = "Pedido #" . $order->order_number . " - Adega GS";
            $payment->payment_method_id = "pix";
            $payment->external_reference = $order->id; // ID do NOSSO pedido

            // 5. Cria o pagador com a identificação obrigatória
            $payment->payer = [
                "email" => $order->user->email,
                "first_name" => explode(' ', $order->user->name)[0],
                "last_name" => substr(strstr($order->user->name, ' '), 1) ?: explode(' ', $order->user->name)[0],
                "identification" => [
                    "type" => $docType,
                    "number" => $docNumber
                ]
            ];

            // URL do Webhook (Onde o MP vai nos avisar que foi pago)
            $payment->notification_url = route('webhooks.mercadopago');

            $payment->save(); // Envia para a API do Mercado Pago

            // 4. Se falhar, retorne o erro
            if ($payment->error) {
                Log::error("Erro ao criar pagamento PIX MP: " . json_encode($payment->error));
                return response()->json(['error' => 'Erro ao processar pagamento'], 500);
            }

            // 5. Salvar pagamento no banco local
            $localPayment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => 'pix',
                'status' => 'pending',
                'amount' => $order->total,
            ]);

            // 6. Sucesso: Retorna os dados do PIX para o Angular
            return response()->json([
                'payment_id' => $payment->id ?? null, // ID da transação no MP
                'pix_copia_e_cola' => $payment->point_of_interaction->transaction_data->qr_code ?? null,
                'pix_qr_code_base64' => $payment->point_of_interaction->transaction_data->qr_code_base64 ?? null,
            ]);

        } catch (\Exception $e) {
            Log::error("Erro ao criar pagamento PIX: " . $e->getMessage());
            Log::error("Stack trace: " . $e->getTraceAsString());
            return response()->json(['error' => 'Falha na integração de pagamento.'], 500);
        }
    }

    public function generatePixPayment(Order $order)
    {
        try {
            // Usando o alias MPPayment (definido no use statement: use MercadoPago\Payment as MPPayment;)
            $payment = new MPPayment();
            $payment->transaction_amount = $order->total_amount;
            $payment->description = "Pedido #{$order->order_number}";
            $payment->payment_method_id = "pix";
            $payment->payer = $this->createPayer($order);

            $payment->save();

            // Salvar pagamento no banco
            $localPayment = Payment::create([
                'order_id' => $order->id,
                'transaction_id' => $payment->id,
                'payment_method' => 'pix',
                'status' => 'pending',
                'amount' => $order->total_amount,
                'payment_details' => [
                    'qr_code' => $payment->point_of_interaction->transaction_data->qr_code,
                    'qr_code_base64' => $payment->point_of_interaction->transaction_data->qr_code_base64
                ]
            ]);

            return response()->json([
                'payment_id' => $payment->id,
                'qr_code' => $payment->point_of_interaction->transaction_data->qr_code,
                'qr_code_base64' => $payment->point_of_interaction->transaction_data->qr_code_base64
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function processCardPayment(Request $request, Order $order)
    {
        $request->validate([
            'token' => 'required|string',
            'installments' => 'required|integer|min:1',
            'payment_method_id' => 'required|string'
        ]);

        try {
            // Usando o alias MPPayment (definido no use statement: use MercadoPago\Payment as MPPayment;)
            $payment = new MPPayment();
            $payment->transaction_amount = $order->total_amount;
            $payment->token = $request->token;
            $payment->description = "Pedido #{$order->order_number}";
            $payment->installments = $request->installments;
            $payment->payment_method_id = $request->payment_method_id;
            $payment->payer = $this->createPayer($order);

            $payment->save();

            // Salvar pagamento no banco
            $localPayment = Payment::create([
                'order_id' => $order->id,
                'transaction_id' => $payment->id,
                'payment_method' => 'credit_card',
                'status' => $payment->status,
                'amount' => $order->total_amount,
                'payment_details' => [
                    'installments' => $request->installments,
                    'payment_method_id' => $request->payment_method_id,
                    'status_detail' => $payment->status_detail
                ]
            ]);

            if ($payment->status === 'approved') {
                $localPayment->markAsApproved();
            }

            return response()->json([
                'status' => $payment->status,
                'status_detail' => $payment->status_detail,
                'payment_id' => $payment->id
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function webhook(Request $request)
    {
        try {
            if ($request->type === 'payment') {
                // Usando o alias MPPayment (definido no use statement: use MercadoPago\Payment as MPPayment;)
                $payment = MPPayment::find_by_id($request->data->id);
                $localPayment = Payment::where('transaction_id', $payment->id)->first();

                if ($localPayment) {
                    $localPayment->status = $payment->status;
                    $localPayment->payment_details = array_merge(
                        $localPayment->payment_details ?? [],
                        ['status_detail' => $payment->status_detail]
                    );
                    $localPayment->save();

                    if ($payment->status === 'approved') {
                        $localPayment->markAsApproved();
                        $localPayment->createFinancialTransaction();
                    }
                }
            }

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    private function createPayer(Order $order)
    {
        $payer = new Payer();
        $payer->email = $order->user->email;
        $payer->first_name = explode(' ', $order->user->name)[0];
        $payer->last_name = substr(strstr($order->user->name, ' '), 1);
        
        return $payer;
    }
}
