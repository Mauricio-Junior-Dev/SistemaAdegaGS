<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Payment;
use Carbon\Carbon;
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
    protected $signature = 'orders:cancel-expired|pix:cancel-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cancela pedidos PIX expirados e estorna estoque (php artisan orders:cancel-expired ou php artisan pix:cancel-expired)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Verificando pedidos PIX expirados...');

        $expirationMinutes = (int) config('app.pix_expiration_minutes', 15);
        $nowUtc = Carbon::now('UTC');
        $cutoffCreated = $nowUtc->copy()->subMinutes($expirationMinutes);

        $this->info("Buscando pagamentos PIX com expires_at anterior a: {$nowUtc->toIso8601String()} (UTC). Tolerância: {$expirationMinutes} min.");
        $this->info("Ou pedidos PIX sem expires_at criados antes de: {$cutoffCreated->toIso8601String()} (UTC).");

        // Buscar pagamentos PIX pendentes: expires_at já passou (UTC) OU sem expires_at com pedido criado há mais de X min
        $expiredPayments = Payment::where('payment_method', 'pix')
            ->whereIn('status', ['pending', 'pending_pix'])
            ->where(function ($q) use ($nowUtc, $cutoffCreated) {
                $q->where(function ($q2) use ($nowUtc) {
                    $q2->whereNotNull('expires_at')->where('expires_at', '<', $nowUtc);
                })->orWhere(function ($q2) use ($cutoffCreated) {
                    $q2->whereNull('expires_at')
                        ->whereHas('order', fn ($o) => $o->where('created_at', '<', $cutoffCreated));
                });
            })
            ->with(['order.items.product', 'order.items.selections.product'])
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

                $order->status = 'cancelled';
                $order->save();

                $payment->status = 'cancelled';
                $payment->save();

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

        $this->info("Processamento concluído. {$cancelledCount} pedido(s) cancelado(s) e estoque estornado.");
        Log::info('Comando pix:cancel-expired executado', [
            'cancelled_orders' => $cancelledCount,
            'checked_at' => now()->toIso8601String(),
        ]);
        return 0;
    }

    /**
     * Restaura o estoque dos produtos do pedido cancelado.
     * Produtos simples: incrementa estoque do product_id.
     * Bundles (combos): estorna pelos OrderItemSelection (produtos reais escolhidos), não pelo bundle virtual.
     */
    private function restoreStock(Order $order)
    {
        foreach ($order->items as $item) {
            if ($item->is_bundle && $item->product_bundle_id) {
                // Bundle: estornar pelos selections (produtos reais escolhidos por grupo)
                foreach ($item->selections as $selection) {
                    $product = $selection->product;
                    if (!$product) {
                        Log::warning("Produto da seleção não encontrado para selection #{$selection->id}, item #{$item->id}, pedido #{$order->order_number}");
                        continue;
                    }
                    $quantity = $selection->quantity * $item->quantity;
                    $saleType = $selection->sale_type ?? 'garrafa';

                    if ($saleType === 'garrafa') {
                        $product->increment('current_stock', $quantity);
                        $qtyRestored = $quantity;
                    } else {
                        $garrafasDeduzidas = floor($quantity / ($product->doses_por_garrafa ?? 1));
                        if ($garrafasDeduzidas > 0) {
                            $product->increment('current_stock', $garrafasDeduzidas);
                        }
                        $product->update(['doses_vendidas' => 0]);
                        $qtyRestored = $garrafasDeduzidas ?? 0;
                    }

                    $unitPrice = $saleType === 'dose' ? ($product->dose_price ?? 0) : $product->price;
                    $product->stockMovements()->create([
                        'user_id' => null,
                        'type' => 'entrada',
                        'quantity' => $qtyRestored,
                        'description' => "Estorno Bundle ({$saleType}) - Pedido #" . $order->order_number . ' cancelado (PIX expirado)',
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
                    // Para doses: reverter garrafas deduzidas
                    $garrafasDeduzidas = floor($item->quantity / ($item->product->doses_por_garrafa ?? 1));
                    if ($garrafasDeduzidas > 0) {
                        $item->product->increment('current_stock', $garrafasDeduzidas);
                    }
                    $item->product->update(['doses_vendidas' => 0]);
                }

                $qtyRestored = $saleType === 'garrafa' ? $item->quantity : ($garrafasDeduzidas ?? 0);
                $unitPrice = $saleType === 'dose' ? ($item->product->dose_price ?? 0) : $item->product->price;
                $item->product->stockMovements()->create([
                    'user_id' => null,
                    'type' => 'entrada',
                    'quantity' => $qtyRestored,
                    'description' => "Estorno ({$saleType}) - Pedido #" . $order->order_number . ' cancelado (PIX expirado)',
                    'unit_cost' => $unitPrice
                ]);
            }
        }
    }
}

