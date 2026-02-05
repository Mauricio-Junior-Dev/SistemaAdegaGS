using System.Drawing.Printing;
using System.Text;
using PrintBridge.DTOs;
using PrintBridge.Helpers;
using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace PrintBridge.Services;

/// <summary>
/// Serviço para impressão ESC/POS em impressoras térmicas
/// </summary>
public class PrinterService
{
    private readonly string _printerName;
    private readonly ILogger<PrinterService> _logger;

    // Comandos ESC/POS
    private const byte ESC = 0x1B;
    private const byte GS = 0x1D;
    private const byte LF = 0x0A;

    // Encoding para impressora térmica (IBM860 para caracteres acentuados, com fallback para Windows-1252)
    private static Encoding? _printerEncoding;

    public PrinterService(IConfiguration configuration, ILogger<PrinterService> logger)
    {
        // Ler nome da impressora do appsettings.json, com fallback para "POS-80"
        _printerName = configuration["Printer:Name"] ?? "POS-80";
        _logger = logger;
        InitializeEncoding();
    }

    /// <summary>
    /// Inicializa o encoding para impressão, com fallback se necessário
    /// </summary>
    private void InitializeEncoding()
    {
        if (_printerEncoding != null) return;

        try
        {
            // Tentar IBM860 (comum em impressoras térmicas brasileiras)
            _printerEncoding = Encoding.GetEncoding("IBM860");
            _logger.LogInformation("Encoding IBM860 inicializado com sucesso");
        }
        catch
        {
            try
            {
                // Fallback para Windows-1252 (também funciona bem)
                _printerEncoding = Encoding.GetEncoding("Windows-1252");
                _logger.LogWarning("IBM860 não disponível, usando Windows-1252");
            }
            catch
            {
                // Último fallback: ASCII
                _printerEncoding = Encoding.ASCII;
                _logger.LogWarning("Usando ASCII como encoding (caracteres acentuados podem não funcionar)");
            }
        }
    }

    /// <summary>
    /// Obtém os bytes do texto usando o encoding da impressora
    /// </summary>
    private byte[] GetBytes(string text)
    {
        return _printerEncoding!.GetBytes(text);
    }

    /// <summary>
    /// Imprime um pedido completo formatado
    /// Configurado para imprimir exatamente 2 vias (uma para cozinha/separação e uma para motoboy/cliente)
    /// </summary>
    public bool PrintOrder(OrderDto order)
    {
        try
        {
            _logger.LogInformation($"Iniciando impressão do pedido #{order.OrderNumber}");

            // Verificar se a impressora existe
            if (!IsPrinterAvailable(_printerName))
            {
                _logger.LogError($"Impressora '{_printerName}' não encontrada ou não está disponível");
                return false;
            }

            // Gerar conteúdo ESC/POS (uma única vez)
            byte[] printData = GenerateEscPosContent(order);

            // Número de vias configurado: 2 (uma para cozinha/separação e uma para motoboy/cliente)
            const int numberOfCopies = 2;
            bool allSuccess = true;

            // Imprimir exatamente 2 vias
            for (int copy = 1; copy <= numberOfCopies; copy++)
            {
                _logger.LogInformation($"Enviando via {copy}/{numberOfCopies} para o pedido #{order.OrderNumber}");
                bool success = SendToPrinter(_printerName, printData);
                
                if (!success)
                {
                    _logger.LogError($"Falha ao imprimir via {copy}/{numberOfCopies} do pedido #{order.OrderNumber}");
                    allSuccess = false;
                }
                
                // Pequeno delay entre vias para evitar problemas de buffer da impressora
                if (copy < numberOfCopies)
                {
                    System.Threading.Thread.Sleep(100); // 100ms entre vias
                }
            }

            if (allSuccess)
            {
                _logger.LogInformation($"Pedido #{order.OrderNumber} impresso com sucesso ({numberOfCopies} vias)");
            }
            else
            {
                _logger.LogError($"Falha ao imprimir uma ou mais vias do pedido #{order.OrderNumber}");
            }

            return allSuccess;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erro ao imprimir pedido #{order.OrderNumber}");
            return false;
        }
    }

