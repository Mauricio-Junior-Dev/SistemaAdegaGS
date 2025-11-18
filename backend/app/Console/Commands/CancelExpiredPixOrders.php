<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CancelExpiredPixOrders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pix:cancel-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cancela pedidos PIX que expiraram (15 minutos)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Verificando pedidos PIX expirados...');

        // Buscar pedidos com status pending, pagamento PIX e expires_at já passou
        $expiredPayments = Payment::where('payment_method', 'pix')
            ->whereIn('status', ['pending', 'pending_pix'])
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->with(['order.items.product', 'order.items.combo.products'])
            ->get();

        if ($expiredPayments->isEmpty()) {
            $this->info('Nenhum pedido PIX expirado encontrado.');
            return 0;
        }

        $this->info("Encontrados {$expiredPayments->count()} pedido(s) PIX expirado(s).");

        $cancelledCount = 0;

        foreach ($expiredPayments as $payment) {
            try {
                // Usar lock pessimista para evitar race condition com webhook
                DB::beginTransaction();
                
                // Lock do pedido para evitar que webhook processe simultaneamente
                $order = Order::lockForUpdate()->find($payment->order_id);
                
                if (!$order) {
                    $this->warn("Pedido não encontrado para payment_id: {$payment->id}");
                    DB::rollBack();
                    continue;
                }

                // Verificar novamente o status do pagamento (pode ter mudado durante o lock)
                $payment->refresh();
                if (!in_array($payment->status, ['pending', 'pending_pix'])) {
                    $this->warn("Pagamento #{$payment->id} não está mais pendente (status: {$payment->status}). Pulando...");
                    DB::rollBack();
                    continue;
                }

                // Verificar se o pedido ainda está pending
                if ($order->status !== 'pending') {
                    $this->warn("Pedido #{$order->order_number} não está mais pendente. Pulando...");
                    DB::rollBack();
                    continue;
                }

                // Cancelar o pedido
                $order->status = 'cancelled';
                $order->save();

                // Cancelar o pagamento
                $payment->status = 'cancelled';
                $payment->save();

                // Estornar o estoque
                $this->restoreStock($order);

                DB::commit();

                $cancelledCount++;
                $this->info("Pedido #{$order->order_number} cancelado com sucesso.");

                Log::info("Pedido PIX expirado cancelado automaticamente", [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'payment_id' => $payment->id,
                    'expires_at' => $payment->expires_at,
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                $this->error("Erro ao cancelar pedido #{$order->order_number}: " . $e->getMessage());
                Log::error("Erro ao cancelar pedido PIX expirado", [
                    'order_id' => $order->id ?? null,
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        $this->info("Processamento concluído. {$cancelledCount} pedido(s) cancelado(s).");
        return 0;
    }

    /**
     * Restaura o estoque dos produtos do pedido cancelado
     */
    private function restoreStock(Order $order)
    {
        foreach ($order->items as $item) {
            if ($item->is_combo) {
                // Estornar produtos do combo
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
                        'user_id' => null, // Comando automático, sem usuário
                        'type' => 'entrada',
                        'quantity' => $saleType === 'garrafa' ? $quantity : ($garrafasDeduzidas ?? 0),
                        'description' => "Estorno Combo ({$saleType}) - Pedido #" . $order->order_number . ' cancelado (PIX expirado)',
                        'unit_cost' => $unitPrice
                    ]);
                }
            } else {
                // Estornar produto individual
                if (!$item->product) {
                    Log::warning("Produto não encontrado para item #{$item->id} do pedido #{$order->order_number}");
                    continue;
                }
                
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
                    'user_id' => null, // Comando automático, sem usuário
                    'type' => 'entrada',
                    'quantity' => $saleType === 'garrafa' ? $item->quantity : ($garrafasDeduzidas ?? 0),
                    'description' => "Estorno ({$saleType}) - Pedido #" . $order->order_number . ' cancelado (PIX expirado)',
                    'unit_cost' => $unitPrice
                ]);
            }
        }
    }
}

