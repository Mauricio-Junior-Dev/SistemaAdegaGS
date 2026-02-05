<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Log;

class PrintService
{
    /**
     * Imprime um pedido automaticamente replicando o layout da impressão manual (HTML/CSS)
     *
     * @param Order $order
     * @param int $copies Número de cópias
     */
    public function printOrder(Order $order, int $copies = 2): bool
    {
        try {
            Log::info("=== INÍCIO DA IMPRESSÃO (HTML) ===");
            Log::info("Pedido ID: {$order->id}");
            Log::info("Order Number: " . ($order->order_number ?? 'N/A'));
            Log::info("Created At: " . ($order->created_at ?? 'N/A'));

            // Garantir que o pedido está com relações carregadas (productBundle + selections para combos)
            $order->refresh();
            $order->load(['items.product', 'items.productBundle', 'items.selections.product', 'user', 'payment', 'delivery_address']);

            // Gerar HTML idêntico ao do frontend (print.service.ts)
            $html = $this->generateOrderHtml($order);

            // Salvar HTML em arquivo temporário
            $tempDir = storage_path('app/temp');
            if (!is_dir($tempDir)) {
                if (!mkdir($tempDir, 0755, true) && !is_dir($tempDir)) {
                    throw new \RuntimeException("Não foi possível criar diretório: {$tempDir}");
                }
                Log::info("Diretório temporário criado: {$tempDir}");
            }

            $tempFile = $tempDir . DIRECTORY_SEPARATOR . 'print_' . $order->id . '_' . time() . '.html';
            $bytes = file_put_contents($tempFile, $html);
            if ($bytes === false) {
                throw new \RuntimeException('Falha ao escrever arquivo HTML temporário');
            }
            Log::info("Arquivo HTML criado: {$tempFile} ({$bytes} bytes)");

            // Enviar para impressora
            $successCount = $this->sendHtmlToPrinter($tempFile, $copies);

            // Limpar arquivo
            @unlink($tempFile);

            Log::info("=== RESULTADO FINAL ===");
            Log::info("Cópias enviadas com sucesso: {$successCount}/{$copies}");

            return $successCount > 0;
        } catch (\Exception $e) {
            Log::error("❌ EXCEÇÃO ao imprimir pedido #{$order->order_number}: " . $e->getMessage());
            Log::error("Stack trace: " . $e->getTraceAsString());
            return false;
        }
    }