    /// <summary>
    /// Gera o conteúdo ESC/POS formatado do pedido
    /// </summary>
    private byte[] GenerateEscPosContent(OrderDto order)
    {
        var buffer = new List<byte>();

        // Inicializar impressora
        buffer.AddRange(InitializePrinter());

        // Cabeçalho da adega
        buffer.AddRange(PrintCentered("ADEGA GS", 2)); // Texto grande e centralizado
        buffer.AddRange(PrintLine());
        buffer.AddRange(PrintCentered("CNPJ: 48.015.662/0001-61"));
        buffer.AddRange(PrintLine());
        buffer.AddRange(PrintCentered("Rua Alameda das Andorinhas, 119 - Recanto Campo Belo"));
        buffer.AddRange(PrintLine());
        buffer.AddRange(PrintCentered("Tel: (11) 94510-7055"));
        buffer.AddRange(PrintLine());
        buffer.AddRange(PrintSeparator());

        // Informações do pedido
        buffer.AddRange(PrintBold($"PEDIDO: #{order.OrderNumber}"));
        buffer.AddRange(PrintLine());

        if (!string.IsNullOrEmpty(order.CreatedAt))
        {
            if (DateTime.TryParse(order.CreatedAt, out var dateTime))
            {
                buffer.AddRange(PrintText($"DATA: {dateTime:dd/MM/yyyy HH:mm}"));
            }
            else
            {
                buffer.AddRange(PrintText($"DATA: {order.CreatedAt}"));
            }
        }
        buffer.AddRange(PrintLine());

        if (!string.IsNullOrEmpty(order.Status))
        {
            buffer.AddRange(PrintText($"STATUS: {FormatStatus(order.Status)}"));
            buffer.AddRange(PrintLine());
        }

        buffer.AddRange(PrintSeparator());

        // Informações do cliente
        buffer.AddRange(PrintBold("CLIENTE:"));
        if (order.User != null)
        {
            buffer.AddRange(PrintText(order.User.Name));
            if (!string.IsNullOrEmpty(order.User.Phone))
            {
                buffer.AddRange(PrintText($" TEL: {order.User.Phone}"));
            }
        }
        buffer.AddRange(PrintLine());

        // Endereço de entrega (se houver)
        if (order.DeliveryAddress != null && HasDeliveryAddress(order.DeliveryAddress))
        {
            buffer.AddRange(PrintBold("ENTREGA:"));
            buffer.AddRange(PrintText(BuildAddressString(order.DeliveryAddress)));
            buffer.AddRange(PrintLine());

            if (!string.IsNullOrEmpty(order.DeliveryNotes))
            {
                buffer.AddRange(PrintText($"OBS: {order.DeliveryNotes}"));
                buffer.AddRange(PrintLine());
            }
        }

        buffer.AddRange(PrintSeparator());

        // Itens do pedido
        buffer.AddRange(PrintBold("ITENS:"));
        buffer.AddRange(PrintLine());

        decimal totalItems = 0;
        foreach (var item in order.Items)
        {
            string itemName = GetItemName(item);
            int quantity = item.Quantity;
            
            // Aqui usamos o ParseDecimal corrigido
            decimal itemPrice = ParseDecimal(item.Price); // Este é o PREÇO UNITÁRIO
            
            decimal lineTotal = itemPrice * quantity; // Este é o PREÇO DA LINHA
            totalItems += lineTotal;

            // Nome do produto/combo (pode quebrar linha se muito longo)
            buffer.AddRange(PrintText($"{quantity}x {itemName}", leftAlign: true));
            buffer.AddRange(PrintText("  ")); // 2 espaços para separar nome e preço

            // --- CORREÇÃO AQUI ---
            // Antes estava imprimindo {lineTotal:F2}, agora imprime {itemPrice:F2}
            buffer.AddRange(PrintTextRight($"{itemPrice:F2}", width: 48));
            buffer.AddRange(PrintLine());

            // Sub-itens do combo (ex: "- 1x Coca-Cola", "- 1x Gelo de Coco")
            if (item.SubLines != null && item.SubLines.Count > 0)
            {
                foreach (var subLine in item.SubLines)
                {
                    buffer.AddRange(PrintText("  " + subLine, leftAlign: true));
                    buffer.AddRange(PrintLine());
                }
            }
        }

        buffer.AddRange(PrintSeparator());

        // Totais
        // Aqui também usamos o ParseDecimal corrigido
        decimal total = ParseDecimal(order.Total);
        decimal deliveryFee = 0;
        
        // Obter taxa de entrega se disponível
        if (!string.IsNullOrEmpty(order.DeliveryFee))
        {
            deliveryFee = ParseDecimal(order.DeliveryFee);
        }
        
        // Calcular subtotal (total - taxa de entrega)
        decimal subtotal = total - deliveryFee;
        
        // Exibir subtotal
        buffer.AddRange(PrintTextRight($"Subtotal: R$ {subtotal:F2}", width: 48));
        buffer.AddRange(PrintLine());
        
        // Exibir taxa de entrega se maior que zero
        if (deliveryFee > 0)
        {
            buffer.AddRange(PrintTextRight($"Taxa de Entrega: R$ {deliveryFee:F2}", width: 48));
            buffer.AddRange(PrintLine());
        }
        
        // Exibir total
        buffer.AddRange(PrintBold($"TOTAL: R$ {total:F2}", alignRight: true, width: 48));
        buffer.AddRange(PrintLine(2));

        // Informações de pagamento
        buffer.AddRange(PrintBold("PAGAMENTO:"));
        buffer.AddRange(PrintLine(1));
        
        // Pega o método de pagamento *original* (raw) para a verificação
        string rawPaymentMethod = "desconhecido";
        if (order.Payment != null && order.Payment.Count > 0)
        {
            rawPaymentMethod = order.Payment[0].PaymentMethod ?? "desconhecido";
        }
        else if (!string.IsNullOrEmpty(order.PaymentMethod))
        {
            rawPaymentMethod = order.PaymentMethod;
        }

        string paymentMethodFormatted = GetPaymentMethod(order); // Ex: "DINHEIRO", "PIX"
        
        // Verificar status do pedido para determinar situação de pagamento
        bool isCompleted = !string.IsNullOrEmpty(order.Status) && 
                          order.Status.ToLower() == "completed";
        bool isPending = !string.IsNullOrEmpty(order.Status) && 
                        order.Status.ToLower() == "pending";
        bool hasDelivery = order.DeliveryAddress != null && HasDeliveryAddress(order.DeliveryAddress);

        // Mostrar situação de pagamento
        if (isCompleted)
        {
            buffer.AddRange(PrintBold($"SITUAÇÃO: PAGO ({paymentMethodFormatted})"));
        }
        else if (isPending)
        {
            buffer.AddRange(PrintBold("SITUAÇÃO: A COBRAR NA ENTREGA"));
        }
        else
        {
            buffer.AddRange(PrintText(paymentMethodFormatted));
        }
        buffer.AddRange(PrintLine(1));

        // Se for entrega pendente, mostrar instruções para o entregador
        if (isPending && hasDelivery)
        {
            buffer.AddRange(PrintLine(1));
            buffer.AddRange(PrintSeparator());
            
            // Instruções destacadas para o entregador
            if (rawPaymentMethod.ToLower().Contains("dinheiro"))
            {
                decimal received = 0;
                if (!string.IsNullOrEmpty(order.ReceivedAmount))
                {
                    received = ParseDecimal(order.ReceivedAmount);
                }
                
                if (received > 0)
                {
                    buffer.AddRange(PrintBold("⚠ LEVAR TROCO PARA R$ " + received.ToString("F2")));
                    buffer.AddRange(PrintLine(1));
                    
                    decimal change = 0;
                    if (!string.IsNullOrEmpty(order.ChangeAmount))
                    {
                        change = ParseDecimal(order.ChangeAmount);
                    }
                    else if (received > total)
                    {
                        change = received - total;
                    }
                    
                    if (change > 0)
                    {
                        buffer.AddRange(PrintBold($"TROCO: R$ {change:F2}"));
                        buffer.AddRange(PrintLine(1));
                    }
                }
                else
                {
                    buffer.AddRange(PrintBold("⚠ COBRAR EM DINHEIRO"));
                    buffer.AddRange(PrintLine(1));
                }
            }
            else if (rawPaymentMethod.ToLower().Contains("cartão") || 
                     rawPaymentMethod.ToLower().Contains("credito") || 
                     rawPaymentMethod.ToLower().Contains("crédito") ||
                     rawPaymentMethod.ToLower().Contains("debito") ||
                     rawPaymentMethod.ToLower().Contains("débito"))
            {
                buffer.AddRange(PrintBold("⚠ LEVAR MAQUININHA"));
                buffer.AddRange(PrintLine(1));
            }
            else if (rawPaymentMethod.ToLower().Contains("pix"))
            {
                buffer.AddRange(PrintBold("⚠ COBRAR VIA PIX"));
                buffer.AddRange(PrintLine(1));
            }
            
            buffer.AddRange(PrintSeparator());
            buffer.AddRange(PrintLine(1));
        }
        else if (isCompleted && rawPaymentMethod.ToLower().Contains("dinheiro"))
        {
            // Para vendas balcão pagas em dinheiro, mostrar valores recebidos e troco
            if (!string.IsNullOrEmpty(order.ReceivedAmount))
            {
                decimal received = ParseDecimal(order.ReceivedAmount);
                if (received > 0)
                {
                    buffer.AddRange(PrintText($"RECEBIDO: R$ {received:F2}"));
                    buffer.AddRange(PrintLine(1));

                    decimal change = 0;
                    if (!string.IsNullOrEmpty(order.ChangeAmount))
                    {
                        change = ParseDecimal(order.ChangeAmount);
                    }
                    else if (received > total)
                    {
                        change = received - total;
                    }

                    if (change > 0)
                    {
                        buffer.AddRange(PrintBold($"TROCO: R$ {change:F2}"));
                        buffer.AddRange(PrintLine(1));
                    }
                }
            }
        }

        buffer.AddRange(PrintSeparator());

        // Rodapé
        buffer.AddRange(PrintCentered("Agradecemos a preferência!"));
        buffer.AddRange(PrintLine());
        buffer.AddRange(PrintCentered("www.adegags.com.br"));
        buffer.AddRange(PrintLine(3));

        // Cortar papel
        buffer.AddRange(CutPaper());

        return buffer.ToArray();
    }

