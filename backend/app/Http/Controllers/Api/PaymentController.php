<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
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
    // Verificação de segurança: usuário deve estar autenticado
    if (!$request->user()) {
        return response()->json(['error' => 'Usuário não autenticado.'], 401);
    }
    
    // Verificar se o usuário autenticado é o dono do pedido
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

    // Definir expiração de 15 minutos
    $expiresAt = now()->addMinutes(15);

    // Iniciar transação de banco de dados
    DB::beginTransaction();

    try {
        $paymentRequest = [
            // 'id' => '1234567890', // <-- REMOVIDO! (Erro 3)

            'transaction_amount' => (float) round($order->total, 2),
            'description' => 'Pedido #' . $order->order_number . ' - Adega GS',
            'payment_method_id' => 'pix',
            'external_reference' => (string) $order->id,
            'notification_url' => config('services.mercadopago.notification_url'),
            // Adiciona milissegundos (.v) e timezone (P) para satisfazer o validador estrito do MP
            'date_of_expiration' => $expiresAt->format('Y-m-d\TH:i:s.vP'),
            
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

        // Atualizar o banco com transaction_id, status, qr_code e expires_at
        $qrCode = $payment->point_of_interaction->transaction_data->qr_code ?? null;
        
        // Buscar ou criar o pagamento do pedido
        $orderPayment = $order->payment()->latest()->first();
        if ($orderPayment) {
            $orderPayment->update([
                'transaction_id' => $payment->id,
                'status' => 'pending_pix',
                'qr_code' => $qrCode,
                'expires_at' => $expiresAt,
            ]);
        } else {
            $order->payment()->create([
                'amount' => $order->total,
                'payment_method' => 'pix',
                'status' => 'pending_pix',
                'transaction_id' => $payment->id,
                'qr_code' => $qrCode,
                'expires_at' => $expiresAt,
            ]);
        }

        // Commit da transação - tudo deu certo
        DB::commit();

        return response()->json([
            'payment_id' => $payment->id ?? null,
            'pix_copia_e_cola' => $payment->point_of_interaction->transaction_data->qr_code ?? null,
            'pix_qr_code_base64' => $payment->point_of_interaction->transaction_data->qr_code_base64 ?? null,
        ]);

    } catch (MPApiException $e) {
        // Rollback em caso de erro da API do Mercado Pago
        DB::rollBack();
        
        // Compensação manual: estornar estoque e cancelar pedido
        $this->compensateOrderFailure($order, 'Erro na API do Mercado Pago');
        
        $errorContent = $e->getApiResponse()->getContent();
        Log::error('Erro API Mercado Pago: ' . json_encode($errorContent));
        // Log extra para sabermos EXATAMENTE o que falhou:
        Log::error('Payload Enviado: ' . json_encode($paymentRequest ?? []));
        return response()->json(['error' => 'Erro ao processar pagamento MP.', 'details' => $errorContent], 500);

    } catch (\Exception $e) {
        // Rollback em caso de qualquer outro erro
        DB::rollBack();
        
        // Compensação manual: estornar estoque e cancelar pedido
        $this->compensateOrderFailure($order, 'Erro crítico: ' . $e->getMessage());
        
        Log::error('Erro CRÍTICO ao criar pagamento PIX: ' . $e->getMessage());
        Log::error('Stack trace: ' . $e->getTraceAsString());
        return response()->json(['error' => 'Falha na integração de pagamento.'], 500);
    }
}

/**
 * Compensa a falha do pagamento estornando o estoque e cancelando o pedido
 * 
 * @param Order $order Pedido que falhou
 * @param string $reason Motivo da falha (para logs)
 */