    /**
     * Gera HTML idêntico ao usado na impressão manual do frontend
     */
    private function generateOrderHtml(Order $order): string
    {
        // Datas
        $createdAt = $order->created_at ? \Carbon\Carbon::parse($order->created_at) : now();
        $formattedDate = $createdAt->format('d/m/Y H:i');

        // Helper de moeda
        $formatCurrency = function ($value) {
            $num = is_numeric($value) ? (float)$value : (float)str_replace([',', 'R$', ' '], ['', '', ''], (string)$value);
            return 'R$ ' . number_format($num, 2, ',', '.');
        };

        // Status label
        $statusLabel = $this->getStatusLabel($order->status ?? '');

        // Cliente
        $customerName = $order->user->name ?? 'Cliente não identificado';
        $customerPhone = $order->user->phone ?? '';

        // Itens (name unificado já vem do model OrderItem: product ou productBundle)
        $itemsHtml = '';
        foreach ($order->items as $item) {
            $name = $item->name ?? 'Item sem nome';
            $qty = (int)$item->quantity;
            $lineTotal = $formatCurrency(((float)$item->price) * $qty);
            $itemsHtml .= '<div class="item">'
                . '<span class="quantity">' . htmlspecialchars($qty . 'x', ENT_QUOTES, 'UTF-8') . '</span>'
                . '<span class="name">' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</span>'
                . '<span class="price">' . htmlspecialchars($lineTotal, ENT_QUOTES, 'UTF-8') . '</span>'
                . '</div>';
            // Sub-itens do combo (sub_lines)
            if (!empty($item->sub_lines)) {
                foreach ($item->sub_lines as $subLine) {
                    $itemsHtml .= '<div class="item sub-item">'
                        . '<span class="quantity"></span>'
                        . '<span class="name">' . htmlspecialchars($subLine, ENT_QUOTES, 'UTF-8') . '</span>'
                        . '<span class="price"></span>'
                        . '</div>';
                }
            }
        }

        // Total e pagamento
        $totalHtml = $formatCurrency($order->total ?? 0);
        $paymentMethod = $this->getPaymentMethod($order);

        // HTML (mesmos estilos do frontend)
        $html = '<!DOCTYPE html>'
            . '<html>'
            . '<head>'
            . '<meta charset="UTF-8">'
            . '<title>Pedido #' . htmlspecialchars((string)$order->order_number, ENT_QUOTES, 'UTF-8') . '</title>'
            . '<style>'
            . '@media print {@page {size: 80mm 297mm; margin: 0;}}'
            . 'body {font-family: \"Courier New\", monospace; width: 80mm; padding: 5mm; margin: 0; box-sizing: border-box;}'
            . '.header {text-align:center; margin-bottom:10mm;}'
            . '.header h1 {font-size:16pt; margin:0;}'
            . '.header p {font-size:10pt; margin:2mm 0;}'
            . '.order-info {margin-bottom:5mm; font-size:10pt;}'
            . '.customer-info {margin-bottom:5mm; font-size:10pt;}'
            . '.items {border-top:1px dashed #000; border-bottom:1px dashed #000; padding:3mm 0; margin:3mm 0;}'
            . '.item {font-size:10pt; margin:2mm 0;}'
            . '.item .quantity {display:inline-block; width:15mm;}'
            . '.item .name {display:inline-block; width:40mm;}'
            . '.item .price {display:inline-block; width:20mm; text-align:right;}'
            . '.total {text-align:right; font-size:12pt; font-weight:bold; margin:5mm 0;}'
            . '.footer {text-align:center; font-size:10pt; margin-top:10mm;}'
            . '</style>'
            . '<script>'
            . '  (function(){try{var u=new URL(window.location.href);if(u.searchParams.get("autoprint")==="1"){setTimeout(function(){window.print();},100);} }catch(e){}}
            .  )();'
            . '</script>'
            . '</head>'
            . '<body>'
            . '<div class="header">'
            . '<h1>ADEGA GS</h1>'
            . '<p>CNPJ: XX.XXX.XXX/0001-XX</p>'
            . '<p>Rua Exemplo, 123 - Centro</p>'
            . '<p>Tel: (11) 9999-9999</p>'
            . '</div>'
            . '<div class="order-info">'
            . '<p><strong>Pedido:</strong> #' . htmlspecialchars((string)$order->order_number, ENT_QUOTES, 'UTF-8') . '</p>'
            . '<p><strong>Data:</strong> ' . htmlspecialchars($formattedDate, ENT_QUOTES, 'UTF-8') . '</p>'
            . '<p><strong>Status:</strong> ' . htmlspecialchars($statusLabel, ENT_QUOTES, 'UTF-8') . '</p>'
            . '</div>'
            . '<div class="customer-info">'
            . '<p><strong>Cliente:</strong> ' . htmlspecialchars($customerName, ENT_QUOTES, 'UTF-8') . '</p>'
            . (!empty($customerPhone) ? '<p><strong>Telefone:</strong> ' . htmlspecialchars($customerPhone, ENT_QUOTES, 'UTF-8') . '</p>' : '')
            . '</div>'
            . '<div class="items">' . $itemsHtml . '</div>'
            . '<div class="total">Total: ' . htmlspecialchars($totalHtml, ENT_QUOTES, 'UTF-8') . '</div>'
            . '<div class="payment-info"><p><strong>Forma de Pagamento:</strong> ' . htmlspecialchars($paymentMethod, ENT_QUOTES, 'UTF-8') . '</p></div>'
            . '<div class="footer">'
            . '<p>Agradecemos a preferência!</p>'
            . '<p>www.adegags.com.br</p>'
            . '</div>'
            . '</body>'
            . '</html>';