    /// <summary>
    /// Comandos para inicializar a impressora
    /// </summary>
    private byte[] InitializePrinter()
    {
        return new byte[]
        {
            ESC, 0x40, // Reset
            ESC, 0x61, 0x01, // Centralizar próximo texto
        };
    }

    /// <summary>
    /// Imprime texto centralizado
    /// </summary>
    private byte[] PrintCentered(string text, int fontSize = 1)
    {
        var buffer = new List<byte>();
        buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x01); // Centralizar
        if (fontSize > 1)
        {
            buffer.Add(ESC); buffer.Add(0x21); buffer.Add((byte)(fontSize == 2 ? 0x11 : 0x00)); // Fonte dupla altura e largura
        }
        buffer.AddRange(GetBytes(text));
        buffer.Add(ESC); buffer.Add(0x21); buffer.Add(0x00); // Reset fonte
        buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x00); // Alinhar à esquerda
        return buffer.ToArray();
    }

    /// <summary>
    /// Imprime texto em negrito
    /// </summary>
    private byte[] PrintBold(string text, bool alignRight = false, int width = 48)
    {
        var buffer = new List<byte>();
        if (alignRight)
        {
            buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x02); // Alinhar à direita
        }
        buffer.Add(ESC); buffer.Add(0x45); buffer.Add(0x01); // Negrito ON
        buffer.AddRange(GetBytes(text));
        buffer.Add(ESC); buffer.Add(0x45); buffer.Add(0x00); // Negrito OFF
        buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x00); // Alinhar à esquerda
        return buffer.ToArray();
    }

    /// <summary>
    /// Imprime texto normal
    /// </summary>
    private byte[] PrintText(string text, bool leftAlign = true)
    {
        if (leftAlign)
        {
            var buffer = new List<byte>();
            buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x00); // Alinhar à esquerda
            buffer.AddRange(GetBytes(text));
            return buffer.ToArray();
        }
        return GetBytes(text);
    }

    /// <summary>
    /// Imprime texto alinhado à direita
    /// </summary>
    private byte[] PrintTextRight(string text, int width = 48)
    {
        var buffer = new List<byte>();
        buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x02); // Alinhar à direita
        buffer.AddRange(GetBytes(text));
        buffer.Add(ESC); buffer.Add(0x61); buffer.Add(0x00); // Alinhar à esquerda
        return buffer.ToArray();
    }

    /// <summary>
    /// Imprime linha em branco
    /// </summary>
    private byte[] PrintLine(int count = 1)
    {
        var lines = new List<byte>();
        for (int i = 0; i < count; i++)
        {
            lines.Add(LF);
        }
        return lines.ToArray();
    }

    /// <summary>
    /// Imprime separador
    /// </summary>
    private byte[] PrintSeparator()
    {
        var separator = new string('-', 48);
        return GetBytes(separator + "\n");
    }

    /// <summary>
    /// Corta o papel
    /// </summary>
    private byte[] CutPaper()
    {
        return new byte[]
        {
            GS, 0x56, 0x42, 0x00 // Corte parcial
        };
    }

    /// <summary>
    /// Verifica se a impressora está disponível
    /// </summary>
    private bool IsPrinterAvailable(string printerName)
    {
        try
        {
            foreach (string printer in PrinterSettings.InstalledPrinters)
            {
                if (printer.Contains(printerName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Envia dados para a impressora via RAW
    /// </summary>
    private bool SendToPrinter(string printerName, byte[] data)
    {
        try
        {
            // Encontrar nome exato da impressora
            string? exactPrinterName = null;
            foreach (string printer in PrinterSettings.InstalledPrinters)
            {
                if (printer.Contains(printerName, StringComparison.OrdinalIgnoreCase))
                {
                    exactPrinterName = printer;
                    break;
                }
            }

            if (exactPrinterName == null)
            {
                _logger.LogError($"Impressora '{printerName}' não encontrada");
                return false;
            }

            // Usar RawPrinterHelper para enviar bytes diretamente
            return RawPrinterHelper.SendBytesToPrinter(exactPrinterName, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Erro ao enviar dados para impressora '{printerName}'");
            return false;
        }
    }

    // Métodos auxiliares
    private string GetItemName(OrderItemDto item)
    {
        // Preferir nome unificado enviado pela API (evita "Produto desconhecido" em combos)
        if (!string.IsNullOrWhiteSpace(item.Name))
            return item.Name;
        if (item.IsCombo && item.Combo != null)
            return item.Combo.Name;
        return item.Product?.Name ?? "Produto não encontrado";
    }

    private string GetPaymentMethod(OrderDto order)
    {
        if (order.Payment != null && order.Payment.Count > 0)
        {
            return FormatPaymentMethod(order.Payment[0].PaymentMethod);
        }
        if (!string.IsNullOrEmpty(order.PaymentMethod))
        {
            return FormatPaymentMethod(order.PaymentMethod);
        }
        return "Não informado";
    }

    private string FormatPaymentMethod(string method)
    {
        return method.ToLower() switch
        {
            "dinheiro" => "DINHEIRO",
            "cartao" or "cartão" => "CARTÃO",
            "credito" or "crédito" => "CARTÃO DE CRÉDITO",
            "debito" or "débito" => "CARTÃO DE DÉBITO",
            "pix" => "PIX",
            _ => method.ToUpper()
        };
    }

    private string FormatStatus(string status)
    {
        return status.ToLower() switch
        {
            "pending" => "PENDENTE",
            "delivering" => "EM ENTREGA",
            "completed" => "CONCLUÍDO",
            "cancelled" => "CANCELADO",
            _ => status.ToUpper()
        };
    }

    private string BuildAddressString(DeliveryAddressDto address)
    {
        var parts = new List<string>();
        
        if (!string.IsNullOrEmpty(address.Street))
        {
            parts.Add(address.Street);
        }
        if (!string.IsNullOrEmpty(address.Number))
        {
            parts.Add($"Nº {address.Number}");
        }
        if (!string.IsNullOrEmpty(address.Complement))
        {
            parts.Add(address.Complement);
        }
        
        string addressLine = string.Join(", ", parts);
        
        var locationParts = new List<string>();
        if (!string.IsNullOrEmpty(address.Neighborhood))
        {
            locationParts.Add(address.Neighborhood);
        }
        if (!string.IsNullOrEmpty(address.City))
        {
            locationParts.Add(address.City);
        }
        if (!string.IsNullOrEmpty(address.State))
        {
            locationParts.Add(address.State);
        }
        
        if (locationParts.Any())
        {
            addressLine += $"\n{string.Join(" - ", locationParts)}";
        }
        
        if (!string.IsNullOrEmpty(address.Zipcode))
        {
            addressLine += $"\nCEP: {address.Zipcode}";
        }
        
        return addressLine;
    }

    private bool HasDeliveryAddress(DeliveryAddressDto address)
    {
        return !string.IsNullOrEmpty(address.Street) ||
               !string.IsNullOrEmpty(address.Number) ||
               !string.IsNullOrEmpty(address.City);
    }

    //
    // --- MÉTODO ParseDecimal (Mantido da correção anterior) ---
    //
    private decimal ParseDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;

        // Remove caracteres não numéricos exceto o ponto
        // e já substitui a vírgula por ponto, caso venha no formato errado.
        string cleaned = value.Replace("R$", "")
                              .Replace(" ", "")
                              .Replace(",", ".") // Garantia de que o separador é ponto
                              .Trim();

        // O JSON/API (do Laravel/JS) *sempre* envia o formato invariante (com ponto "."),
        // independentemente da cultura do servidor.
        // Devemos *sempre* usar CultureInfo.InvariantCulture para ler os dados.
        if (decimal.TryParse(cleaned, NumberStyles.Number, 
            CultureInfo.InvariantCulture, out decimal result))
        {
            return result;
        }

        // Se falhar, logar e retornar 0
        _logger.LogWarning($"Não foi possível converter o valor decimal: {value}");
        return 0;
    }
}