private function compensateOrderFailure(Order $order, string $reason): void
{
    try {
        // Recarregar o pedido com todos os relacionamentos necessários
        $order->refresh();
        $order->load(['items.product.parentProduct', 'items.productBundle.groups.options.product', 'items.selections.product']);
        
        Log::info("Iniciando compensação manual para pedido #{$order->order_number}. Motivo: {$reason}");
        
        // Iterar pelos itens do pedido e estornar estoque
        foreach ($order->items as $item) {
            // Suporte para bundles (nova estrutura)
            if ($item->is_bundle && $item->productBundle) {
                foreach ($item->selections as $selection) {
                    $product = $selection->product;
                    $quantity = $selection->quantity * $item->quantity;
                    $saleType = $selection->sale_type;
                    
                    if ($saleType === 'garrafa') {
                        $product->increment('current_stock', $quantity);
                    } else {
                        $garrafasDeduzidas = floor($quantity / ($product->doses_por_garrafa ?? 1));
                        if ($garrafasDeduzidas > 0) {
                            $product->increment('current_stock', $garrafasDeduzidas);
                        }
                        $product->update(['doses_vendidas' => 0]);
                    }
                    
                    $unitPrice = $saleType === 'dose' ? ($product->dose_price ?? 0) : $product->price;
                    $product->stockMovements()->create([
                        'user_id' => Auth::id(),
                        'type' => 'entrada',
                        'quantity' => $saleType === 'garrafa' ? $quantity : ($garrafasDeduzidas ?? 0),
                        'description' => "Compensação Manual Bundle ({$saleType}) - Pedido #" . $order->order_number . " - {$reason}",
                        'unit_cost' => $unitPrice
                    ]);
                }
            } elseif ($item->is_combo ?? false) {
                // Fallback para combos antigos (não deve executar, mas mantido para segurança)
                Log::warning("Item #{$item->id} do pedido #{$order->order_number} tem flag is_combo antiga. Ignorando.");
                continue;
            } else if (false) {
                // Código antigo comentado
                // Estornar produtos do combo
                $combo = $item->combo ?? null;
                if (!$combo) {
                    Log::warning("Combo não encontrado para item #{$item->id} do pedido #{$order->order_number}");
                    continue;
                }
                
                foreach ($combo->products ?? [] as $comboProduct) {
                    $product = $comboProduct;
                    $quantity = $comboProduct->pivot->quantity * $item->quantity;
                    $saleType = $comboProduct->pivot->sale_type;
                    
                    $this->restoreProductStock($product, $quantity, $saleType, $order->order_number, "Combo");
                }
            } else {
                // Estornar produto individual
                $product = $item->product;
                if (!$product) {
                    Log::warning("Produto não encontrado para item #{$item->id} do pedido #{$order->order_number}");
                    continue;
                }
                
                $saleType = $item->sale_type ?? 'garrafa';
                $this->restoreProductStock($product, $item->quantity, $saleType, $order->order_number, "Produto");
            }
        }
        
        // Atualizar status do pedido para 'cancelled'
        $order->status = 'cancelled';
        $order->save();
        
        // Atualizar status do pagamento para 'failed'
        $payment = $order->payment()->first();
        if ($payment) {
            $payment->update(['status' => 'failed']);
        }
        
        Log::info("Compensação concluída para pedido #{$order->order_number}. Estoque estornado e pedido cancelado.");
        
    } catch (\Exception $e) {
        // Log do erro mas não interrompe o fluxo
        Log::error("Erro ao compensar falha do pedido #{$order->order_number}: " . $e->getMessage());
        Log::error("Stack trace: " . $e->getTraceAsString());
    }
}

/**
 * Restaura o estoque de um produto após falha no pagamento
 * 
 * @param \App\Models\Product $product Produto a ter estoque restaurado
 * @param int $quantity Quantidade a restaurar
 * @param string $saleType Tipo de venda ('garrafa' ou 'dose')
 * @param string $orderNumber Número do pedido (para logs)
 * @param string $itemType Tipo do item ('Produto' ou 'Combo')
 */
private function restoreProductStock($product, int $quantity, string $saleType, string $orderNumber, string $itemType): void
{
    try {
        // Verificar se é Pack (decrementa do produto pai)
        if ($product->isPack()) {
            $parentProduct = $product->getParentProduct();
            if (!$parentProduct) {
                Log::warning("Produto pai não encontrado para Pack #{$product->id} no pedido #{$orderNumber}");
                return;
            }
            
            // Calcular unidades do produto pai a restaurar
            $unidadesPai = $quantity * $product->stock_multiplier;
            $parentProduct->increment('current_stock', $unidadesPai);
            
            // Registrar movimentação de estoque
            $parentProduct->stockMovements()->create([
                'user_id' => Auth::id() ?? 1, // Fallback para sistema se não houver usuário autenticado
                'type' => 'entrada',
                'quantity' => $unidadesPai,
                'description' => "Estorno {$itemType} Pack - Pedido #{$orderNumber} (falha no pagamento PIX)",
                'unit_cost' => $parentProduct->price
            ]);
            
            Log::info("Estoque restaurado para Pack #{$product->id}: {$unidadesPai} unidades do produto pai #{$parentProduct->id}");
            
        } else {
            // Produto normal
            if ($saleType === 'garrafa') {
                // Estorno direto de garrafas
                $product->increment('current_stock', $quantity);
                
                // Registrar movimentação de estoque
                $product->stockMovements()->create([
                    'user_id' => Auth::id() ?? 1,
                    'type' => 'entrada',
                    'quantity' => $quantity,
                    'description' => "Estorno {$itemType} ({$saleType}) - Pedido #{$orderNumber} (falha no pagamento PIX)",
                    'unit_cost' => $product->price
                ]);
                
                Log::info("Estoque restaurado para produto #{$product->id}: {$quantity} garrafas");
                
            } else {
                // Para doses, calcular quantas garrafas foram deduzidas
                $garrafasDeduzidas = floor($quantity / $product->doses_por_garrafa);
                if ($garrafasDeduzidas > 0) {
                    $product->increment('current_stock', $garrafasDeduzidas);
                    
                    // Zerar o contador de doses vendidas
                    $product->update(['doses_vendidas' => 0]);
                    
                    // Registrar movimentação de estoque
                    $product->stockMovements()->create([
                        'user_id' => Auth::id() ?? 1,
                        'type' => 'entrada',
                        'quantity' => $garrafasDeduzidas,
                        'description' => "Estorno {$itemType} ({$saleType}) - Pedido #{$orderNumber} (falha no pagamento PIX)",
                        'unit_cost' => $product->dose_price ?? $product->price
                    ]);
                    
                    Log::info("Estoque restaurado para produto #{$product->id}: {$garrafasDeduzidas} garrafas (de {$quantity} doses)");
                }
            }
        }
        
    } catch (\Exception $e) {
        Log::error("Erro ao restaurar estoque do produto #{$product->id} no pedido #{$orderNumber}: " . $e->getMessage());
        // Continuar com outros produtos mesmo se um falhar
    }
}
}