        return $html;
    }

    /**
     * Imprime HTML silenciosamente (Windows) usando Internet Explorer (COM) para renderizar como no navegador
     * Retorna a quantidade de cópias impressas com sucesso
     */
    private function sendHtmlToPrinter(string $htmlFilePath, int $copies): int
    {
        $os = strtoupper(substr(PHP_OS, 0, 3));
        $success = 0;

        if ($os !== 'WIN') {
            Log::warning('Impressão HTML automática é suportada apenas no Windows.');
            return 0;
        }

        // Imprimir N cópias usando PowerShell + COM InternetExplorer.Application sem diálogo
        for ($i = 0; $i < $copies; $i++) {
            $psCommand = <<<'PS'
$path = "$FILEPATH"
$ie = New-Object -ComObject InternetExplorer.Application
$ie.Visible = $false
$ie.Silent = $true
$ie.Navigate($path)
while ($ie.Busy -or $ie.ReadyState -ne 4) { Start-Sleep -Milliseconds 200 }
# 6 = OLECMDID_PRINT, 2 = OLECMDEXECOPT_DONTPROMPTUSER
$ie.ExecWB(6,2)
Start-Sleep -Milliseconds 300
$ie.Quit()
PS;

            $psCommand = str_replace('$FILEPATH', str_replace('"', '\"', $htmlFilePath), $psCommand);
            $full = 'powershell -NoProfile -ExecutionPolicy Bypass -Command ' . escapeshellarg($psCommand);

            Log::info('Executando impressão via IE (COM)...');
            $output = [];
            $ret = 0;
            exec($full . ' 2>&1', $output, $ret);
            Log::info('Retorno PowerShell: ' . $ret);
            if (!empty($output)) {
                Log::info('Saída PowerShell: ' . implode("\n", $output));
            }

            if ($ret === 0) {
                $success++;
            } else {
                Log::error('Falha ao imprimir cópia ' . ($i + 1) . ' via IE/COM');
                // Fallback: usar controle .NET WebBrowser (Windows Forms) para renderizar e imprimir silenciosamente
                $psWinForms = <<<'PSWF'
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$url = "$FILEURL"
$printed = $false
$browser = New-Object System.Windows.Forms.WebBrowser
$browser.ScriptErrorsSuppressed = $true
$browser.Width = 800; $browser.Height = 600
$handler = [System.Windows.Forms.WebBrowserDocumentCompletedEventHandler] {
    param($sender, $e)
    if ($sender.ReadyState -eq 'Complete' -and -not $printed) {
        $global:printed = $true
        $sender.Print()
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.Application]::Exit()
    }
}
$browser.add_DocumentCompleted($handler)
$browser.Navigate($url)
[System.Windows.Forms.Application]::Run()
if ($printed) { exit 0 } else { exit 1 }
PSWF;

                $fileUrl = 'file:///' . str_replace('\\\
','/', $htmlFilePath);
                $psWinForms = str_replace('$FILEURL', str_replace('"', '\\"', $fileUrl), $psWinForms);
                $fullWinForms = 'powershell -NoProfile -STA -ExecutionPolicy Bypass -Command ' . escapeshellarg($psWinForms);
                Log::info('Executando fallback impressão via WebBrowser (.NET Forms)...');
                $out2 = [];
                $ret2 = 0;
                exec($fullWinForms . ' 2>&1', $out2, $ret2);
                Log::info('Fallback WebBrowser retorno: ' . $ret2);
                if (!empty($out2)) {
                    Log::info('Fallback WebBrowser saída: ' . implode("\n", $out2));
                }
                if ($ret2 === 0) {
                    $success++;
                } else {
                    // Fallback 2: Edge/Chrome em modo kiosk-printing com autoprint
                    $escapedUrl = 'file:///' . str_replace('\\', '/', $htmlFilePath) . '?autoprint=1';
                    $psEdge = <<<'PSEDGE'
$ErrorActionPreference = 'SilentlyContinue'
$cmd = $null
foreach ($name in @('msedge.exe','msedge','chrome.exe','chrome')) {
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) { $cmd = $c.Path; break }
}
if (-not $cmd) {
  $paths = @(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  )
  foreach ($p in $paths) { if (Test-Path $p) { $cmd = $p; break } }
}
if ($cmd) {
  $args = @('--kiosk-printing', "$URL")
  $p = Start-Process -FilePath $cmd -ArgumentList $args -PassThru
  Start-Sleep -Milliseconds 1500
  try { $p.CloseMainWindow() | Out-Null } catch {}
  try { $p.Kill() | Out-Null } catch {}
  exit 0
} else {
  exit 1
}
PSEDGE;
                    $psEdge = str_replace('$URL', str_replace('"', '\\"', $escapedUrl), $psEdge);
                    $fullEdge = 'powershell -NoProfile -ExecutionPolicy Bypass -Command ' . escapeshellarg($psEdge);
                    Log::info('Executando fallback impressão via Edge/Chrome kiosk-printing...');
                    $out3 = [];
                    $ret3 = 0;
                    exec($fullEdge . ' 2>&1', $out3, $ret3);
                    Log::info('Fallback Edge/Chrome retorno: ' . $ret3);
                    if (!empty($out3)) {
                        Log::info('Fallback Edge/Chrome saída: ' . implode("\n", $out3));
                    }
                    if ($ret3 === 0) {
                        $success++;
                    }
                }
            }

            if ($i < $copies - 1) {
                usleep(500000); // 0.5s entre cópias
            }
        }

        return $success;
    }

    private function getStatusLabel(string $status): string
    {
        $labels = [
            'pending' => 'Pendente',
            'delivering' => 'Em Entrega',
            'completed' => 'Concluído',
            'cancelled' => 'Cancelado',
        ];
        return $labels[$status] ?? $status;
    }

    private function getPaymentMethod(Order $order): string
    {
        if (isset($order->payment_method) && !empty($order->payment_method)) {
            return $this->formatPaymentMethod($order->payment_method);
        }

        if ($order->payment) {
            if ($order->payment instanceof \Illuminate\Database\Eloquent\Collection || $order->payment instanceof \Illuminate\Support\Collection) {
                $firstPayment = $order->payment->first();
                if ($firstPayment && isset($firstPayment->payment_method)) {
                    return $this->formatPaymentMethod($firstPayment->payment_method);
                }
            } elseif (is_object($order->payment)) {
                $method = $order->payment->payment_method ?? null;
                if ($method) {
                    return $this->formatPaymentMethod($method);
                }
            } elseif (is_array($order->payment)) {
                $firstPayment = $order->payment[0] ?? null;
                if ($firstPayment) {
                    $method = is_object($firstPayment) ? ($firstPayment->payment_method ?? null) : ($firstPayment['payment_method'] ?? null);
                    if ($method) {
                        return $this->formatPaymentMethod($method);
                    }
                }
            }
        }

        return 'Não informado';
    }

    private function formatPaymentMethod(string $method): string
    {
        $methods = [
            'dinheiro' => 'Dinheiro',
            'cartao' => 'Cartão',
            'pix' => 'PIX',
            'credito' => 'Cartão de Crédito',
            'debito' => 'Cartão de Débito',
            'cartão de débito' => 'Cartão de Débito',
            'cartão de crédito' => 'Cartão de Crédito',
        ];
        return $methods[$method] ?? $method;
    }
}


